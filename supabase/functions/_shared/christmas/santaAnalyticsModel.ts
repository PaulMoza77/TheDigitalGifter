/** Read-only reporting contract. No payment mutations or visitor-level collection. */
export const SANTA_ZONE = "Europe/Bucharest";
export const SANTA_INITIAL = "christmas_santa_voice_call";
export const SANTA_EXTENSION = "christmas_santa_voice_call_extension";
export type ReportRange = {
  start: string;
  end: string;
  startUtc: string;
  endUtc: string;
  timeZone: string;
};
export type Metric = {
  id: string;
  label: string;
  value: number | null;
  unit: "count" | "RON" | "USD" | "percent";
  source: string;
  definition: string;
  unavailable?: string;
  updatedAt: string | null;
};
export type Order = {
  id: string;
  product_key: string;
  payment_status: string;
  amount_cents: number;
  charged_amount_cents: number | null;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  last_refund_at?: string | null;
  refunded_amount_cents?: number | null;
  metadata?: Record<string, unknown>;
};
export type Call = {
  id: string;
  order_id: string;
  status: string;
  provider: string;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  created_at: string;
  seconds_used: number;
  end_reason: string | null;
  error_code: string | null;
  last_heartbeat_at: string | null;
};
export type FunnelEvent = {
  event_name: string;
  funnel_session_id: string;
  order_id: string | null;
  created_at: string;
  is_test: boolean;
  environment: string | null;
};
export type Integration = {
  status: "connected" | "snapshot" | "unavailable" | "error";
  source: string;
  detail: string;
  updatedAt: string | null;
  metrics: Metric[];
  daily?: Array<{ date: string; value: number }>;
  traffic?: Array<{
    source: string;
    medium: string;
    campaign: string;
    group: string;
    visitors: number;
    sessions: number;
    checkouts: number;
    purchases: number;
  }>;
  devices?: Array<{ device: string; sessions: number }>;
};
export type AdminOrder = Omit<Order, "metadata"> & {
  entitlement: {
    status: string;
    remaining_seconds: number;
    max_duration_seconds: number;
    expires_at: string;
    email_sent_at: string | null;
  } | null;
  session: Call | null;
};
export type AnalyticsReport = {
  ok: true;
  generatedAt: string;
  range: ReportRange;
  metrics: Metric[];
  daily: Array<{
    date: string;
    checkouts: number;
    purchases: number;
    revenue: number;
  }>;
  dropoff: { created: number; paid: number; unpaid: number };
  exclusions: { nonCommercialOrOtherCurrency: number; unverifiedPaid: number };
  orders: AdminOrder[];
  health: {
    pendingEntitlements: number;
    staleSessions: number;
    providerFailures: number;
  };
  calls: Call[];
  pagination: {
    orderPage: number;
    callPage: number;
    pageSize: number;
    orderTotal: number;
    callTotal: number;
  };
  integrations: { ga4: Integration; meta: Integration; clarity: Integration };
};

