import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { v4RedirectTarget } from "./campaign";

/**
 * Soft-redirect live Meta ads that still land on V1/V2 URLs with the V4
 * campaign id (campaign_id or utm_campaign) into the isolated V4 cohort
 * routes, preserving query attribution.
 *
 * Production migration `20260910120000_pet_v4_sales_campaign_analytics.sql`
 * is applied (orders CHECK + record_pet_v4_funnel_event).
 */
export function PetV4CampaignRedirect({ children }: { children: ReactNode }) {
  const location = useLocation();
  const target = v4RedirectTarget(location.pathname, location.search);
  if (target) {
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
