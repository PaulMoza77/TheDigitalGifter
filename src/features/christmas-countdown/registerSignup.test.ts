import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getSession: (...args: unknown[]) => getSession(...args) },
  },
}));

vi.mock("@/features/christmas-countdown/utm", () => ({
  attributionForSignup: () => ({
    source: "meta",
    medium: "paid_social",
    campaign: "xmas",
    content: null,
    term: null,
    referrer: "facebook.com",
    landingPage: "/christmas",
  }),
}));

vi.mock("@/features/christmas/analytics", () => ({
  getChristmasFunnelSessionId: () => "11111111-1111-1111-1111-111111111111",
}));

describe("registerChristmasCountdownSignup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses the public RPC when it succeeds", async () => {
    rpc.mockResolvedValue({ data: { ok: true, created: true }, error: null });
    const { registerChristmasCountdownSignup } = await import("./registerSignup");
    const result = await registerChristmasCountdownSignup({
      email: "Ada@Example.com",
      signupMethod: "email",
      marketingOptIn: false,
      campaignYear: 2026,
    });
    expect(result).toEqual({ ok: true, created: true });
    expect(rpc).toHaveBeenCalledWith(
      "register_christmas_countdown_signup",
      expect.objectContaining({
        p_email: "ada@example.com",
        p_signup_method: "email",
        p_marketing_opt_in: false,
      }),
    );
  });

  it("falls back to the origin API when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
    getSession.mockResolvedValue({ data: { session: { access_token: "user-jwt" } } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, created: true, duplicate: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { registerChristmasCountdownSignup } = await import("./registerSignup");
    const result = await registerChristmasCountdownSignup({
      email: "ada@example.com",
      signupMethod: "google",
      userId: "user-1",
      marketingOptIn: true,
      campaignYear: 2026,
    });
    expect(result).toEqual({ ok: true, created: true, duplicate: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/christmas-countdown-signup",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer user-jwt" }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.signup_method).toBe("google");
    expect(body.marketing_opt_in).toBe(true);
  });

  it("rejects an invalid email before calling the RPC", async () => {
    const { registerChristmasCountdownSignup } = await import("./registerSignup");
    await expect(
      registerChristmasCountdownSignup({
        email: "not-an-email",
        signupMethod: "email",
        marketingOptIn: false,
        campaignYear: 2026,
      }),
    ).rejects.toThrow("Enter a valid email");
    expect(rpc).not.toHaveBeenCalled();
  });
});
