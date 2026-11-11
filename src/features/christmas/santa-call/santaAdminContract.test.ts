import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { santaAdminReport } from "../../../../supabase/functions/_shared/christmas/santaAdminReporting";

it("serves a read-only report on the commerce schema without optional refund columns", async () => {
  const columns: string[] = [];
  const service = {
    from: () => {
      const query = {
        select: (value: string) => {
          columns.push(value);
          return query;
        },
        in: () => query,
        or: () => query,
        order: () => query,
        range: () => query,
        abortSignal: () => Promise.resolve({ data: [], error: null }),
      };
      return query;
    },
  };
  const report = await santaAdminReport(
    service,
    { preset: "7" },
    () => undefined,
  );
  expect(report.ok).toBe(true);
  expect(report.metrics.find((m) => m.id === "refunds")).toMatchObject({
    value: null,
    unavailable: expect.stringContaining("Stripe"),
  });
  expect(report.integrations.ga4.status).toBe("unavailable");
  expect(report.metrics.find((m) => m.id === "fp_page_views")?.value).toBe(0);
  expect(columns.join(",")).not.toContain("last_refund_at");
  expect(columns.join(",")).not.toContain("email");
});
it("links Santa landing, checkout, Stripe and purchase with the same anonymous session", () => {
  const page = readFileSync(
    new URL("../ChristmasSantaCallPage.tsx", import.meta.url),
    "utf8",
  );
  const checkout = readFileSync(
    new URL(
      "../../../../supabase/functions/christmas-checkout/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const webhook = readFileSync(
    new URL(
      "../../../../supabase/functions/_shared/christmas/stripeFulfill.ts",
      import.meta.url,
    ),
    "utf8",
  );
  expect(page).toContain("funnel_session_id: getChristmasFunnelSessionId()");
  expect(page).toContain("...attribution");
  expect(page).toContain("source_route: SANTA_CALL_ROUTE");
  expect(checkout).toContain('params.set("metadata[funnel_session_id]"');
  expect(webhook).toContain("recordSantaPurchaseFunnel");
  expect(webhook).toContain('event_name: "purchase"');
});
it("wires the dashboard action behind admin authorization and keeps reporting available during shutdown", () => {
  const code = readFileSync(
    new URL(
      "../../../../supabase/functions/christmas-santa-call/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const action = code.slice(
    code.indexOf('if (action === "admin_dashboard")'),
    code.indexOf('if (action === "sweep_stale_sessions")'),
  );
  expect(action).toContain(
    'if (!(await requireAdmin(req))) return json({ error: "forbidden" }, 403)',
  );
  expect(action.indexOf("requireAdmin(req)")).toBeLessThan(
    action.indexOf("santaAdminReport(service"),
  );
  expect(code).toContain(
    '["stats", "admin_dashboard", "resolve", "confirm_checkout", "poll_extension"]',
  );
});
