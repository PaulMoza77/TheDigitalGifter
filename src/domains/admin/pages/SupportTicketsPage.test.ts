// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SupportTicketsPage from "./SupportTicketsPage";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  insert: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/domains/admin/data/readAdminRows", () => ({
  readAdminRows: mocks.read,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" } }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toast, success: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ or: () => Promise.resolve({ count: 0 }) }),
      insert: (row: unknown) => ({
        select: () => ({ single: () => mocks.insert(row) }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));
let root: Root, el: HTMLDivElement;
const tickets = ["one", "two"].map((id) => ({
  id,
  subject: `Ticket ${id}`,
  email: `${id}@example.test`,
  status: "open",
  created_at: "2026-11-10",
  updated_at: "2026-11-10",
}));
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Element.prototype.scrollIntoView = vi.fn();
  mocks.read.mockReset();
  mocks.insert.mockReset();
  mocks.toast.mockReset();
  mocks.read.mockImplementation((_q, label) =>
    Promise.resolve(label === "Support tickets" ? tickets : []),
  );
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) =>
  [...el.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  )!;
async function render() {
  await act(async () => root.render(createElement(SupportTicketsPage)));
}
async function draft(text: string) {
  await act(async () => {
    const area = el.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("shows a load error instead of implying the inbox is empty", async () => {
  mocks.read.mockRejectedValue(new Error("Backend offline"));
  await render();
  expect(el.querySelector('[role="alert"]')?.textContent).toContain(
    "Backend offline",
  );
  expect(el.textContent).not.toContain("No matching tickets");
});
it("keeps separate unsent drafts when switching conversations", async () => {
  await render();
  await draft("Reply for one");
  await act(async () => button("Ticket two").click());
  expect(el.querySelector("textarea")?.value).toBe("");
  await draft("Reply for two");
  await act(async () => button("Ticket one").click());
  expect(el.querySelector("textarea")?.value).toBe("Reply for one");
});
it("prevents duplicate sends and keeps a late reply out of another ticket", async () => {
  let resolve!: (value: unknown) => void;
  mocks.insert.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await render();
  await draft("Response for one");
  await act(async () => {
    const area = el.querySelector("textarea")!;
    area.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    area.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  expect(mocks.insert.mock.calls[0][0].ticket_id).toBe("one");
  await act(async () => button("Ticket two").click());
  await act(async () =>
    resolve({
      data: {
        id: "reply",
        ticket_id: "one",
        message: "Response for one",
        sender_type: "admin",
        created_at: "2026-11-10",
      },
      error: null,
    }),
  );
  expect(el.textContent).not.toContain("Response for one");
});
