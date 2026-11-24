// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { SantaSupportChat, openSantaSupport } from "./SantaSupportChat";
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: mock.invoke } },
}));
let root: Root, el: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  mock.invoke.mockReset();
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function show() {
  await act(async () =>
    root.render(
      createElement(SantaSupportChat, { language: "ro", context: "call" }),
    ),
  );
  await act(async () => openSantaSupport());
}
async function fill() {
  await act(async () => {
    for (const [selector, value] of [
      ["input[type=email]", "parent@example.com"],
      ["textarea", "Microfonul nu pornește."],
    ]) {
      const input = el.querySelector(selector)!;
      const proto =
        selector === "textarea"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
it("creates a ticket without exposing the private call URL and shows the saved reference", async () => {
  mock.invoke.mockImplementation((_name, { body }) =>
    Promise.resolve({
      data:
        body.action === "create"
          ? { reference: "TDG-123456", guestToken: "private-test-token" }
          : {
              reference: "TDG-123456",
              status: "open",
              messages: [
                {
                  id: "admin",
                  senderType: "admin",
                  message: "Te putem ajuta.",
                },
              ],
            },
      error: null,
    }),
  );
  await show();
  await fill();
  await act(async () =>
    el
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mock.invoke).toHaveBeenCalledWith("support-conversation", {
    body: expect.objectContaining({
      action: "create",
      context: "call",
      email: "parent@example.com",
    }),
  });
  expect(el.textContent).toContain("TDG-123456");
  expect(el.textContent).toContain("Te putem ajuta.");
  expect(localStorage.getItem("tdg.santa.support.v1")).toContain(
    "private-test-token",
  );
});
it("preserves the message and offers email when the server fails", async () => {
  mock.invoke.mockResolvedValue({ error: Error("offline"), data: null });
  await show();
  await fill();
  await act(async () =>
    el
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(el.querySelector("textarea")!.value).toBe("Microfonul nu pornește.");
  expect(el.querySelector("[role=alert]")).not.toBeNull();
  expect(el.querySelector("a")!.href).toBe(
    "mailto:support@thedigitalgifter.com",
  );
});
it("restores a conversation and sends replies with its access token", async () => {
  localStorage.setItem(
    "tdg.santa.support.v1",
    JSON.stringify({
      reference: "TDG-123456",
      guestToken: "private-test-token",
    }),
  );
  mock.invoke.mockResolvedValue({
    data: { status: "open", messages: [] },
    error: null,
  });
  await show();
  await act(async () => {
    const input = el.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, "Mulțumesc!");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    el
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mock.invoke).toHaveBeenLastCalledWith("support-conversation", {
    body: {
      action: "reply",
      reference: "TDG-123456",
      guestToken: "private-test-token",
      message: "Mulțumesc!",
    },
  });
});
