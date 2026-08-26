/**
 * Pet Funnel Meta spend may only include explicitly allowlisted campaign IDs.
 * Never fall back to the whole ad account. Browser-safe; no secrets.
 */

export const BUILTIN_PET_META_CAMPAIGN_IDS = [
  "120253346791240170",
  "120253465585030170",
  "120253518796930170",
] as const;

export const BUILTIN_PET_META_CAMPAIGN_LABELS: Record<string, string> = {
  "120253346791240170": "TDG - Dog campaign",
  "120253465585030170": "Pet TDG Funnel V2 testing",
  "120253518796930170": "Cat V3",
};

const EXCLUDED_CAMPAIGN_NAME =
  /2nd\s*try|smart\s*deal(\s*budget)?|minutes\s*guides?/i;

export function parsePetMetaCampaignIds(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of String(raw || "").split(/[,\s]+/)) {
    const id = part.trim();
    if (!/^\d{5,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function mergePetMetaCampaignAllowlist(
  ...groups: Array<Iterable<string> | null | undefined>
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const value of group) {
      const id = String(value || "").trim();
      if (!/^\d{5,}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function isExcludedNonPetCampaignName(name: string | null | undefined): boolean {
  return EXCLUDED_CAMPAIGN_NAME.test(String(name || ""));
}

export function isAllowedPetMetaCampaign(
  campaignId: string | null | undefined,
  campaignName: string | null | undefined,
  allowlist: Iterable<string>,
): boolean {
  const id = String(campaignId || "").trim();
  if (!id) return false;
  const allowed = new Set(Array.from(allowlist, (value) => String(value || "").trim()).filter(Boolean));
  if (!allowed.size || !allowed.has(id)) return false;
  if (isExcludedNonPetCampaignName(campaignName)) return false;
  return true;
}

export function filterPetMetaInsightRows<T extends { campaign_id?: string; campaign_name?: string }>(
  rows: T[],
  allowlist: Iterable<string>,
): T[] {
  const ids = mergePetMetaCampaignAllowlist(allowlist);
  if (!ids.length) return [];
  return rows.filter((row) => isAllowedPetMetaCampaign(row.campaign_id, row.campaign_name, ids));
}
