/**
 * Christmas founder KPI source-of-truth matrix + pure aggregators.
 * Task: TDG-CHRISTMAS-GAP-ADMIN-KPIS-013
 *
 * Commercial truth = christmas_orders (payment/fulfillment).
 * Funnel stage counts = christmas_funnel_events (aggregate, not cohort-exact).
 * Lifecycle email health = christmas_lifecycle_events.
 */

export type ChristmasKpiDatePreset = "today" | "7d" | "30d" | "all";

export type ChristmasFunnelEventRow = {
  event_name: string;
  funnel_session_id: string | null;
  order_id: string | null;
  product_key: string | null;
  package_key: string | null;
  amount_cents: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  is_test: boolean | null;
  created_at: string;
  idempotency_key?: string | null;
};

export type ChristmasOrderKpiRow = {
  id: string;
  product_key: string;
  package_key: string | null;
  amount_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  stripe_checkout_session_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
  paid_at: string | null;
  refunded_at?: string | null;
};

export type ChristmasLifecycleKpiRow = {
  template_key: string;
  status: string;
  locale: string;
  created_at: string;
};

/** Documented source matrix — do not invent stages without a real field. */
export const CHRISTMAS_KPI_SOURCE_MATRIX = [
  {
    stage: "landing/session entry",
    source: "christmas_funnel_events.event_name=christmas_page_view",
    id: "funnel_session_id",
    reliability: "aggregate",
  },
  {
    stage: "upload complete",
    source: "christmas_funnel_events.event_name=upload_completed",
    id: "funnel_session_id",
    reliability: "aggregate",
  },
  {
    stage: "generation start (client)",
    source: "christmas_funnel_events.event_name=generation_started",
    id: "funnel_session_id / order_id optional",
    reliability: "aggregate",
  },
  {
    stage: "generation complete (client)",
    source: "christmas_funnel_events.event_name=generation_success",
    id: "funnel_session_id / order_id optional",
    reliability: "aggregate",
  },
  {
    stage: "preview/teaser",
    source: "christmas_funnel_events.event_name=preview_seen",
    id: "funnel_session_id",
    reliability: "aggregate",
  },
  {
    stage: "offer viewed",
    source: "christmas_funnel_events.event_name=offer_seen",
    id: "funnel_session_id",
    reliability: "aggregate",
  },
  {
    stage: "checkout CTA",
    source: "christmas_funnel_events.event_name=checkout_started",
    id: "funnel_session_id",
    reliability: "aggregate",
  },
  {
    stage: "Stripe checkout session created",
    source: "christmas_orders.stripe_checkout_session_id IS NOT NULL",
    id: "christmas_orders.id",
    reliability: "authoritative",
  },
  {
    stage: "payment completed / paid order",
    source: "christmas_orders.payment_status=paid",
    id: "christmas_orders.id",
    reliability: "authoritative",
  },
  {
    stage: "delivery/completion",
    source: "christmas_orders.fulfillment_status=completed",
    id: "christmas_orders.id",
    reliability: "authoritative",
  },
  {
    stage: "refund",
    source: "christmas_orders.payment_status=refunded",
    id: "christmas_orders.id",
    reliability: "authoritative_status_only",
  },
  {
    stage: "abandoned checkout (engine)",
    source: "payment_status pending + stripe session; lifecycle abandoned_checkout",
    id: "order id",
    reliability: "derived",
  },
] as const;

export function rangeForChristmasKpiPreset(
  preset: ChristmasKpiDatePreset,
  now = new Date(),
): { from: Date | null; to: Date } {
  const to = now;
  if (preset === "all") return { from: null, to };
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (preset === "today") return { from: start, to };
  const days = preset === "30d" ? 30 : 7;
  return { from: new Date(start.getTime() - (days - 1) * 86400000), to };
}

function inRange(iso: string, from: Date | null, to: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (t > to.getTime()) return false;
  if (from && t < from.getTime()) return false;
  return true;
}

function uniqueCount(values: Array<string | null | undefined>): number {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v || "").trim();
    if (s) set.add(s);
  }
  return set.size;
}

function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

export type ChristmasKpiSnapshot = {
  rangeLabel: string;
  progressionMode: "aggregate_stage_ratio";
  progressionCaveat: string;
  funnel: {
    entriesSessions: number;
    uploads: number;
    generationsStarted: number;
    generationsCompleted: number;
    previews: number;
    offers: number;
    checkoutStarts: number;
    clientPurchaseEvents: number;
  };
  commercial: {
    checkoutSessionsCreated: number;
    paidOrders: number;
    deliveredOrders: number;
    abandonedCheckouts: number;
    grossRevenueCents: number;
    aovCents: number | null;
    refundOrders: number;
    refundAmountCents: number;
    refundRate: number | null;
    freeOrders: number;
    paidOrdersNonZero: number;
  };
  checkoutHealth: {
    checkoutToPaidPct: number | null;
    abandonedPct: number | null;
    zeroPurchaseSessions: number;
  };
  packageMix: Array<{
    productKey: string;
    packageKey: string;
    orders: number;
    revenueCents: number;
    mixPct: number | null;
  }>;
  attribution: {
    byUtmSource: Array<{ source: string; paidOrders: number; revenueCents: number }>;
    unsupported: string[];
  };
  lifecycleEmail: {
    byTemplateStatus: Array<{ template: string; status: string; count: number }>;
  };
  progression: Array<{
    from: string;
    to: string;
    fromCount: number;
    toCount: number;
    ratio: number | null;
  }>;
  health: {
    largestDropoff: string | null;
    weakestProgression: string | null;
    checkoutCreatedToPaid: number | null;
    silentStages: string[];
  };
  telemetryQuality: string[];
};

