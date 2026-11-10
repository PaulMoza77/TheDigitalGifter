// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CustomStripeCheckout } from "./CustomStripeCheckout";

const mock = vi.hoisted(() => ({ state: { type: "loading" } as any }));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: { children: ReactNode }) => children,
  ExpressCheckoutElement: () => null,
  PaymentElement: () => null,
  useCheckoutElements: () => mock.state,
}));
vi.mock("../stripeLoader", () => ({
  getStripePromise: () => Promise.resolve(null),
  reloadStripeForCheckout: () => Promise.resolve(null),
  stripeInstanceKeyFingerprint: () => "test",
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mock.state = { type: "loading" };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(language?: "ro" | "en", loadingLabel?: string) {
  await act(async () => root.render(createElement(CustomStripeCheckout, {
    clientSecret: "cs_test_secret_example", publishableKey: "pk_test_example",
    dueDisplay: "59 lei", walletCapabilityOnly: true, language, loadingLabel,
    payButtonLabel: (amount) => `Plătește ${amount}`,
  })));
}
it("honors the supplied loading message when wallet detection is enabled", async () => {
  await render("ro", "Pregătim plata în siguranță…");
  expect(container.textContent).toBe("Pregătim plata în siguranță…");
});
it("keeps the existing English default for other checkout flows", async () => {
  await render();
  expect(container.textContent).toBe("Loading secure payment…");
});
it("shows payment recovery in Romanian without exposing provider diagnostics", async () => {
  mock.state = { type: "error", error: { message: "No such checkout.session: cs_test_example" } };
  await render("ro");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Nu am putut încărca plata securizată");
  expect(container.textContent).toContain("Reîncearcă plata securizată");
  expect(container.textContent).not.toContain("cs_test_example");
});
it("keeps card validation in Romanian and does not confirm incomplete payment", async () => {
  const confirm = vi.fn();
  mock.state = { type: "success", checkout: { confirm } };
  await render("ro");
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Completează datele cardului");
  expect(confirm).not.toHaveBeenCalled();
});
