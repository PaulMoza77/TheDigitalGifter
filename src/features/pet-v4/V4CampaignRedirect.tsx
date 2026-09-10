import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { v4RedirectTarget } from "./campaign";

/**
 * Soft-redirect live Meta ads that still land on V1/V2 URLs with V4 campaign_id
 * into the isolated V4 cohort routes, preserving query attribution.
 *
 * Enable in App.tsx only AFTER migration
 * `20260910120000_pet_v4_sales_campaign_analytics.sql` is applied in production
 * (orders CHECK + record_pet_v4_funnel_event must exist), otherwise V4 checkout fails.
 */
export function PetV4CampaignRedirect({ children }: { children: ReactNode }) {
  const location = useLocation();
  const target = v4RedirectTarget(location.pathname, location.search);
  if (target) {
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
