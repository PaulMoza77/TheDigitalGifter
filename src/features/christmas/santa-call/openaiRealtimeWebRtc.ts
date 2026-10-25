/**
 * Browser WebRTC helper for OpenAI Realtime GA (/v1/realtime/calls).
 * Ephemeral client secret must come from TDG server — never ship OPENAI_API_KEY.
 */

export type RealtimeHandlers = {
  onStatus?: (status: "connecting" | "connected" | "listening" | "speaking" | "failed") => void;
  onRemoteTrack?: (stream: MediaStream) => void;
  onDataEvent?: (event: Record<string, unknown>) => void;
  onError?: (message: string) => void;
};

export type RealtimeSessionHandle = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  localStream: MediaStream;
  close: () => void;
  setMicEnabled: (enabled: boolean) => void;
  sendEvent: (event: Record<string, unknown>) => void;
};

export async function connectOpenAiRealtimeWebRtc(input: {
  clientSecret: string;
  realtimeUrl?: string;
  openingLine?: string;
  handlers?: RealtimeHandlers;
}): Promise<RealtimeSessionHandle> {
  const handlers = input.handlers || {};
  handlers.onStatus?.("connecting");

  const pc = new RTCPeerConnection();
  const remoteStream = new MediaStream();
  pc.ontrack = (ev) => {
    ev.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
    if (!remoteStream.getAudioTracks().length && ev.track) {
      remoteStream.addTrack(ev.track);
    }
    handlers.onRemoteTrack?.(remoteStream);
  };

  let localStream: MediaStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    handlers.onStatus?.("failed");
    handlers.onError?.("microphone_denied");
    throw new Error("microphone_denied");
  }

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    handlers.onStatus?.("connected");
    if (input.openingLine) {
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Start the call now with exactly this greeting, then wait for the child: ${input.openingLine}`,
          },
        }),
      );
    }
  };
  dc.onmessage = (msg) => {
    try {
      const event = JSON.parse(String(msg.data)) as Record<string, unknown>;
      handlers.onDataEvent?.(event);
      const type = typeof event.type === "string" ? event.type : "";
      if (type.includes("output_audio") || type === "response.output_audio.delta") {
        handlers.onStatus?.("speaking");
      } else if (type.includes("input_audio_buffer") || type === "input_audio_buffer.speech_started") {
        handlers.onStatus?.("listening");
      } else if (type === "response.done" || type === "output_audio_buffer.stopped") {
        handlers.onStatus?.("listening");
      }
    } catch {
      // ignore non-json
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const url = input.realtimeUrl || "https://api.openai.com/v1/realtime/calls";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp || "",
  });
  if (!res.ok) {
    handlers.onStatus?.("failed");
    handlers.onError?.(`realtime_connect_${res.status}`);
    localStream.getTracks().forEach((t) => t.stop());
    pc.close();
    throw new Error(`realtime_connect_${res.status}`);
  }
  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  return {
    pc,
    dc,
    localStream,
    close: () => {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      localStream.getTracks().forEach((t) => t.stop());
      pc.close();
    },
    setMicEnabled: (enabled: boolean) => {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },
    sendEvent: (event: Record<string, unknown>) => {
      if (dc.readyState === "open") dc.send(JSON.stringify(event));
    },
  };
}
