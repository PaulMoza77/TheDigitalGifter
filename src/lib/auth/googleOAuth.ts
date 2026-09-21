import { supabase } from "@/lib/supabase";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";

export function publicSiteOrigin() {
  if (typeof window === "undefined") return "";
  if (window.location.hostname === "thedigitalgifter.com") {
    return "https://www.thedigitalgifter.com";
  }
  return window.location.origin;
}

export async function startGoogleSignIn(returnTo: string) {
  rememberAuthReturnTo(returnTo);
  const base = publicSiteOrigin();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: base ? `${base}/auth/callback` : undefined,
    },
  });
  if (error) throw error;
}
