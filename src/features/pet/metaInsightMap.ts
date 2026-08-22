/**
 * Browser-safe Meta Insights row mapper (mirrors edge metaAds.mapMetaInsightRow).
 * Used for unit tests and documentation of action_type parsing.
 */

import {
  META_CHECKOUT_ACTION_PREFERENCE,
  META_LPV_ACTION_PREFERENCE,
  META_PURCHASE_ACTION_PREFERENCE,
  preferredActionValue,
  type MetaAction,
} from "../../../supabase/functions/_shared/pet/metaActionValue";

export type { MetaAction };

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function dollarsToCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function customActionValue(actions: MetaAction[] | undefined, aliases: string[]): number | null {
  if (!actions?.length) return null;
  let found = false;
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (aliases.some((alias) => type === alias.toLowerCase() || type.endsWith(`.${alias.toLowerCase()}`) || type.includes(alias.toLowerCase()))) {
      found = true;
      const n = Number(action.value);
      total += Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    }
  }
  return found ? total : null;
}

export function mapMetaInsightRowForTests(row: Record<string, unknown>) {
  const actions = (row.actions as MetaAction[] | undefined) || [];
  const petName = customActionValue(actions, ["PetNameSubmitted", "offsite_conversion.fb_pixel_custom.PetNameSubmitted"]);
  return {
    metric_date: asString(row.date_start),
    campaign_id: asString(row.campaign_id),
    ad_id: asString(row.ad_id),
    spend_cents: dollarsToCents(row.spend),
    landing_page_views: preferredActionValue(actions, [...META_LPV_ACTION_PREFERENCE]),
    initiate_checkouts: preferredActionValue(actions, [...META_CHECKOUT_ACTION_PREFERENCE]),
    purchases: preferredActionValue(actions, [...META_PURCHASE_ACTION_PREFERENCE]),
    pet_name_submitted: petName,
  };
}
