import { describe, expect, it } from "vitest";
import { parseV2EventBody } from "./petV2";

const session = "11111111-1111-4111-8111-111111111111";

describe("V2 funnel ingest", () => {
  it("accepts a v2 event and rejects a V1 event name", () => {
    const row = parseV2EventBody({
      event_name: "v2_landing_view",
      funnel_session_id: session,
      pathname: "/pet/dog-v2",
      species: "dog",
    });
    expect(row.eventName).toBe("v2_landing_view");
    expect(row.pathname).toBe("/pet/dog-v2");
    expect(() =>
      parseV2EventBody({
        event_name: "landing_view",
        funnel_session_id: session,
      }),
    ).toThrow(/invalid_event/);
  });

  it("drops V1 pathnames so V2 cannot impersonate /pet/dog", () => {
    const row = parseV2EventBody({
      event_name: "v2_upload_completed",
      funnel_session_id: session,
      pathname: "/pet/dog",
    });
    expect(row.pathname).toBeNull();
  });

  it("re-exports originAllowed so the V2 serverless handler can load", async () => {
    const mod = await import("./petV2");
    expect(typeof mod.originAllowed).toBe("function");
    expect(typeof mod.persistV2WriteFailure).toBe("function");
  });
});
