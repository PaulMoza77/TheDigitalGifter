// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChristmasSantaCallPage from "../ChristmasSantaCallPage";
import { COOKIE_CONSENT_CHANGED_EVENT } from "@/lib/cookieConsent";

const mocks = vi.hoisted(() => ({
  offers: vi.fn(), checkout: vi.fn(), confirm: vi.fn(), analytics: vi.fn(), purchase: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("../photoApi", () => ({ fetchChristmasCommercialOffers: mocks.offers, startChristmasCheckout: mocks.checkout }));
vi.mock("./santaCallApi", () => ({ confirmSantaCallCommercialCheckout: mocks.confirm, createSantaCallParentTestCheckout: vi.fn() }));
vi.mock("./santaCallAnalytics", () => ({ trackSantaCallAnalytics: mocks.analytics }));
vi.mock("./santaCallMeta", () => ({ trackSantaCallMetaViewContent: vi.fn(), trackSantaCallMetaInitiateCheckout: vi.fn(), trackSantaCallMetaPurchase: mocks.purchase }));
vi.mock("@/features/pet/funnelAttribution", () => ({
  captureFunnelAttribution: vi.fn(),
  attributionParamsForInternal: vi.fn(() => ({})),
  getFunnelFirstTouchContext: vi.fn(() => ({
    landingPathname: "/christmas/santa-call",
    referrerHost: null,
    hasFbclid: false,
  })),
}));
vi.mock("@/features/pet/components/CustomStripeCheckout", () => ({ CustomStripeCheckout: () => createElement("div", null, "Secure checkout") }));
vi.mock("@/components/PageHead", () => ({ PageHead: () => null }));
vi.mock("../seo/ChristmasPageHead", () => ({ ChristmasPageHead: () => null }));

let root: Root;
let container: HTMLDivElement;
const activeOffer = { key: "xmas_santa_voice_call", category: "christmas_offer", name: "Santa", price_cents: 5900, currency: "ron", active: true, metadata: { web_price_minor: 5900, web_currency: "ron", web_checkout_enabled: true } };
async function render(path = "/christmas/santa-call?lang=ro&market=ro") {
  await act(async () => { root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ChristmasSantaCallPage))); });
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(text))!;
}
async function fillRequiredFields() {
  await act(async () => button("Personalizează apelul").click());
  await act(async () => {
    for (const [id, value] of [["santa-name", "Test"], ["santa-email", "parent@example.com"]]) {
      const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("VITE_SANTA_CALL_LANDING_PUBLIC", "true");
  vi.stubEnv("VITE_SANTA_CALL_ENABLE_CHECKOUT", "true");
  vi.stubEnv("VITE_SANTA_CALL_QA_CHECKOUT", "false");
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Element.prototype.scrollIntoView = vi.fn();
  mocks.offers.mockReset().mockResolvedValue([activeOffer]);
  mocks.checkout.mockReset();
  mocks.confirm.mockReset(); mocks.purchase.mockClear(); mocks.analytics.mockClear();
  localStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Santa landing purchase safeguards", () => {
  it("shows the offer and opens the short form only when purchasing is available", async () => {
    await render();
    expect(container.textContent).toContain("59 lei / 3 minute");
    await act(async () => button("Personalizează apelul").click());
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelectorAll("input[required]")).toHaveLength(3);
    expect(container.querySelector(".sc-optional")?.hasAttribute("open")).toBe(false);
  });
  it("distinguishes a loading offer from a closed checkout", async () => {
    mocks.offers.mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toContain("Verificăm disponibilitatea");
    expect(button("Personalizează apelul")).toBeUndefined();
    expect(container.textContent).not.toContain("nu poate fi cumpărat");
  });
  it("keeps sales disabled when the launch flag is off", async () => {
    vi.stubEnv("VITE_SANTA_CALL_ENABLE_CHECKOUT", "false");
    await render();
    expect(container.textContent).toContain("nu poate fi cumpărat momentan");
    expect(button("Personalizează apelul")).toBeUndefined();
  });
  it("retries a failed availability request", async () => {
    mocks.offers.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.textContent).toContain("Nu am putut verifica disponibilitatea");
    await act(async () => button("Verifică din nou").click());
    expect(button("Personalizează apelul")).toBeDefined();
  });
  it("does not claim payment or expose another purchase form for a bare success URL", async () => {
    await render("/christmas/santa-call?checkout=success&lang=ro&market=ro");
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Plata a fost înregistrată");
    expect(container.querySelector("form")).toBeNull();
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("allows confirmation retry after a network failure and only tracks a verified live purchase", async () => {
    mocks.confirm.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, data: { ok: true, orderId: "paid-order", amountCents: 5900, currency: "ron", livemode: true, stripe_mode: "live" } });
    await render("/christmas/santa-call?checkout=success&session_id=cs_example&lang=ro&market=ro");
    expect(mocks.purchase).not.toHaveBeenCalled();
    await act(async () => button("Reîncearcă confirmarea").click());
    expect(container.textContent).toContain("Plata este confirmată");
    expect(mocks.purchase).toHaveBeenCalledWith({ orderId: "paid-order", amountCents: 5900, currency: "ron" });
  });
  it("uses the selected currency for the extension when UI language differs", async () => {
    await render("/christmas/santa-call?lang=ro&market=us");
    expect(container.textContent).toContain("$9.99");
    expect(container.textContent).not.toContain("49 lei");
  });
  it("creates a single checkout for repeated submission and locks the paid personalization", async () => {
    let complete!: (value: unknown) => void;
    mocks.checkout.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    await render();
    await fillRequiredFields();
    await act(async () => {
      const form = container.querySelector("form")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mocks.checkout).toHaveBeenCalledTimes(1);
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ child_first_name: "Test", email: "parent@example.com", guardian_consent: true, market: "ro" }));
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    await act(async () => complete({ clientSecret: "test_secret", publishableKey: "pk_test_example", amountCents: 5900, currency: "ron", orderId: "test-order" }));
    expect(container.textContent).toContain("Secure checkout");
    expect(container.querySelector("form")).toBeNull();
    expect(button("EN").disabled).toBe(true);
  });
  it("keeps the entered fields available after an incomplete checkout response", async () => {
    mocks.checkout.mockResolvedValue({ amountCents: 5900, currency: "ron" });
    await render();
    await fillRequiredFields();
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Nu am putut pregăti plata");
    expect(container.querySelector<HTMLInputElement>("#santa-name")?.value).toBe("Test");
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
  });
  it("does not invent a purchase amount when server confirmation omits it", async () => {
    mocks.confirm.mockResolvedValue({ ok: true, data: { ok: true, orderId: "paid-order", livemode: true, stripe_mode: "live", currency: "ron" } });
    await render("/christmas/santa-call?lang=ro&market=ro&checkout=success&session_id=cs_live_example");
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.analytics.mock.calls.some(([name]) => name === "santa_purchase_confirmed")).toBe(false);
  });
  it("does not report a test payment as a live purchase", async () => {
    mocks.confirm.mockResolvedValue({ ok: true, data: { ok: true, orderId: "test-order", livemode: false, stripe_mode: "test" } });
    await render("/christmas/santa-call?checkout=success&session_id=cs_test_example&lang=ro&market=ro");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("retries the landing event when consent changes and removes the listener on exit", async () => {
    await render();
    mocks.analytics.mockClear();
    await act(async () => window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT)));
    expect(mocks.analytics).toHaveBeenCalledWith("santa_page_view", { market: "ro", language: "ro" }, "landing_view");
    await act(async () => root.render(null));
    mocks.analytics.mockClear();
    window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
    expect(mocks.analytics).not.toHaveBeenCalled();
  });
});
