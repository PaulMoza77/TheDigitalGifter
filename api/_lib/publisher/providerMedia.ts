import { signedPlaybackPath } from "../clip-factory/mediaSign";
import {
  isPublicStaticAsset,
  needsProviderSignature,
  parseClipFactoryMediaRef,
  PROVIDER_MEDIA_TTL_SEC,
  stableMediaRef,
} from "../../../src/features/publisher/mediaUrl";

export const PROVIDER_SIGNED_URL_TTL_SEC = PROVIDER_MEDIA_TTL_SEC;

function publicOrigin(explicit?: string): string {
  return (
    explicit ||
    process.env.SOCIAL_PUBLISHER_PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

export function mintProviderMediaUrl(
  src: string,
  origin = publicOrigin(),
  ttlSec = PROVIDER_SIGNED_URL_TTL_SEC,
): { path: string; url: string; ttlSec: number; stable: string; sig?: string } {
  const stable = stableMediaRef(src);
  const base = origin.replace(/\/$/, "");
  if (!stable) {
    throw new Error("media_ref_required");
  }
  if (isPublicStaticAsset(stable) || !needsProviderSignature(stable)) {
    const path = stable.startsWith("/") ? stable : `/${stable}`;
    return { path, url: `${base}${path}`, ttlSec, stable: path };
  }
  const parsed = parseClipFactoryMediaRef(stable);
  if (!parsed) {
    throw new Error("invalid_clip_factory_media_ref");
  }
  const path = signedPlaybackPath(parsed.kind, parsed.id, ttlSec);
  const sig = new URL(path, base).searchParams.get("sig") || undefined;
  return { path, url: `${base}${path}`, ttlSec, stable, sig };
}
