import {
  VIEW_EVENTS,
  isTestOrder,
  type ChristmasEventRow,
  type ChristmasOrderRow,
} from "../christmasAdminTypes";

export type SiteAnalytics = {
  totals: {
    visitors: number | null;
    sessions: number;
    pageViews: number;
    events: number;
    ctaClicks: number;
    addToCart: number;
    purchases: number;
    revenueLabel: string;
    engagementSeconds: number | null;
    conversionRate: number | null;
  };
  trend: {
    day: string;
    visitors: number | null;
    sessions: number;
    views: number;
  }[];
  pages: {
    path: string;
    views: number;
    sessions: number;
    avgEngagementSeconds: number | null;
    ctaClicks: number;
    purchases: number;
  }[];
  products: {
    id: string;
    name: string;
    views: number;
    selections: number;
    adds: number;
    revenueLabel: string;
  }[];
  sources: {
    source: string;
    sessions: number;
    purchases: number;
    revenueLabel: string;
  }[];
  exits: { path: string; sessions: number; share: number }[];
  funnel: { key: string; label: string; sessions: number }[];
  issues: { event: string; count: number }[];
};
const isView = (r: ChristmasEventRow) =>
  VIEW_EVENTS.has(r.event_name) ||
  r.event_name === "christmas_product_view" ||
  r.event_name.endsWith("page_view");
const isCta = (r: ChristmasEventRow) =>
  r.event_name === "product_selected" ||
  /(?:cta_click|style_selected|product_selected)$/.test(r.event_name);
const isForm = (r: ChristmasEventRow) =>
  /(?:form_start(?:ed)?|upload_completed)$/.test(r.event_name);
const isCheckout = (r: ChristmasEventRow) =>
  /(?:checkout_started|checkout_session_created)$/.test(r.event_name);
