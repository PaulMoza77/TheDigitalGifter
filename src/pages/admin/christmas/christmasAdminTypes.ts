export type RangeDays = 1 | 7 | 30 | 0;
export type Platform = "all" | "web" | "ios";

export type ChristmasEventRow = {
  id: string;
  event_name: string;
  funnel_session_id: string;
  product_key: string | null;
  package_key: string | null;
  order_id: string | null;
  locale: string | null;
  pathname: string | null;
  device_type: string | null;
  amount_cents: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  is_test: boolean;
  environment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ChristmasOrderRow = {
  id: string;
  product_key: string;
  package_key: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  last_error: string | null;
  source_route: string | null;
  landing_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  paid_at: string | null;
  delivery_email_sent_at: string | null;
};

export type ChristmasEmailRow = {
  id: string;
  order_id: string;
  kind: string;
  status: string;
  last_error?: string | null;
  created_at: string;
  sent_at?: string | null;
};

export type ChristmasCostRow = {
  cost_usd: number | null;
  product_family: string | null;
  model_name: string | null;
  is_mock: boolean | null;
  occurred_at?: string | null;
  started_at?: string | null;
};

export type ChristmasSantaCostRow = {
  cost_total_usd: number | null;
  created_at: string;
};

export type ChristmasClubSignupRow = {
  id: string;
  created_at: string;
  source: string | null;
  status: string | null;
};

export const VIEW_EVENTS = new Set([
  "christmas_page_view",
  "christmas_home_view",
  "christmas_landing_view",
  "christmas_photo_page_view",
  "christmas_santa_page_view",
  "christmas_family_page_view",
  "christmas_couple_page_view",
  "christmas_pet_page_view",
  "christmas_v2_view",
  "planner_landing_view",
  "gift_finder_page_view",
  "wishlist_page_view",
  "christmas_card_page_view",
  "christmas_message_page_view",
  "christmas_tree_view",
  "christmas_gift_tree_view",
  "christmas_photo_generator_page_view",
]);

export function eventPlatform(row: ChristmasEventRow): "web" | "ios" {
  const platform = String(row.metadata?.platform || "").toLowerCase();
  const source = String(row.metadata?.source || "").toLowerCase();
  return platform === "ios" || source === "tdg_app" || row.pathname?.startsWith("tdg_app://") || row.device_type === "ios"
    ? "ios"
    : "web";
}

export function orderPlatform(row: ChristmasOrderRow): "web" | "ios" {
  const platform = String(row.metadata?.platform || "").toLowerCase();
  const source = String(row.metadata?.source || "").toLowerCase();
  return platform === "ios" || source === "tdg_app" || row.source_route?.startsWith("tdg_app://") || row.landing_path?.startsWith("tdg_app://")
    ? "ios"
    : "web";
}

export function isTestOrder(row: ChristmasOrderRow): boolean {
  return row.amount_cents === 0 || row.metadata?.is_test === true || row.metadata?.test === true;
}

export function moneyByCurrency(rows: ChristmasOrderRow[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = (row.currency || "usd").toUpperCase();
    totals.set(currency, (totals.get(currency) || 0) + row.amount_cents);
  }
  if (!totals.size) return "—";
  return [...totals.entries()]
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
}

export function formatMoney(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function pct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";
}

export function sinceIso(days: RangeDays): string | null {
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
}
