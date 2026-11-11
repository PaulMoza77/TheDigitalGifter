export type CustomerIdentity = {
  id: string;
  name?: string | null;
  email?: string | null;
  created_at?: string | null;
};
export type CustomerOrder = {
  id: string;
  email?: string | null;
  user_id?: string | null;
  created_at: string;
  currency?: string | null;
  amount_cents?: number | null;
  charged_amount_cents?: number | null;
  amount_total_cents?: number | null;
  amount?: number | null;
  status?: string;
  payment_status?: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
  stripe_checkout_session_id?: string | null;
};
export type Customer = {
  id: string;
  name: string;
  email: string;
  registered: boolean;
  createdAt: string;
  lastActivity: string;
  orders: number;
  paidOrders: number;
  totals: Record<string, number>;
  products: string[];
};
export function mergeCustomers(
  identities: CustomerIdentity[],
  groups: Array<{ source: string; rows: CustomerOrder[] }>,
): Customer[] {
  const map = new Map<string, Customer>();
  const ids = new Map<string, string>();
  const emailKey = (email?: string | null) =>
    (email || "").trim().toLowerCase();
  const ensure = (
    key: string,
    id: string,
    email: string,
    createdAt: string,
  ) => {
    if (!map.has(key))
      map.set(key, {
        id,
        name: "",
        email,
        registered: false,
        createdAt,
        lastActivity: createdAt,
        orders: 0,
        paidOrders: 0,
        totals: {},
        products: [],
      });
    return map.get(key)!;
  };
  for (const row of identities) {
    const email = emailKey(row.email),
      key = email || `user:${row.id}`;
    ids.set(row.id, key);
    const customer = ensure(key, row.id, email, row.created_at || "");
    customer.registered = true;
    customer.name ||= row.name || "";
  }
  const seen = new Set<string>();
  for (const group of groups)
    for (const row of group.rows) {
      const unique =
        row.stripe_checkout_session_id || `${group.source}:${row.id}`;
      if (seen.has(unique)) continue;
      seen.add(unique);
      // QA/test checkouts must not appear as commercial customers.
      if (
        [
          "is_test",
          "santa_qa",
          "qa",
          "manual_qa",
          "noncommercial",
          "no_charge",
          "harness",
          "email_probe",
          "email_preview_test",
        ].some(
          (key) =>
            row.metadata?.[key] === true || row.metadata?.[key] === "true",
        ) ||
        ["test", "preview"].includes(String(row.metadata?.stripe_mode || "")) ||
        row.stripe_checkout_session_id?.startsWith("cs_test_")
      )
        continue;
      const email = emailKey(row.email),
        key =
          email ||
          (row.user_id && ids.get(row.user_id)) ||
          `${group.source}:${row.id}`;
      const customer = ensure(
        key,
        row.user_id || row.id,
        email,
        row.created_at,
      );
      customer.orders++;
      if (!customer.products.includes(group.source))
        customer.products.push(group.source);
      if (row.created_at > customer.lastActivity)
        customer.lastActivity = row.created_at;
      if (!customer.createdAt || row.created_at < customer.createdAt)
        customer.createdAt = row.created_at;
      const status = (row.payment_status || row.status || "").toLowerCase();
      const paid =
        group.source === "Pet"
          ? Boolean(row.paid_at) &&
            !["refunded", "cancelled", "canceled"].includes(status)
          : ["paid", "complete", "completed", "succeeded"].includes(status);
      if (!paid) continue;
      customer.paidOrders++;
      const cents =
        group.source === "Pet"
          ? (row.charged_amount_cents ?? row.amount_cents)
          : group.source === "Christmas"
            ? (row.charged_amount_cents ?? row.amount_cents)
            : (row.amount_total_cents ??
              (row.amount == null
                ? null
                : Math.round(Number(row.amount) * 100)));
      const currency = row.currency?.toUpperCase() || "UNKNOWN";
      if (cents != null && Number.isFinite(Number(cents)))
        customer.totals[currency] =
          (customer.totals[currency] || 0) + Number(cents);
    }
  return [...map.values()].sort((a, b) =>
    b.lastActivity.localeCompare(a.lastActivity),
  );
}
export const formatCustomerMoney = (totals: Record<string, number>) =>
  Object.entries(totals)
    .map(([currency, cents]) => `${(cents / 100).toFixed(2)} ${currency}`)
    .join(" · ") || "—";
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}
