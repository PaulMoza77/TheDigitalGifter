/**
 * Admin Christmas KPI data access.
 * Supabase lives here only — pages must not query tables directly.
 * Selects are an allowlist: no emails, tokens, media paths, or metadata blobs.
 */

import { supabase } from "@/lib/supabase";
import type { ChristmasFunnelEventRow, ChristmasOrderKpiRow } from "./kpiCore";
import {
  assertChristmasKpiSelectSafe,
  CHRISTMAS_KPI_FUNNEL_SELECT,
  CHRISTMAS_KPI_ORDER_SELECT,
} from "./kpiSelect";

export {
  assertChristmasKpiSelectSafe,
  CHRISTMAS_KPI_FORBIDDEN_SELECT_FIELDS,
  CHRISTMAS_KPI_FUNNEL_SELECT,
  CHRISTMAS_KPI_ORDER_SELECT,
} from "./kpiSelect";

const KPI_ROW_LIMIT = 5000;

export type ChristmasKpiLoadResult = {
  events: ChristmasFunnelEventRow[];
  orders: ChristmasOrderKpiRow[];
  errors: string[];
};

export async function loadChristmasKpiSources(): Promise<ChristmasKpiLoadResult> {
  assertChristmasKpiSelectSafe(CHRISTMAS_KPI_FUNNEL_SELECT);
  assertChristmasKpiSelectSafe(CHRISTMAS_KPI_ORDER_SELECT);

  const [evRes, ordRes] = await Promise.all([
    supabase
      .from("christmas_funnel_events")
      .select(CHRISTMAS_KPI_FUNNEL_SELECT)
      .order("created_at", { ascending: false })
      .limit(KPI_ROW_LIMIT),
    supabase
      .from("christmas_orders")
      .select(CHRISTMAS_KPI_ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(KPI_ROW_LIMIT),
  ]);

  const errors: string[] = [];
  if (evRes.error) errors.push(`Funnel events: ${evRes.error.message}`);
  if (ordRes.error) errors.push(`Orders: ${ordRes.error.message}`);

  return {
    events: (evRes.data || []) as ChristmasFunnelEventRow[],
    orders: (ordRes.data || []) as ChristmasOrderKpiRow[],
    errors,
  };
}
