/**
 * Admin Christmas control-center data access.
 * Supabase lives here only — pages must not query tables directly.
 * Selects are an allowlist: no emails, tokens, media, Stripe ids, or metadata.
 */

import { supabase } from "@/lib/supabase";
import type {
  ControlFunnelRow,
  ControlOrderRow,
  ControlPackageRow,
  ControlProductRow,
} from "./controlCore";
import {
  assertChristmasControlSelectSafe,
  CHRISTMAS_CONTROL_FUNNEL_SELECT,
  CHRISTMAS_CONTROL_ORDER_SELECT,
  CHRISTMAS_CONTROL_PACKAGE_SELECT,
  CHRISTMAS_CONTROL_PRODUCT_SELECT,
} from "./controlSelect";

export {
  assertChristmasControlSelectSafe,
  CHRISTMAS_CONTROL_FORBIDDEN_SELECT_FIELDS,
  CHRISTMAS_CONTROL_FUNNEL_SELECT,
  CHRISTMAS_CONTROL_ORDER_SELECT,
  CHRISTMAS_CONTROL_PACKAGE_SELECT,
  CHRISTMAS_CONTROL_PRODUCT_SELECT,
} from "./controlSelect";

const CONTROL_ROW_LIMIT = 2000;

export type ChristmasControlLoadResult = {
  orders: ControlOrderRow[];
  events: ControlFunnelRow[];
  products: ControlProductRow[];
  packages: ControlPackageRow[];
  errors: string[];
};

export async function loadChristmasControlSources(): Promise<ChristmasControlLoadResult> {
  assertChristmasControlSelectSafe(CHRISTMAS_CONTROL_ORDER_SELECT);
  assertChristmasControlSelectSafe(CHRISTMAS_CONTROL_FUNNEL_SELECT);
  assertChristmasControlSelectSafe(CHRISTMAS_CONTROL_PRODUCT_SELECT);
  assertChristmasControlSelectSafe(CHRISTMAS_CONTROL_PACKAGE_SELECT);

  const [ordRes, evRes, prodRes, pkgRes] = await Promise.all([
    supabase
      .from("christmas_orders")
      .select(CHRISTMAS_CONTROL_ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(CONTROL_ROW_LIMIT),
    supabase
      .from("christmas_funnel_events")
      .select(CHRISTMAS_CONTROL_FUNNEL_SELECT)
      .order("created_at", { ascending: false })
      .limit(CONTROL_ROW_LIMIT),
    supabase.from("christmas_products").select(CHRISTMAS_CONTROL_PRODUCT_SELECT),
    supabase.from("christmas_packages").select(CHRISTMAS_CONTROL_PACKAGE_SELECT),
  ]);

  const errors: string[] = [];
  if (ordRes.error) errors.push(`Orders: ${ordRes.error.message}`);
  if (evRes.error) errors.push(`Funnel events: ${evRes.error.message}`);
  if (prodRes.error) errors.push(`Catalog: ${prodRes.error.message}`);
  if (pkgRes.error) errors.push(`Packages: ${pkgRes.error.message}`);

  return {
    orders: (ordRes.data || []) as ControlOrderRow[],
    events: (evRes.data || []) as ControlFunnelRow[],
    products: (prodRes.data || []) as ControlProductRow[],
    packages: (pkgRes.data || []) as ControlPackageRow[],
    errors,
  };
}
