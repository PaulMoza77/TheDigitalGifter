import type { ChristmasEmailRow, ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

export type GrowthSourceKind = "confirmed" | "estimated" | "unavailable";

export type GrowthMetric = {
  label: string;
  value: string | number;
  hint: string;
  source: GrowthSourceKind;
};

export type DailyTrafficRow = {
  day: string;
  sessions: number;
  views: number;
  checkouts: number;
  purchases: number;
};

export type AttributionBucket = {
  key: string;
  label: string;
  sessions: number;
  kind: "confirmed" | "unknown";
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 10);
}

function isViewEvent(name: string): boolean {
  return (
    name.endsWith("page_view") ||
    name.endsWith("_view") ||
    name === "christmas_page_view" ||
    name === "landing_view"
  );
}

export function buildDailyTraffic(events: ChristmasEventRow[]): DailyTrafficRow[] {
  const map = new Map<string, { sessions: Set<string>; views: number; checkouts: Set<string>; purchases: Set<string> }>();
  for (const row of events) {
    const day = dayKey(row.created_at);
    const bucket = map.get(day) || {
      sessions: new Set<string>(),
      views: 0,
      checkouts: new Set<string>(),
      purchases: new Set<string>(),
    };
    if (row.funnel_session_id) bucket.sessions.add(row.funnel_session_id);
    if (isViewEvent(row.event_name)) bucket.views += 1;
    if (row.event_name.includes("checkout") && row.funnel_session_id) {
      bucket.checkouts.add(row.funnel_session_id);
    }
    if ((row.event_name === "purchase" || row.event_name.includes("purchase")) && row.funnel_session_id) {
      bucket.purchases.add(row.funnel_session_id);
    }
    map.set(day, bucket);
  }
  return [...map.entries()]
    .map(([day, value]) => ({
      day,
      sessions: value.sessions.size,
      views: value.views,
      checkouts: value.checkouts.size,
      purchases: value.purchases.size,
    }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30);
}

export function buildAttributionBuckets(events: ChristmasEventRow[]): AttributionBucket[] {
  const map = new Map<string, { sessions: Set<string>; confirmed: boolean }>();
  for (const row of events) {
    if (!row.funnel_session_id) continue;
    const raw = String(row.utm_source || "").trim().toLowerCase();
    const key = raw || "unknown";
    const current = map.get(key) || { sessions: new Set<string>(), confirmed: Boolean(raw) };
    current.sessions.add(row.funnel_session_id);
    current.confirmed = current.confirmed || Boolean(raw);
    map.set(key, current);
  }
  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      label: key === "unknown" ? "Unknown (no UTM)" : key,
      sessions: value.sessions.size,
      kind: value.confirmed ? ("confirmed" as const) : ("unknown" as const),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12);
}

export function productPerformance(orders: ChristmasOrderRow[]) {
  const map = new Map<string, { paid: number; pending: number; revenue: Map<string, number> }>();
  for (const row of orders) {
    const key = row.product_key || "unknown";
    const current = map.get(key) || { paid: 0, pending: 0, revenue: new Map<string, number>() };
    if (row.payment_status === "paid" && row.amount_cents > 0) {
      current.paid += 1;
      const cur = String(row.currency || "usd").toUpperCase();
      current.revenue.set(cur, (current.revenue.get(cur) || 0) + Number(row.amount_cents || 0));
    } else if (row.payment_status === "pending" || row.payment_status === "pending_payment") {
      current.pending += 1;
    }
    map.set(key, current);
  }
  return [...map.entries()]
    .map(([product, value]) => ({
      product,
      paid: value.paid,
      pending: value.pending,
      revenueLabel: [...value.revenue.entries()]
        .map(([cur, cents]) => `${(cents / 100).toFixed(2)} ${cur}`)
        .join(" · ") || "—",
    }))
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 12);
}

export function resendDeliverySummary(emails: ChristmasEmailRow[], legacy: ChristmasEmailRow[]) {
  const all = [...emails, ...legacy];
  const byStatus = new Map<string, number>();
  for (const row of all) {
    const status = String(row.status || "unknown");
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
  }
  return {
    total: all.length,
    byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function checkoutAbandonStats(orders: ChristmasOrderRow[], events: ChristmasEventRow[]) {
  const pending = orders.filter(
    (row) => row.payment_status === "pending" || row.payment_status === "pending_payment",
  ).length;
  const checkoutSessions = new Set(
    events.filter((row) => row.event_name.includes("checkout") && row.funnel_session_id).map((row) => row.funnel_session_id),
  ).size;
  const purchaseSessions = new Set(
    events
      .filter((row) => (row.event_name === "purchase" || row.event_name.includes("purchase")) && row.funnel_session_id)
      .map((row) => row.funnel_session_id),
  ).size;
  const abandonRate =
    checkoutSessions > 0 ? `${Math.round(((checkoutSessions - purchaseSessions) / checkoutSessions) * 100)}%` : "—";
  return { pendingOrders: pending, checkoutSessions, purchaseSessions, abandonRate };
}

export function organicProxyLabel(events: ChristmasEventRow[]): GrowthMetric {
  const sessions = new Set(events.map((row) => row.funnel_session_id).filter(Boolean));
  const withUtm = new Set(
    events.filter((row) => row.utm_source && row.funnel_session_id).map((row) => row.funnel_session_id),
  );
  const unknown = Math.max(0, sessions.size - withUtm.size);
  return {
    label: "Unattributed sessions",
    value: unknown,
    hint: "Confirmed unknown — not classified as organic. Needs GA4 channel grouping for true organic.",
    source: "confirmed",
  };
}
