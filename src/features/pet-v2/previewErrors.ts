import type { PetV2FailureCategory, PetV2PreviewResponse } from "./types";

/** Safe, actionable copy — never expose provider tokens or raw stack traces. */
export function previewErrorMessage(
  response: Pick<PetV2PreviewResponse, "error" | "errorCode" | "failureCategory">,
): string {
  if (response.errorCode === "wrong_species" && response.error) {
    return response.error;
  }
  if (response.errorCode === "unclear_species" && response.error) {
    return response.error;
  }
  if (response.errorCode === "invalid_funnel") {
    return response.error || "This preview doesn’t match the current experience. Refresh and try again.";
  }
  const category = response.failureCategory || categoryFromCode(response.errorCode);
  switch (category) {
    case "timeout":
      return "Your preview is still rendering. Wait a moment, then tap Try again — we’ll pick up where it left off.";
    case "rate_limit":
      return (
        response.error ||
        "This session already used its free previews. Unlock the collection or try again tomorrow."
      );
    case "wrong_species":
      return (
        response.error ||
        "That photo doesn’t match this experience. Please upload a clear photo of the right pet."
      );
    case "invalid_image":
      return response.error || "That photo could not be used. Try a smaller JPEG, PNG, or WebP.";
    case "provider_auth":
      return "Preview generation is temporarily unavailable. Try again in a few minutes.";
    case "endpoint_unreachable":
      return "We couldn’t reach the preview service. Check your connection and try again.";
    case "server_error":
      return "Something got stuck from an earlier attempt. Tap Try again or replace the photo for a fresh preview.";
    case "provider_error":
    default:
      return "We couldn’t finish the preview this time. Try again, or replace the photo if it keeps failing.";
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