export function buildChristmasKpiSnapshot(input: {
  preset: ChristmasKpiDatePreset;
  now?: Date;
  events: ChristmasFunnelEventRow[];
  orders: ChristmasOrderKpiRow[];
  lifecycle?: ChristmasLifecycleKpiRow[];
}): ChristmasKpiSnapshot {
  const now = input.now || new Date();
  const { from, to } = rangeForChristmasKpiPreset(input.preset, now);
  const rangeLabel =
    input.preset === "all"
      ? "All time"
      : input.preset === "today"
        ? "Today"
        : input.preset === "30d"
          ? "Last 30 days"
          : "Last 7 days";

  const events = input.events.filter(
    (e) => !e.is_test && inRange(e.created_at, from, to),
  );
  const orders = input.orders.filter((o) =>
    inRange(o.paid_at || o.created_at, from, to),
  );

  const sessionsFor = (name: string) =>
    uniqueCount(
      events.filter((e) => e.event_name === name).map((e) => e.funnel_session_id),
    );

  const funnel = {
    entriesSessions: sessionsFor("christmas_page_view"),
    uploads: sessionsFor("upload_completed"),
    generationsStarted: sessionsFor("generation_started"),
    generationsCompleted: sessionsFor("generation_success"),
    previews: sessionsFor("preview_seen"),
    offers: sessionsFor("offer_seen"),
    checkoutStarts: sessionsFor("checkout_started"),
    clientPurchaseEvents: sessionsFor("purchase"),
  };

  const withSession = orders.filter((o) =>
    Boolean(String(o.stripe_checkout_session_id || "").trim()),
  );
  const paid = orders.filter((o) => o.payment_status === "paid");
  const delivered = orders.filter(
    (o) => o.payment_status === "paid" && o.fulfillment_status === "completed",
  );
  const refunded = orders.filter((o) => o.payment_status === "refunded");
  const abandoned = withSession.filter((o) => o.payment_status === "pending");
  const grossRevenueCents = paid.reduce((s, o) => s + (Number(o.amount_cents) || 0), 0);
  const refundAmountCents = refunded.reduce(
    (s, o) => s + (Number(o.amount_cents) || 0),
    0,
  );
  const freeOrders = paid.filter((o) => (Number(o.amount_cents) || 0) <= 0).length;
  const paidOrdersNonZero = paid.filter((o) => (Number(o.amount_cents) || 0) > 0).length;

  const commercial = {
    checkoutSessionsCreated: withSession.length,
    paidOrders: paid.length,
    deliveredOrders: delivered.length,
    abandonedCheckouts: abandoned.length,
    grossRevenueCents,
    aovCents: paid.length ? Math.round(grossRevenueCents / paid.length) : null,
    refundOrders: refunded.length,
    refundAmountCents,
    refundRate: ratio(refunded.length, paid.length + refunded.length),
    freeOrders,
    paidOrdersNonZero,
  };

  const checkoutHealth = {
    checkoutToPaidPct: ratio(paid.length, withSession.length),
    abandonedPct: ratio(abandoned.length, withSession.length),
    zeroPurchaseSessions: Math.max(withSession.length - paid.length, 0),
  };

  const packageMap = new Map<
    string,
    { productKey: string; packageKey: string; orders: number; revenueCents: number }
  >();
  for (const o of paid) {
    const packageKey = o.package_key || "unknown";
    const key = `${o.product_key}::${packageKey}`;
    const cur = packageMap.get(key) || {
      productKey: o.product_key,
      packageKey,
      orders: 0,
      revenueCents: 0,
    };
    cur.orders += 1;
    cur.revenueCents += Number(o.amount_cents) || 0;
    packageMap.set(key, cur);
  }
  const packageMix = [...packageMap.values()]
    .map((row) => ({
      ...row,
      mixPct: ratio(row.orders, paid.length),
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const utmMap = new Map<string, { paidOrders: number; revenueCents: number }>();
  for (const o of paid) {
    const source = String(o.utm_source || "").trim() || "unknown";
    const cur = utmMap.get(source) || { paidOrders: 0, revenueCents: 0 };
    cur.paidOrders += 1;
    cur.revenueCents += Number(o.amount_cents) || 0;
    utmMap.set(source, cur);
  }
  const byUtmSource = [...utmMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.paidOrders - a.paidOrders);

  const lifecycle = (input.lifecycle || []).filter((r) =>
    inRange(r.created_at, from, to),
  );
  const lifeMap = new Map<string, number>();
  for (const row of lifecycle) {
    const key = `${row.template_key}::${row.status}`;
    lifeMap.set(key, (lifeMap.get(key) || 0) + 1);
  }
  const byTemplateStatus = [...lifeMap.entries()]
    .map(([key, count]) => {
      const [template, status] = key.split("::");
      return { template, status, count };
    })
    .sort((a, b) => b.count - a.count);

  const progressionDefs: Array<{ from: string; to: string; fromCount: number; toCount: number }> =
    [
      {
        from: "entry",
        to: "upload",
        fromCount: funnel.entriesSessions,
        toCount: funnel.uploads,
      },
      {
        from: "upload",
        to: "preview",
        fromCount: funnel.uploads,
        toCount: funnel.previews,
      },
      {
        from: "preview",
        to: "offer",
        fromCount: funnel.previews,
        toCount: funnel.offers,
      },
      {
        from: "offer",
        to: "checkout_cta",
        fromCount: funnel.offers,
        toCount: funnel.checkoutStarts,
      },
      {
        from: "checkout_session",
        to: "paid",
        fromCount: commercial.checkoutSessionsCreated,
        toCount: commercial.paidOrders,
      },
      {
        from: "entry",
        to: "paid",
        fromCount: funnel.entriesSessions,
        toCount: commercial.paidOrders,
      },
    ];
  const progression = progressionDefs.map((p) => ({
    ...p,
    ratio: ratio(p.toCount, p.fromCount),
  }));

  let largestDropoff: string | null = null;
  let weakestProgression: string | null = null;
  let worstDrop = -1;
  let weakest = 2;
  for (const p of progression) {
    if (p.fromCount > 0 && p.ratio != null) {
      const drop = 1 - p.ratio;
      if (drop > worstDrop) {
        worstDrop = drop;
        largestDropoff = `${p.from} → ${p.to} (−${Math.round(drop * 100)}% aggregate)`;
      }
      if (p.ratio < weakest) {
        weakest = p.ratio;
        weakestProgression = `${p.from} → ${p.to} (${Math.round(p.ratio * 100)}% aggregate)`;
      }
    }
  }

  const silentStages: string[] = [];
  if (funnel.entriesSessions > 0 && funnel.uploads === 0) {
    silentStages.push("uploads (traffic with zero upload_completed)");
  }
  if (funnel.checkoutStarts > 0 && commercial.checkoutSessionsCreated === 0) {
    silentStages.push(
      "checkout sessions (CTA events but no stripe_checkout_session_id on orders)",
    );
  }
  if (commercial.checkoutSessionsCreated > 0 && commercial.paidOrders === 0) {
    silentStages.push("paid orders (checkout sessions with zero paid)");
  }
  if (commercial.paidOrders > 0 && commercial.deliveredOrders === 0) {
    silentStages.push("delivery (paid with zero fulfillment completed)");
  }

  const telemetryQuality: string[] = [
    "Funnel stage ratios are AGGREGATE unique-session counts, not cohort-exact conversion.",
    "Client `purchase` events are not commercial truth — use christmas_orders.payment_status=paid.",
    "order_id is optional on many funnel events — session→order linkage is incomplete.",
    "Refund amount uses order amount_cents at refunded status; partial refunds are not modeled.",
    "Upsell/extra-gift revenue is not separately instrumented for Christmas commerce (unknown).",
    "Country/market not stored on christmas_orders / funnel events (unsupported).",
    "Device breakdown available only when device_type is present on events.",
    "is_test=true funnel events are excluded; orders have no dedicated test marker.",
  ];
  if (funnel.clientPurchaseEvents !== commercial.paidOrders) {
    telemetryQuality.push(
      `Client purchase sessions (${funnel.clientPurchaseEvents}) ≠ paid orders (${commercial.paidOrders}) — instrumentation mismatch risk.`,
    );
  }
  const eventsMissingSession = events.filter((e) => !e.funnel_session_id).length;
  if (eventsMissingSession > 0) {
    telemetryQuality.push(
      `${eventsMissingSession} funnel events missing funnel_session_id in range.`,
    );
  }

  return {
    rangeLabel,
    progressionMode: "aggregate_stage_ratio",
    progressionCaveat:
      "Stage progression uses unique funnel_session_id counts per event — not exact same-user cohort conversion.",
    funnel,
    commercial,
    checkoutHealth,
    packageMix,
    attribution: {
      byUtmSource,
      unsupported: ["country/market", "browser detail", "upsell revenue split"],
    },
    lifecycleEmail: { byTemplateStatus },
    progression,
    health: {
      largestDropoff,
      weakestProgression,
      checkoutCreatedToPaid: checkoutHealth.checkoutToPaidPct,
      silentStages,
    },
    telemetryQuality,
  };
}

export function formatCents(cents: number, currency = "usd"): string {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}
