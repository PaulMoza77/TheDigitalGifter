/** Shared Christmas generation-result share helpers (Deno). */

import { asString, generatePublicToken, isUuid, sha256Hex } from "./crypto.ts";

export { asString, generatePublicToken, isUuid, sha256Hex };

export const MIN_SHARE_TOKEN_LENGTH = 32;
export const SIGNED_RESULT_TTL_SEC = 15 * 60;

export function isShareToken(value: unknown): value is string {
  return asString(value).length >= MIN_SHARE_TOKEN_LENGTH;
}

export function publicShareUnavailable() {
  return { error: "unavailable" } as const;
}

export function publicSharedResultDto(input: {
  generationId: string;
  productKey: string | null;
  assetKind: string | null;
  styleKey: string | null;
  resultUrl: string | null;
}) {
  return {
    generation_id: input.generationId,
    product_key: input.productKey,
    asset_kind: input.assetKind,
    style_key: input.styleKey,
    resultUrl: input.resultUrl,
  };
}
