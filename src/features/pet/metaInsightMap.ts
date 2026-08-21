/**
 * Browser-safe Meta Insights row mapper (mirrors edge metaAds.mapMetaInsightRow).
 * Used for unit tests and documentation of action_type parsing.
 */

export type MetaAction = { action_type?: string; value?: string };

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function dollarsToCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function actionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions?.length) return 0;
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (wanted.has(type)) total += toInt(action.value);
  }
  return total;
}

function customActionValue(actions: MetaAction[] | undefined, aliases: string[]): number | null {
  if (!actions?.length) return null;
  let found = false;
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (aliases.some((alias) => type === alias.toLowerCase() || type.endsWith(`.${alias.toLowerCase()}`) || type.includes(alias.toLowerCase()))) {
      found = true;
      total += toInt(action.value);
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
    landing_page_views: actionValue(actions, ["landing_page_view", "omni_landing_page_view"]),
    initiate_checkouts: actionValue(actions, ["initiate_checkout", "omni_initiated_checkout"]),
    purchases: actionValue(actions, ["purchase", "omni_purchase"]),
    pet_name_submitted: petName,
  };
}
