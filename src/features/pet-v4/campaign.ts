import {
  captureFunnelAttribution,
  getFunnelAttribution,
  parseFunnelAttributionSearch,
} from "../pet/funnelAttribution";
import { PET_V4_META_CAMPAIGN_ID, PET_V4_PATHS } from "./types";

export function isV4MetaCampaignId(value: unknown): boolean {
  return String(value || "").trim() === PET_V4_META_CAMPAIGN_ID;
}

/** True when pathname is a dedicated V4 sales route. */
export function isPetV4Pathname(value: string): boolean {
  const path = String(value || "").split("?")[0];
  return (PET_V4_PATHS as readonly string[]).includes(path);
}

export function petV4LandingPath(species: string): string {
  const selected = species === "cat" || species === "other" ? species : "dog";
  return `/pet/${selected}-v4`;
}

export function parsePetV4Species(pathname: string): "dog" | "cat" | "other" {
  const segment = pathname.split("/").filter(Boolean)[1] || "";
  if (segment.startsWith("cat")) return "cat";
  if (segment.startsWith("other")) return "other";
  return "dog";
}

/** Map V1/V2 path → V4 path for campaign-id soft redirect. */
export function v2PathToV4Path(pathname: string): string | null {
  const path = String(pathname || "").split("?")[0];
  if (path === "/pet/dog-v2" || path === "/pet/dog") return "/pet/dog-v4";
  if (path === "/pet/cat-v2" || path === "/pet/cat") return "/pet/cat-v4";
  if (path === "/pet/other-v2" || path === "/pet/other") return "/pet/other-v4";
  if (path === "/pet-v2" || path === "/pet-v2/dog") return "/pet/dog-v4";
  return null;
}

/**
 * First-touch V4 cohort: Meta campaign_id wins.
 * Also true on dedicated /pet/*-v4 routes (always V4 mode).
 */
export function isV4AcquisitionCohort(search?: string, pathname?: string): boolean {
  const path =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  if (isPetV4Pathname(path)) return true;

  captureFunnelAttribution(search);
  const stored = getFunnelAttribution();
  if (isV4MetaCampaignId(stored.campaign_id)) return true;

  const hrefSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const incoming = parseFunnelAttributionSearch(hrefSearch || "");
  return isV4MetaCampaignId(incoming.campaign_id);
}

function hasV4CampaignInContext(search?: string): boolean {
  const hrefSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const fromUrl = parseFunnelAttributionSearch(hrefSearch || "");
  if (isV4MetaCampaignId(fromUrl.campaign_id)) return true;
  captureFunnelAttribution(hrefSearch);
  return isV4MetaCampaignId(getFunnelAttribution().campaign_id);
}

/** Soft-redirect target when live ads still land on V1/V2 URLs with V4 campaign_id. */
export function v4RedirectTarget(pathname: string, search?: string): string | null {
  if (!hasV4CampaignInContext(search)) return null;
  if (isPetV4Pathname(pathname)) return null;
  const target = v2PathToV4Path(pathname);
  if (!target) return null;
  const qs = (search ?? (typeof window !== "undefined" ? window.location.search : "")) || "";
  return `${target}${qs}`;
}
