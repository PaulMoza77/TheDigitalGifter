import type { PetV2FailureCategory, PetV2PreviewResponse } from "./types";

export type PreviewErrorInput = Pick<
  PetV2PreviewResponse,
  "error" | "errorCode" | "failureCategory" | "retryAfterSeconds" | "rateLimitKind"
>;

/** Safe, actionable copy — never expose provider tokens or raw stack traces. */
export function previewErrorMessage(response: PreviewErrorInput): string {
  const category = response.failureCategory || categoryFromCode(response.errorCode);
  switch (category) {
    case "timeout":
      return "Your preview is still rendering. Wait a moment, then tap Try again — we’ll pick up where it left off.";
    case "rate_limit":
      return (
        response.error ||
        "This session already used its free previews. Unlock the collection or try again later."
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

export function previewErrorUiState(response: PreviewErrorInput): {
  kind:
    | "unsupported_photo"
    | "rate_limited"
    | "provider_unavailable"
    | "timeout_resume"
    | "network"
    | "unknown";
  title: string;
  message: string;
  retryAfterSeconds: number | null;
} {
  const category = response.failureCategory || categoryFromCode(response.errorCode);
  const message = previewErrorMessage(response);
  if (category === "invalid_image" || response.errorCode === "heic_unsupported") {
    return { kind: "unsupported_photo", title: "Unsupported photo", message, retryAfterSeconds: null };
  }
  if (category === "rate_limit") {
    return {
      kind: "rate_limited",
      title: "Free preview limit reached",
      message,
      retryAfterSeconds:
        typeof response.retryAfterSeconds === "number" && response.retryAfterSeconds > 0
          ? Math.round(response.retryAfterSeconds)
          : 3600,
    };
  }
  if (category === "timeout") {
    return { kind: "timeout_resume", title: "Still rendering", message, retryAfterSeconds: null };
  }
  if (category === "provider_auth" || category === "provider_error") {
    return {
      kind: "provider_unavailable",
      title: "Preview temporarily unavailable",
      message,
      retryAfterSeconds: null,
    };
  }
  if (category === "endpoint_unreachable") {
    return { kind: "network", title: "Connection problem", message, retryAfterSeconds: null };
  }
  return { kind: "unknown", title: "Preview didn’t finish", message, retryAfterSeconds: null };
}

function categoryFromCode(
  code: PetV2PreviewResponse["errorCode"],
): PetV2FailureCategory | undefined {
  if (!code) return undefined;
  if (code === "rate_limited") return "rate_limit";
  if (code === "invalid_photo" || code === "heic_unsupported" || code === "invalid_image") {
    return "invalid_image";
  }
  if (code === "timeout") return "timeout";
  if (code === "provider_auth") return "provider_auth";
  if (code === "generation_failed" || code === "provider_error") return "provider_error";
  return undefined;
}
