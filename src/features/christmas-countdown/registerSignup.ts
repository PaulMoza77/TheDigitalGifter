import { supabase } from "@/lib/supabase";
import { getChristmasFunnelSessionId } from "@/features/christmas/analytics";
import { attributionForSignup } from "@/features/christmas-countdown/utm";

export type ChristmasSignupMethod = "email" | "google";

export type ChristmasSignupResult = {
  ok?: boolean;
  created?: boolean;
  duplicate?: boolean;
  id?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function accessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function registerViaOrigin(input: {
  email: string;
  signupMethod: ChristmasSignupMethod;
  userId?: string | null;
  marketingOptIn: boolean;
  campaignYear: number;
}): Promise<ChristmasSignupResult> {
  const attr = attributionForSignup();
  const token = await accessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch("/api/christmas-countdown-signup", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: input.email,
      signup_method: input.signupMethod,
      user_id: input.userId ?? null,
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      utm_content: attr.content,
      utm_term: attr.term,
      referrer: attr.referrer,
      landing_page: attr.landingPage || "/christmas",
      funnel_session_id: getChristmasFunnelSessionId(),
      marketing_opt_in: input.marketingOptIn,
      campaign_year: input.campaignYear,
    }),
  });
  const json = (await response.json().catch(() => ({}))) as ChristmasSignupResult & { error?: string };
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || "Signup failed");
  }
  return json;
}

/** Public email + authenticated Google join. RPC first, origin API if the RPC is blocked. */
export async function registerChristmasCountdownSignup(input: {
  email: string;
  signupMethod: ChristmasSignupMethod;
  userId?: string | null;
  marketingOptIn: boolean;
  campaignYear: number;
}): Promise<ChristmasSignupResult> {
  const email = input.email.trim().toLowerCase();
  if (!isEmail(email)) {
    throw new Error("Enter a valid email");
  }

  const attr = attributionForSignup();
  const { data, error } = await supabase.rpc("register_christmas_countdown_signup", {
    p_email: email,
    p_signup_method: input.signupMethod,
    p_user_id: input.userId ?? null,
    p_source: attr.source,
    p_medium: attr.medium,
    p_campaign: attr.campaign,
    p_utm_content: attr.content,
    p_utm_term: attr.term,
    p_referrer: attr.referrer,
    p_landing_page: attr.landingPage || "/christmas",
    p_funnel_session_id: getChristmasFunnelSessionId(),
    p_marketing_opt_in: input.marketingOptIn,
    p_campaign_year: input.campaignYear,
  });

  if (!error) {
    return (data ?? { ok: true }) as ChristmasSignupResult;
  }

  return registerViaOrigin({
    email,
    signupMethod: input.signupMethod,
    userId: input.userId,
    marketingOptIn: input.marketingOptIn,
    campaignYear: input.campaignYear,
  });
}
