import {
  aggregateSanta,
  inRange,
  isCommercialOrder,
  reportingRange,
  SANTA_INITIAL,
  SANTA_EXTENSION,
  type AnalyticsReport,
  type Call,
  type Order,
} from "./santaAnalyticsModel.ts";
import { reportingSources } from "./santaAnalyticsSources.ts";
import { snapshotForRange } from "./santaAnalyticsSnapshot.ts";

const ORDER_COLUMNS =
  "id,product_key,payment_status,amount_cents,charged_amount_cents,currency,stripe_checkout_session_id,stripe_payment_intent_id,created_at,paid_at,refunded_at,last_refund_at,refunded_amount_cents,metadata";
const CALL_COLUMNS =
  "id,order_id,status,provider,started_at,connected_at,ended_at,created_at,seconds_used,end_reason,error_code,last_heartbeat_at";
const LIMIT = 10000,
  BATCH = 500;

/** Always detect truncation. Smaller ranges are required above the explicit safety cap. */
export async function boundedRows<T>(query: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset <= LIMIT; offset += BATCH) {
    const result = await query()
      .range(offset, offset + BATCH - 1)
      .abortSignal(AbortSignal.timeout(10000));
    if (result.error) throw new Error("report_database_read_failed");
    if (!Array.isArray(result.data))
      throw new Error("report_database_shape_invalid");
    rows.push(...result.data);
    if (rows.length > LIMIT)
      throw new Error("report_limit_exceeded_select_shorter_range");
    if (result.data.length < BATCH) return rows;
  }
  throw new Error("report_limit_exceeded_select_shorter_range");
}
export async function santaAdminReport(
  service: any,
  input: Record<string, unknown>,
  env: (key: string) => string | undefined,
  connectorSnapshot?: string,
): Promise<AnalyticsReport> {
  const generatedAt = new Date().toISOString();
  const range = reportingRange(input, new Date(generatedAt));
  const dateOr = (cols: string[]) =>
    cols
      .map((c) => `and(${c}.gte.${range.startUtc},${c}.lt.${range.endUtc})`)
      .join(",");
  const [orders, sessions] = await Promise.all([
    boundedRows<Order>(() =>
      service
        .from("christmas_orders")
        .select(ORDER_COLUMNS)
        .in("product_key", [SANTA_INITIAL, SANTA_EXTENSION])
        .or(dateOr(["created_at", "paid_at", "refunded_at", "last_refund_at"]))
        .order("id"),
    ),
    boundedRows<Call>(() =>
      service
        .from("christmas_santa_call_sessions")
        .select(CALL_COLUMNS)
        .or(dateOr(["created_at", "connected_at", "ended_at"]))
        .order("id"),
    ),
  ]);
  const linked = new Map(orders.map((o) => [o.id, o]));
  const missing = [...new Set(sessions.map((s) => s.order_id))].filter(
    (id) => !linked.has(id),
  );
  for (let offset = 0; offset < missing.length; offset += BATCH) {
    const result = await service
      .from("christmas_orders")
      .select(ORDER_COLUMNS)
      .in("id", missing.slice(offset, offset + BATCH))
      .abortSignal(AbortSignal.timeout(10000));
    if (
      result.error ||
      result.data.length !== missing.slice(offset, offset + BATCH).length
    )
      throw new Error("report_call_order_link_incomplete");
    for (const row of result.data) linked.set(row.id, row);
  }
  const calls = sessions
    .filter((c) => {
      const o = linked.get(c.order_id);
      return o && isCommercialOrder(o);
    })
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const commercial = orders
    .filter(isCommercialOrder)
    .filter((o) => inRange(o.created_at, range))
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const entitlements = new Map<
    string,
    {
      order_id: string;
      status: string;
      remaining_seconds: number;
      max_duration_seconds: number;
      expires_at: string;
      email_sent_at: string | null;
    }
  >();
  for (let offset = 0; offset < commercial.length; offset += BATCH) {
    const result = await service
      .from("christmas_santa_call_entitlements")
      .select(
        "order_id,status,remaining_seconds,max_duration_seconds,expires_at,email_sent_at",
      )
      .in(
        "order_id",
        commercial.slice(offset, offset + BATCH).map((o) => o.id),
      )
      .limit(BATCH)
      .abortSignal(AbortSignal.timeout(10000));
    if (result.error) throw new Error("report_entitlement_read_failed");
    for (const row of result.data) entitlements.set(row.order_id, row);
  }
  const page = (key: string) => {
    const p = Number(input[key] || 1);
    if (!Number.isInteger(p) || p < 1 || p > 400)
      throw new Error("invalid_page");
    return p;
  };
  const orderPage = page("orderPage"),
    callPage = page("callPage"),
    pageSize = 25;
  const integrations = { ...(await reportingSources(range, env)) };
  if (connectorSnapshot) {
    const snapshot = snapshotForRange(connectorSnapshot, range);
    if (integrations.ga4.status !== "connected" && snapshot.ga4)
      integrations.ga4 = snapshot.ga4;
    if (integrations.meta.status !== "connected" && snapshot.meta)
      integrations.meta = snapshot.meta;
  }
  return {
    ok: true,
    generatedAt,
    range,
    ...aggregateSanta(orders, calls, range, generatedAt),
    integrations,
    // Explicit allowlisted columns only; payment metadata never leaves the server.
    orders: commercial
      .slice((orderPage - 1) * pageSize, orderPage * pageSize)
      .map(({ metadata: _private, ...o }) => ({
        ...o,
        entitlement: entitlements.get(o.id) || null,
        session: calls.find((c) => c.order_id === o.id) || null,
      })),
    calls: calls.slice((callPage - 1) * pageSize, callPage * pageSize),
    health: {
      pendingEntitlements: [...entitlements.values()].filter(
        (e) => e.status === "pending_payment",
      ).length,
      staleSessions: calls.filter(
        (c) =>
          [
            "connecting",
            "connected",
            "listening",
            "speaking",
            "reconnecting",
          ].includes(c.status) &&
          Date.now() - Date.parse(c.last_heartbeat_at || c.created_at) > 90000,
      ).length,
      providerFailures: calls.filter((c) => c.error_code).length,
    },
    pagination: {
      orderPage,
      callPage,
      pageSize,
      orderTotal: commercial.length,
      callTotal: calls.length,
    },
  };
}
