import { beforeEach, describe, expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => ({
  initial: vi.fn(), extension: vi.fn(),
}));
vi.mock("../../../../supabase/functions/_shared/christmas/santaCallFulfill.ts", () => ({
  fulfillSantaVoiceCallOrder: handlers.initial,
  fulfillSantaVoiceCallExtensionOrder: handlers.extension,
}));
import { handleChristmasStripeEvent } from "../../../../supabase/functions/_shared/christmas/stripeFulfill";

describe("Santa payment webhook routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.initial.mockResolvedValue({ ok: true });
    handlers.extension.mockResolvedValue({ ok: true });
  });
  function fixture(product = "christmas_santa_voice_call_extension", payment = "paid", live = true) {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, status: "paid" }, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        funnel_session_id: "22222222-2222-4222-8222-222222222222",
        product_key: product,
        package_key: "single",
        locale: "ro",
        landing_path: "/christmas/santa-call",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const service = {
      rpc,
      from: vi.fn((table: string) =>
        table === "christmas_orders" ? { select } : { insert, upsert },
      ),
    };
    const input = {
      service: service as never, eventId: "evt_synthetic", eventType: "checkout.session.completed",
      obj: { payment_status: payment, amount_total: 4900, currency: "ron", livemode: live, id: "cs_synthetic", payment_intent: "pi_synthetic" },
      metadata: { product_family: "christmas", product_key: product, christmas_order_id: "11111111-1111-4111-8111-111111111111", stripe_mode: live ? "live" : "test" },
    };
    return { input, insert, rpc, upsert };
  }
  it("grants extension only after payment RPC succeeds", async () => {
    const f = fixture(); await handleChristmasStripeEvent(f.input);
    expect(f.rpc).toHaveBeenCalledWith("fulfill_christmas_order_payment", expect.objectContaining({ p_amount_cents: 4900, p_currency: "ron" }));
    expect(handlers.extension).toHaveBeenCalledOnce();
    expect(handlers.initial).not.toHaveBeenCalled();
    expect(f.insert).toHaveBeenCalledOnce();
  });
  it("retries failed fulfillment even when payment was already recorded", async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: { ok: true, status: "already_paid" }, error: null });
    handlers.extension.mockResolvedValueOnce({ ok: false });
    expect((await handleChristmasStripeEvent(f.input))?.status).toBe(500);
    expect(f.insert).not.toHaveBeenCalled();
    expect((await handleChristmasStripeEvent(f.input))?.status).toBe(200);
    expect(f.insert).toHaveBeenCalledOnce();
  });
  it("does not grant or mark a mismatched payment processed", async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: { ok: false, status: "amount_mismatch" }, error: null });
    expect((await handleChristmasStripeEvent(f.input))?.status).toBe(400);
    expect(handlers.extension).not.toHaveBeenCalled(); expect(f.insert).not.toHaveBeenCalled();
  });
  it("blocks test payloads on the live route", async () => {
    const f = fixture(undefined, "paid", false);
    expect((await handleChristmasStripeEvent(f.input))?.status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("ignores unpaid and missing payment status", async () => {
    for (const status of ["unpaid", ""]) {
      const f = fixture(undefined, status);
      await handleChristmasStripeEvent(f.input);
      expect(f.rpc).not.toHaveBeenCalled(); expect(handlers.extension).not.toHaveBeenCalled();
    }
  });
  it("routes the initial paid order to voice fulfillment", async () => {
    const f = fixture("christmas_santa_voice_call");
    await handleChristmasStripeEvent(f.input);
    expect(handlers.initial).toHaveBeenCalledOnce(); expect(handlers.extension).not.toHaveBeenCalled();
    expect(f.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "purchase",
        funnel_session_id: "22222222-2222-4222-8222-222222222222",
      }),
      expect.objectContaining({ onConflict: "idempotency_key" }),
    );
  });
});
