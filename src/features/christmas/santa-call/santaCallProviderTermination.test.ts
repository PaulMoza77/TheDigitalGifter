import { describe, expect, it, vi } from "vitest";
import {
  hangupOpenAiRealtimeCall,
  isOpenAiRealtimeCallId,
  openAiRealtimeCallIdFromLocation,
} from "../../../../supabase/functions/_shared/christmas/santaCallProviderTermination";

describe("Santa Call provider termination", () => {
  it("extracts only an OpenAI WebRTC call ID from Location", () => {
    expect(openAiRealtimeCallIdFromLocation("/v1/realtime/calls/rtc_12345678")).toBe("rtc_12345678");
    expect(openAiRealtimeCallIdFromLocation("https://api.openai.com/v1/realtime/calls/rtc_abcdefgh?x=1")).toBe("rtc_abcdefgh");
    expect(openAiRealtimeCallIdFromLocation("/v1/realtime/calls/not-a-call")).toBeNull();
    expect(isOpenAiRealtimeCallId("rtc_abcdefgh")).toBe(true);
    expect(isOpenAiRealtimeCallId("../secrets")).toBe(false);
  });

  it("uses the server-authenticated hangup endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await hangupOpenAiRealtimeCall({
      apiKey: "test-only-key",
      callId: "rtc_abcdefgh",
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, status: 200, alreadyClosed: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls/rtc_abcdefgh/hangup",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-only-key" },
      }),
    );
  });

  it("treats an already-closed provider call as idempotent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      hangupOpenAiRealtimeCall({ apiKey: "test-only-key", callId: "rtc_abcdefgh", fetchImpl }),
    ).resolves.toEqual({ ok: true, status: 404, alreadyClosed: true });
  });

  it("does not call the provider for an invalid ID or absent server key", async () => {
    const fetchImpl = vi.fn();
    await expect(
      hangupOpenAiRealtimeCall({ apiKey: "", callId: "rtc_abcdefgh", fetchImpl }),
    ).resolves.toMatchObject({ ok: false, status: 0 });
    await expect(
      hangupOpenAiRealtimeCall({ apiKey: "test-only-key", callId: "bad", fetchImpl }),
    ).resolves.toMatchObject({ ok: false, status: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