export function businessDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SANTA_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
function dayShift(date: string, n: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
function midnight(date: string): string {
  let guess = Date.parse(date + "T00:00:00Z");
  const desired = guess;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: SANTA_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const v = (k: string) => p.find((x) => x.type === k)!.value;
    guess +=
      desired -
      Date.parse(
        `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}Z`,
      );
  }
  return new Date(guess).toISOString();
}
export function reportingRange(
  input: { preset?: unknown; start?: unknown; end?: unknown; days?: unknown },
  now = new Date(),
): ReportRange {
  const today = businessDate(now);
  const preset = String(input.preset || input.days || "7");
  let start = today,
    end = today;
  if (preset === "custom") {
    start = String(input.start);
    end = String(input.end);
  } else if (preset === "yesterday") start = end = dayShift(today, -1);
  else if (["today", "1", "7", "30", "90"].includes(preset))
    start = dayShift(today, -(Number(preset === "today" ? 1 : preset) - 1));
  else throw new Error("invalid_date_range");
  for (const d of [start, end])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new Error("invalid_date_range");
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1 || days > 90 || end > today)
    throw new Error("range_must_be_1_to_90_days_not_future");
  return {
    start,
    end,
    startUtc: midnight(start),
    endUtc: midnight(dayShift(end, 1)),
    timeZone: SANTA_ZONE,
  };
}
export function inRange(value: string | null | undefined, r: ReportRange) {
  return Boolean(
    value &&
    Date.parse(value) >= Date.parse(r.startUtc) &&
    Date.parse(value) < Date.parse(r.endUtc),
  );
}
export function isCommercialOrder(o: Order): boolean {
  const m = o.metadata || {};
  return (
    [SANTA_INITIAL, SANTA_EXTENSION].includes(o.product_key) &&
    o.currency.toLowerCase() === "ron" &&
    Boolean(o.stripe_checkout_session_id?.startsWith("cs_live_")) &&
    !["test", "preview"].includes(String(m.stripe_mode || "")) &&
    ![
      "santa_qa",
      "qa",
      "manual_qa",
      "noncommercial",
      "no_charge",
      "harness",
      "email_probe",
      "email_preview_test",
    ].some((k) => m[k] === true || m[k] === "true")
  );
}
export function confirmedPaid(o: Order) {
  return (
    ["paid", "refunded"].includes(o.payment_status) &&
    Boolean(o.paid_at && o.stripe_payment_intent_id?.startsWith("pi_"))
  );
}
export function aggregateSanta(
  orders: Order[],
  calls: Call[],
  range: ReportRange,
  generatedAt: string,
) {
  const live = orders.filter(isCommercialOrder);
  const created = live.filter(
    (o) => o.product_key === SANTA_INITIAL && inRange(o.created_at, range),
  );
  const sessionIds = live.map((o) => o.stripe_checkout_session_id);
  if (new Set(sessionIds).size !== sessionIds.length)
    throw new Error("duplicate_checkout_sessions_in_ledger");
  const paid = live.filter(
    (o) => confirmedPaid(o) && inRange(o.paid_at, range),
  );
  const initialPaid = paid.filter((o) => o.product_key === SANTA_INITIAL);
  const cohortPaid = created.filter(confirmedPaid).length;
  const started = calls.filter((c) => inRange(c.connected_at, range));
  const completed = calls.filter(
    (c) => c.status === "completed" && inRange(c.ended_at, range),
  );
  const failed = calls.filter(
    (c) =>
      ["failed", "orphaned_closed"].includes(c.status) &&
      inRange(c.ended_at || c.created_at, range),
  );
  const amount = (o: Order) => o.charged_amount_cents;
  const revenueKnown = paid.every(
    (o) => Number.isInteger(amount(o)) && Number(amount(o)) >= 0,
  );
  const revenue = revenueKnown
    ? paid.reduce((s, o) => s + Number(amount(o)), 0) / 100
    : null;
  const refunds = live.filter(
    (o) =>
      Number(o.refunded_amount_cents) > 0 &&
      inRange(o.last_refund_at || o.refunded_at, range),
  );
  const source = "Payment ledger · LIVE RON";
  const metric = (
    id: string,
    label: string,
    value: number | null,
    definition: string,
    unit: Metric["unit"] = "count",
    unavailable?: string,
  ): Metric => ({
    id,
    label,
    value,
    unit,
    source,
    definition,
    updatedAt: generatedAt,
    ...(unavailable ? { unavailable } : {}),
  });
  const metrics = [
    metric(
      "stripe_checkouts",
      "Stripe sessions created",
      created.length,
      "Distinct initial LIVE RON Checkout IDs created in the selected period; test and noncommercial orders excluded.",
    ),
    metric(
      "purchases",
      "Confirmed purchases",
      initialPaid.length,
      "Initial orders with paid/refunded state, paid_at and Stripe PaymentIntent; grouped by payment date. Refunds do not erase the original purchase.",
    ),
    metric(
      "abandonment",
      "Checkout abandonment",
      null,
      "Final abandonment requires a reconciled expiry/cancellation signal. Pending sessions are not assumed abandoned.",
      "percent",
      "No reliable terminal checkout status in the ledger",
    ),
    metric(
      "conversion",
      "Checkout conversion",
      created.length ? (cohortPaid / created.length) * 100 : null,
      "Paid initial orders / initial sessions created in this period, observed at report time. Same order cohort; recent sessions may still convert.",
      "percent",
      created.length ? undefined : "No sessions in denominator",
    ),
    metric(
      "revenue",
      "Confirmed revenue",
      revenue,
      "Gross RON actually charged on confirmed initial + extension payments, by paid_at. Before refunds; not accounting net revenue.",
      "RON",
      revenueKnown ? undefined : "Missing verified charged amount",
    ),
    metric(
      "extensions",
      "Paid extensions",
      paid.filter((o) => o.product_key === SANTA_EXTENSION).length,
      "Confirmed LIVE RON extension orders, by paid_at.",
    ),
    metric(
      "refunds",
      "Orders refunded",
      refunds.length,
      "Distinct orders with a recorded refund amount; most recent refund date in range. Not the count of refund transactions.",
    ),
    metric(
      "aov",
      "Average order value",
      paid.length && revenue !== null ? revenue / paid.length : null,
      "Gross confirmed revenue / all confirmed initial + extension orders paid in range.",
      "RON",
      paid.length ? undefined : "No confirmed paid orders",
    ),
    {
      ...metric(
        "calls_started",
        "Calls started",
        started.length,
        "Provider-connected sessions on commercial RON orders, by connected_at; reconnects can create more than one session.",
      ),
      source: "Call runtime ledger",
    },
    {
      ...metric(
        "calls_completed",
        "Calls completed",
        completed.length,
        "Sessions recorded completed, by ended_at. This metric alone does not prove provider termination.",
      ),
      source: "Call runtime ledger",
    },
    {
      ...metric(
        "calls_failed",
        "Errors / interrupted",
        failed.length,
        "Failed or watchdog-closed commercial sessions, by ended_at (created_at if absent).",
      ),
      source: "Call runtime ledger",
    },
  ];
  const daily = [];
  for (let d = range.start; d <= range.end; d = dayShift(d, 1)) {
    const p = paid.filter((o) => businessDate(o.paid_at!) === d);
    daily.push({
      date: d,
      checkouts: created.filter((o) => businessDate(o.created_at) === d).length,
      purchases: initialPaid.filter((o) => businessDate(o.paid_at!) === d)
        .length,
      revenue: p.reduce((s, o) => s + Number(amount(o) || 0), 0) / 100,
    });
  }
  return {
    metrics,
    daily: revenueKnown ? daily : [],
    dropoff: {
      created: created.length,
      paid: cohortPaid,
      unpaid: created.length - cohortPaid,
    },
    exclusions: {
      nonCommercialOrOtherCurrency: orders.length - live.length,
      unverifiedPaid: live.filter(
        (o) => o.payment_status === "paid" && !confirmedPaid(o),
      ).length,
    },
  };
}

export function normalizeSantaPath(raw: string): string | null {
  try {
    const path = new URL(
      raw,
      "https://www.thedigitalgifter.com",
    ).pathname.replace(/\/+$/, "");
    return /^\/(ro\/)?christmas\/santa-call$/.test(path)
      ? "/christmas/santa-call"
      : null;
  } catch {
    return null;
  }
}
export function trafficGroup(source: string, medium: string): string {
  if (
    /^(facebook|instagram|fb|ig|l\.facebook\.com|m\.facebook\.com|l\.instagram\.com|facebook\.com|instagram\.com)$/i.test(
      source,
    )
  )
    return "Facebook / Instagram";
  if (/google/i.test(source) && medium === "organic") return "Google organic";
  if (source === "(direct)" && ["(none)", "(not set)"].includes(medium))
    return "Direct";
  return "Other / referral";
}
