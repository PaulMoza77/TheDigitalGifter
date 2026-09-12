import type { PetV2FailureCategory, PetV2PreviewResponse } from "./types";
import { petT, type PetUiLocale } from "../pet/i18n";

/** Safe, actionable copy — never expose provider tokens or raw stack traces. */
export function previewErrorMessage(
  response: Pick<PetV2PreviewResponse, "error" | "errorCode" | "failureCategory">,
  locale: PetUiLocale = "en",
): string {
  if (response.errorCode === "wrong_species" && response.error) {
    return response.error;
  }
  if (response.errorCode === "unclear_species" && response.error) {
    return response.error;
  }
  if (response.errorCode === "invalid_funnel") {
    return response.error || petT("v2.err.invalid_funnel", locale);
  }
  if (response.errorCode === "rate_limited") {
    return response.error || petT("v2.err.rate_limited", locale);
  }
  const category = response.failureCategory || categoryFromCode(response.errorCode);
  switch (category) {
    case "timeout":
      return petT("v2.err.timeout", locale);
    case "rate_limit":
      return response.error || petT("v2.err.rate_limit", locale);
    case "wrong_species":
      return response.error || petT("v2.err.wrong_species", locale);
    case "invalid_image":
      return response.error || petT("v2.err.invalid_image", locale);
    case "provider_auth":
      return petT("v2.err.provider_auth", locale);
    case "endpoint_unreachable":
      return petT("v2.err.endpoint_unreachable", locale);
    case "server_error":
      return petT("v2.err.server_error", locale);
    case "provider_error":
    default:
      return petT("v2.err.provider_error", locale);
  }
}

function categoryFromCode(
  code: PetV2PreviewResponse["errorCode"],
): PetV2FailureCategory | undefined {
  if (!code) return undefined;
  if (code === "rate_limited") return "rate_limit";
  if (code === "wrong_species") return "wrong_species";
  if (
    code === "invalid_photo" ||
    code === "heic_unsupported" ||
    code === "invalid_image" ||
    code === "unclear_species" ||
    code === "invalid_funnel"
  ) {
    return "invalid_image";
  }
  if (code === "timeout") return "timeout";
  if (code === "provider_auth") return "provider_auth";
  if (code === "generation_failed" || code === "provider_error") return "provider_error";
  return undefined;
}
