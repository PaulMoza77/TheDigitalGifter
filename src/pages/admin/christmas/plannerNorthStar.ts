import type { ChristmasEventRow, ChristmasOrderRow } from "./christmasAdminTypes";

const LANDING = new Set(["planner_landing_view", "planner_teaser_viewed"]);
const START = new Set(["planner_onboarding_started", "planner_build_started", "planner_cta_clicked"]);
const PREVIEW = new Set(["planner_preview_viewed", "planner_personalization_completed"]);
const CHECKOUT = new Set(["planner_checkout_started", "planner_checkout_viewed"]);
const PURCHASE = new Set(["planner_purchase"]);
const OPENED = new Set(["planner_opened", "planner_dashboard_viewed", "planner_welcome_view"]);

export type PlannerNorthStarKpis = {
  visitors: number;
  starts: number;
  previews: number;
  checkoutStarts: number;
  purchases: number;
  conversionPct: number;
  revenueCents: number;
  aovCents: number;
  bySource: Array<{ source: string; sessions: number }>;
  byDevice: Array<{ device: string; sessions: number }>;
  activations: Array<{ module: string; sessions: number }>;
  dropoff: Array<{ from: string; to: string; lost: number }>;
};

function sessionsFor(events: ChristmasEventRow[], names: Set<string>) {
  return new Set(events.filter((e) => names.has(e.event_name)).map((e) => e.funnel_session_id).filter(Boolean));
}

export function computePlannerNorthStar(input: {
  events: ChristmasEventRow[];
  orders: ChristmasOrderRow[];
}): PlannerNorthStarKpis {
  const events = input.events.filter((e) => !e.is_test);
  const visitors = sessionsFor(events, LANDING);
  const starts = sessionsFor(events, START);
  const previews = sessionsFor(events, PREVIEW);
  const checkout = sessionsFor(events, CHECKOUT);
  const purchases = sessionsFor(events, PURCHASE);
  const opened = sessionsFor(events, OPENED);
  const paid = input.orders.filter((o) => o.payment_status === "paid" && o.amount_cents > 0 && o.product_key.includes("planner"));
  const revenueCents = paid.reduce((s, o) => s + o.amount_cents, 0);
  const purchaseCount = Math.max(purchases.size, paid.length);
  const conversionPct = visitors.size ? Math.round((purchaseCount / visitors.size) * 1000) / 10 : 0;
  const aovCents = paid.length ? Math.round(revenueCents / paid.length) : 0;

  const sourceMap = new Map<string, Set<string>>();
  const deviceMap = new Map<string, Set<string>>();
  const actMap = new Map<string, Set<string>>();
  for (const row of events) {
    const src = row.utm_source || "direct";
    if (!sourceMap.has(src)) sourceMap.set(src, new Set());
    sourceMap.get(src)!.add(row.funnel_session_id);
    const device = row.device_type || "unknown";
    if (!deviceMap.has(device)) deviceMap.set(device, new Set());
    deviceMap.get(device)!.add(row.funnel_session_id);
    if (row.event_name === "planner_module_opened") {
      const module = String(row.metadata?.module || row.metadata?.activation || "unknown");
      if (!actMap.has(module)) actMap.set(module, new Set());
      actMap.get(module)!.add(row.funnel_session_id);
    }
    if (row.event_name === "affiliate_product_clicked") {
      if (!actMap.has("affiliate_click")) actMap.set("affiliate_click", new Set());
      actMap.get("affiliate_click")!.add(row.funnel_session_id);
    }
  }

  const sizes = [visitors.size, starts.size, previews.size, checkout.size, purchaseCount, opened.size];
  const labels = ["landing", "start", "preview", "checkout", "purchase", "opened"];
  const dropoff: PlannerNorthStarKpis["dropoff"] = [];
  for (let i = 0; i < sizes.length - 1; i++) {
    dropoff.push({ from: labels[i], to: labels[i + 1], lost: Math.max(0, sizes[i] - sizes[i + 1]) });
  }

  return {
    visitors: visitors.size,
    starts: starts.size,
    previews: previews.size,
    checkoutStarts: checkout.size,
    purchases: purchaseCount,
    conversionPct,
    revenueCents,
    aovCents,
    bySource: [...sourceMap.entries()].map(([source, set]) => ({ source, sessions: set.size })).sort((a, b) => b.sessions - a.sessions),
    byDevice: [...deviceMap.entries()].map(([device, set]) => ({ device, sessions: set.size })).sort((a, b) => b.sessions - a.sessions),
    activations: [...actMap.entries()].map(([module, set]) => ({ module, sessions: set.size })).sort((a, b) => b.sessions - a.sessions),
    dropoff,
  };
}
