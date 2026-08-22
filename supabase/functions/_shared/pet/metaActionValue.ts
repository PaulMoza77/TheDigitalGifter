/**
 * Meta Ads Insights action_type helpers.
 * Omni_* aliases are rollups of the same event, not extra events.
 * Never sum a standard action with its omni_* twin.
 */

export type MetaAction = { action_type?: string; value?: string };

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function actionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions?.length) return 0;
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  let total = 0;
  for (const action of actions) {
    const type = asString(action.action_type).toLowerCase();
    if (wanted.has(type)) total += toInt(action.value);
  }
  return total;
}

/**
 * Ads Manager shows one column per conversion. Prefer the website/standard
 * action_type; fall back to the omni_* rollup only when the standard type is absent.
 */
export function preferredActionValue(
  actions: MetaAction[] | undefined,
  preferredTypes: string[],
): number {
  if (!actions?.length || !preferredTypes.length) return 0;
  for (const preferred of preferredTypes) {
    const want = preferred.toLowerCase();
    let found = false;
    let total = 0;
    for (const action of actions) {
      if (asString(action.action_type).toLowerCase() === want) {
        found = true;
        total += toInt(action.value);
      }
    }
    if (found) return total;
  }
  return 0;
}

export const META_LPV_ACTION_PREFERENCE = ["landing_page_view", "omni_landing_page_view"] as const;
export const META_CHECKOUT_ACTION_PREFERENCE = ["initiate_checkout", "omni_initiated_checkout"] as const;
export const META_PURCHASE_ACTION_PREFERENCE = ["purchase", "omni_purchase"] as const;

const ALIAS_AUDIT_TYPES = [
  ...META_LPV_ACTION_PREFERENCE,
  ...META_CHECKOUT_ACTION_PREFERENCE,
  ...META_PURCHASE_ACTION_PREFERENCE,
] as const;

export type MetaActionAliasTotals = Record<(typeof ALIAS_AUDIT_TYPES)[number], number>;

export function emptyMetaActionAliasTotals(): MetaActionAliasTotals {
  return {
    landing_page_view: 0,
    omni_landing_page_view: 0,
    initiate_checkout: 0,
    omni_initiated_checkout: 0,
    purchase: 0,
    omni_purchase: 0,
  };
}

export function tallyMetaActionAliases(rawRows: Array<{ actions?: MetaAction[] | unknown }>): MetaActionAliasTotals {
  const totals = emptyMetaActionAliasTotals();
  for (const row of rawRows) {
    const actions = Array.isArray(row.actions) ? (row.actions as MetaAction[]) : [];
    for (const action of actions) {
      const type = asString(action.action_type).toLowerCase() as keyof MetaActionAliasTotals;
      if (type in totals) totals[type] += toInt(action.value);
    }
  }
  return totals;
}

export function addMetaActionAliasTotals(
  left: MetaActionAliasTotals,
  right: MetaActionAliasTotals,
): MetaActionAliasTotals {
  const out = emptyMetaActionAliasTotals();
  for (const key of ALIAS_AUDIT_TYPES) out[key] = left[key] + right[key];
  return out;
}
