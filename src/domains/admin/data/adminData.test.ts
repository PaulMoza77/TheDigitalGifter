import { describe, expect, it } from "vitest";
import {
  mergeCustomers,
  formatCustomerMoney,
  csvCell,
  type CustomerOrder,
} from "./customers";
import { readAdminRows } from "./readAdminRows";
const order = (overrides: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: "o1",
  email: "parent@example.com",
  created_at: "2026-11-10T10:00:00Z",
  currency: "ron",
  amount_cents: 5900,
  payment_status: "paid",
  ...overrides,
});
describe("customer reporting", () => {
  it("includes guest buyers and merges account email case across products", () => {
    const rows = mergeCustomers(
      [{ id: "u1", name: "Parent", email: "PARENT@example.com" }],
      [
        { source: "Christmas", rows: [order()] },
        {
          source: "Pet",
          rows: [
            order({
              id: "p1",
              currency: "usd",
              paid_at: "2026-11-10",
              charged_amount_cents: 2700,
            }),
          ],
        },
        {
          source: "Christmas",
          rows: [order({ id: "o2", email: "guest@example.com" })],
        },
      ],
    );
    expect(rows).toHaveLength(2);
    const parent = rows.find((r) => r.email === "parent@example.com")!;
    expect(parent).toMatchObject({
      registered: true,
      orders: 2,
      paidOrders: 2,
      totals: { RON: 5900, USD: 2700 },
    });
    expect(formatCustomerMoney(parent.totals)).toBe("59.00 RON · 27.00 USD");
    expect(rows.find((r) => r.email === "guest@example.com")?.registered).toBe(
      false,
    );
  });
  it("does not mark unpaid checkouts as purchases or include test checkouts", () => {
    const rows = mergeCustomers(
      [],
      [
        {
          source: "Christmas",
          rows: [
            order({ payment_status: "pending" }),
            order({ id: "qa", stripe_checkout_session_id: "cs_test_123" }),
          ],
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orders: 1, paidOrders: 0, totals: {} });
  });
  it("deduplicates the same Stripe session across order sources", () => {
    const rows = mergeCustomers(
      [],
      ["Christmas", "Credits"].map((source) => ({
        source,
        rows: [order({ stripe_checkout_session_id: "cs_live_one" })],
      })),
    );
    expect(rows[0].orders).toBe(1);
  });
  it("escapes spreadsheet formulas and quotes in exports", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("plain")).toBe('"plain"');
  });
});
describe("complete admin datasets", () => {
  it("keeps paging even when the server caps pages below requested size", async () => {
    const rows = Array.from({ length: 1100 }, (_, id) => ({ id }));
    const loaded = await readAdminRows(
      () => ({
        range: (start: number) =>
          Promise.resolve({
            data: rows.slice(start, start + 100),
            count: rows.length,
            error: null,
          }),
      }),
      "Orders",
    );
    expect(loaded).toHaveLength(1100);
    expect(loaded.at(-1)).toEqual({ id: 1099 });
  });
  it("rejects source errors, missing totals, oversized or incomplete results", async () => {
    for (const result of [
      { error: { message: "offline" } },
      { count: null, data: [] },
      { count: 50001, data: [] },
      { count: 2, data: [] },
    ])
      await expect(
        readAdminRows(
          () => ({ range: () => Promise.resolve(result) }),
          "Orders",
        ),
      ).rejects.toThrow("Orders:");
  });
});
