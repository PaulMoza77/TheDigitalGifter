const OPENAI_CALL_ID = /^rtc_[A-Za-z0-9_-]{8,200}$/;

export function openAiRealtimeCallIdFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  let candidate = "";
  try {
    const url = new URL(location, "https://api.openai.com");
    candidate = url.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    candidate = location.split("?")[0].split("/").filter(Boolean).pop() || "";
  }
  return OPENAI_CALL_ID.test(candidate) ? candidate : null;
}

export function isOpenAiRealtimeCallId(value: unknown): value is string {
  return typeof value === "string" && OPENAI_CALL_ID.test(value);
}

export async function hangupOpenAiRealtimeCall(input: {
  apiKey: string;
  callId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; status: number; alreadyClosed: boolean }> {
  if (!input.apiKey || !isOpenAiRealtimeCallId(input.callId)) {
    return { ok: false, status: 0, alreadyClosed: false };
  }
  const response = await (input.fetchImpl || fetch)(
    `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(input.callId)}/hangup`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
    },
  );
  const alreadyClosed = response.status === 404 || response.status === 409;
  return { ok: response.ok || alreadyClosed, status: response.status, alreadyClosed };
}
