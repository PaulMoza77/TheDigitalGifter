import { isSafeAuthReturnPath, takeAuthReturnTo } from "@/lib/auth/returnTo";

export function authErrorMessage(code: string | null) {
  switch (code) {
    case "oauth_error":
      return "Google sign-in was cancelled or rejected. Try again.";
    case "exchange_failed":
      return "Google sign-in almost completed, but the session could not be created. Try again.";
    case "set_session_failed":
      return "Signed in with Google, but the session could not be saved in this browser.";
    case "missing_code":
      return "Google did not return a sign-in code. Keep this tab open through the account chooser and try again.";
    case "unexpected":
      return "Google sign-in failed unexpectedly. Try again.";
    default:
      return null;
  }
}

export function withAuthError(path: string, reason: string) {
  const url = path.startsWith("/") ? path : "/";
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}auth_error=${encodeURIComponent(reason)}`;
}

export function resolveOAuthReturnTo(search: string, fallback = "/") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const next = params.get("next") || "";
  if (isSafeAuthReturnPath(next)) return next.split("?")[0];
  return takeAuthReturnTo(fallback);
}
