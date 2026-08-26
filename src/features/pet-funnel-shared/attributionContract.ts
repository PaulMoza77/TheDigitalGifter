/**
 * Canonical first-party attribution contract for pet funnel events.
 * Every version (V1/V2/V3) should map into this shape before ingest.
 */

export const PET_FUNNEL_NAME = "pet" as const;

export type PetFunnelVersion = "v1" | "v2" | "v3" | "unknown";
export type PetType = "dog" | "cat" | "other";

export type PetAttributionContract = {
  funnel: typeof PET_FUNNEL_NAME;
  pet_type: PetType;
  funnel_version: PetFunnelVersion;
  creative_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  funnel_session_id: string;
  client_event_id: string;
  environment: "production" | "preview" | "development";
};

export type PetAttributionInput = {
  petType: PetType;
  funnelVersion: PetFunnelVersion;
  funnelSessionId: string;
  clientEventId: string;
  environment?: PetAttributionContract["environment"];
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  creativeId?: string | null;
};

/** Normalize utm_content or explicit creative_id into canonical creative_id. */
export function deriveCreativeId(input: {
  utmContent?: string | null;
  creativeId?: string | null;
}): string | null {
  const explicit = String(input.creativeId || "").trim();
  if (explicit) return explicit.replace(/-FINAL$/i, "").slice(0, 120);
  const fromContent = String(input.utmContent || "").trim();
  if (!fromContent) return null;
  return fromContent.replace(/-FINAL$/i, "").slice(0, 120);
}

export function normalizeFunnelVersion(value: unknown): PetFunnelVersion {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "v1" || raw === "v2" || raw === "v3") return raw;
  return "unknown";
}

export function buildPetAttributionContract(input: PetAttributionInput): PetAttributionContract {
  const content = input.utmContent ?? null;
  return {
    funnel: PET_FUNNEL_NAME,
    pet_type: input.petType,
    funnel_version: input.funnelVersion,
    creative_id: deriveCreativeId({ utmContent: content, creativeId: input.creativeId }),
    campaign_id: input.campaignId ?? null,
    adset_id: input.adsetId ?? null,
    ad_id: input.adId ?? null,
    source: input.utmSource ?? null,
    medium: input.utmMedium ?? null,
    campaign: input.utmCampaign ?? null,
    content,
    term: input.utmTerm ?? null,
    funnel_session_id: input.funnelSessionId,
    client_event_id: input.clientEventId,
    environment: input.environment ?? "production",
  };
}