const sessionIds = (rows: ChristmasEventRow[]) =>
  new Set(rows.map((r) => r.funnel_session_id).filter(Boolean));
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const reportDay = (iso: string) => dayFormatter.format(new Date(iso));
const pathOf = (path: string | null) => path?.split(/[?#]/)[0] || null;
const revenue = (orders: ChristmasOrderRow[]) => {
  const sums = new Map<string, number>();
  for (const r of orders) {
    const c = (r.currency || "RON").toUpperCase();
    sums.set(c, (sums.get(c) || 0) + r.amount_cents / 100);
  }
  return sums.size
    ? [...sums]
        .map(
          ([c, n]) =>
            `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n)} ${c}`,
        )
        .join(" + ")
    : "0 RON";
};

/** Read-only adapter. Missing visitor/duration measurements stay null; payments come only from paid orders. */
export function buildAnalyticsReport(
  rawEvents: ChristmasEventRow[],
  rawOrders: ChristmasOrderRow[],
  days: 7 | 30 | 90,
  page = "",
  now = new Date(),
): SiteAnalytics {
  const events = rawEvents
    .filter(
      (r) =>
        !r.is_test &&
        r.environment !== "test" &&
        !pathOf(r.pathname)?.startsWith("/admin"),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const paid = rawOrders.filter(
    (r) => !isTestOrder(r) && r.payment_status === "paid" && r.amount_cents > 0,
  );
  const orderSession = new Map<string, string>();
  const sessionPath = new Map<string, string>();
  const sessionSource = new Map<string, string>();
  const lastPath = new Map<string, string>();
  for (const e of events) {
    if (!e.funnel_session_id) continue;
    const p = pathOf(e.pathname);
    if (p) {
      if (!sessionPath.has(e.funnel_session_id))
        sessionPath.set(e.funnel_session_id, p);
      lastPath.set(e.funnel_session_id, p);
    }
    if (e.order_id) orderSession.set(e.order_id, e.funnel_session_id);
    if (e.utm_source && !sessionSource.has(e.funnel_session_id))
      sessionSource.set(
        e.funnel_session_id,
        [e.utm_source, e.utm_campaign].filter(Boolean).join(" / "),
      );
  }
  for (const o of paid) {
    const sid = o.metadata?.funnel_session_id;
    if (typeof sid === "string" && sid) orderSession.set(o.id, sid);
  }
  const orderPath = (o: ChristmasOrderRow) =>
    pathOf(o.landing_path) ||
    pathOf(o.source_route) ||
    sessionPath.get(orderSession.get(o.id) || "") ||
    null;
  const selectedEvents = events.filter(
    (r) => !page || pathOf(r.pathname) === page,
  );
  const selectedPaid = paid.filter((r) => !page || orderPath(r) === page);
  const sessions = sessionIds(selectedEvents);
  const views = selectedEvents.filter(isView);
  const viewedSessions = sessionIds(views);
  const ctaSessions = sessionIds(selectedEvents.filter(isCta));
  const formSessions = sessionIds(selectedEvents.filter(isForm));
  const checkoutSessions = sessionIds(selectedEvents.filter(isCheckout));
  // Funnel is one linked session cohort, not unrelated event totals.
  const ctaCohort = new Set(
    [...ctaSessions].filter((s) => viewedSessions.has(s)),
  );
  const formCohort = new Set([...formSessions].filter((s) => ctaCohort.has(s)));
  const checkoutCohort = new Set(
    [...checkoutSessions].filter((s) => formCohort.has(s)),
  );
  const purchasedSessions = new Set(
    selectedPaid
      .map((o) => orderSession.get(o.id))
      .filter((s): s is string => Boolean(s)),
  );
  const paidCohort = [...purchasedSessions].filter((s) =>
    checkoutCohort.has(s),
  );
  const groupedPages = new Map<string, ChristmasEventRow[]>();
  for (const e of selectedEvents) {
    const p = pathOf(e.pathname);
    if (p) groupedPages.set(p, [...(groupedPages.get(p) || []), e]);
  }
  const sourceIds = new Map<string, Set<string>>();
  for (const s of sessions) {
    const source = sessionSource.get(s) || "Direct / necunoscut";
    if (!sourceIds.has(source)) sourceIds.set(source, new Set());
    sourceIds.get(source)!.add(s);
  }
  const exitCounts = new Map<string, number>();
  for (const s of sessions) {
    const p = lastPath.get(s);
    if (p && !purchasedSessions.has(s))
      exitCounts.set(p, (exitCounts.get(p) || 0) + 1);
  }
  const exitsTotal = [...exitCounts.values()].reduce((a, b) => a + b, 0);
  const issueCounts = new Map<string, number>();
  for (const e of selectedEvents)
    if (/(?:checkout|payment).*(?:error|failed|cancel)/.test(e.event_name))
      issueCounts.set(e.event_name, (issueCounts.get(e.event_name) || 0) + 1);
  const dailyRows = new Map<string, ChristmasEventRow[]>();
  for (const row of selectedEvents) {
    const day = reportDay(row.created_at);
    if (!dailyRows.has(day)) dailyRows.set(day, []);
    dailyRows.get(day)!.push(row);
  }
  const today = reportDay(now.toISOString());
  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const day = d.toISOString().slice(0, 10);
    const rows = dailyRows.get(day) || [];
    return {
      day,
      visitors: null,
      sessions: sessionIds(rows).size,
      views: rows.filter(isView).length,
    };
  });
  const keys = new Set(
    [
      ...selectedEvents.map((r) => r.product_key),
      ...selectedPaid.map((r) => r.product_key),
    ].filter((s): s is string => Boolean(s)),
  );
  return {
    totals: {
      visitors: null,
      sessions: sessions.size,
      pageViews: views.length,
      events: selectedEvents.length,
      ctaClicks: selectedEvents.filter(isCta).length,
      addToCart: formSessions.size,
      purchases: selectedPaid.length,
      revenueLabel: revenue(selectedPaid),
      engagementSeconds: null,
      conversionRate: viewedSessions.size
        ? (100 *
            [...purchasedSessions].filter((s) => viewedSessions.has(s))
              .length) /
          viewedSessions.size
        : null,
    },
    trend,
    pages: [...groupedPages]
      .map(([path, rows]) => ({
        path,
        views: rows.filter(isView).length,
        sessions: sessionIds(rows).size,
        avgEngagementSeconds: null,
        ctaClicks: rows.filter(isCta).length,
        purchases: selectedPaid.filter((o) => orderPath(o) === path).length,
      }))
      .sort((a, b) => b.views - a.views),
    products: [...keys].map((id) => {
      const rows = selectedEvents.filter((r) => r.product_key === id);
      return {
        id,
        name:
          id === "christmas_santa_voice_call"
            ? "Apel cu Moș Crăciun"
            : id.replace(/^christmas_/, "").replaceAll("_", " "),
        views: rows.filter(isView).length,
        selections: rows.filter(isCta).length,
        adds: sessionIds(rows.filter(isForm)).size,
        revenueLabel: revenue(selectedPaid.filter((r) => r.product_key === id)),
      };
    }),
    sources: [...sourceIds]
      .map(([source, ids]) => {
        const orders = selectedPaid.filter((o) =>
          ids.has(orderSession.get(o.id) || ""),
        );
        return {
          source,
          sessions: ids.size,
          purchases: orders.length,
          revenueLabel: revenue(orders),
        };
      })
      .sort((a, b) => b.sessions - a.sessions),
    exits: [...exitCounts]
      .map(([path, sessions]) => ({
        path,
        sessions,
        share: exitsTotal ? Math.round((sessions / exitsTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions),
    funnel: [
      { key: "landing", label: "Vizite pagină", sessions: viewedSessions.size },
      { key: "product", label: "Interes produs", sessions: ctaCohort.size },
      {
        key: "form",
        label: "Personalizare începută",
        sessions: formCohort.size,
      },
      {
        key: "checkout",
        label: "Checkout început",
        sessions: checkoutCohort.size,
      },
      {
        key: "purchase",
        label: "Comandă plătită",
        sessions: paidCohort.length,
      },
    ],
    issues: [...issueCounts].map(([event, count]) => ({ event, count })),
  };
}
