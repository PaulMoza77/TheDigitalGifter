import { CHRISTMAS_CLUB_SIGNUP_PATH } from "./config";
import type { ChristmasClubSignupMethod } from "./signupContract";

export type ChristmasClubJoinRequest = {
  email?: string;
  signupMethod: ChristmasClubSignupMethod;
  source: string;
  campaignKey: string;
  campaignYear: number;
  landingPath?: string | null;
  funnelSessionId?: string | null;
  accessToken?: string | null;
  utm?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    affiliate_ref?: string | null;
  };
};

export type ChristmasClubJoinResult = {
  ok: boolean;
  alreadyJoined: boolean;
  error?: string;
};

export async function joinChristmasClub(
  input: ChristmasClubJoinRequest,
): Promise<ChristmasClubJoinResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.accessToken) {
    headers.Authorization = `Bearer ${input.accessToken}`;
  }

  const response = await fetch(CHRISTMAS_CLUB_SIGNUP_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: input.email ?? null,
      signup_method: input.signupMethod,
      source: input.source,
      campaign_key: input.campaignKey,
      campaign_year: input.campaignYear,
      landing_path: input.landingPath ?? null,
      funnel_session_id: input.funnelSessionId ?? null,
      locale: "en",
      utm_source: input.utm?.utm_source ?? null,
      utm_medium: input.utm?.utm_medium ?? null,
      utm_campaign: input.utm?.utm_campaign ?? null,
      utm_content: input.utm?.utm_content ?? null,
      utm_term: input.utm?.utm_term ?? null,
      affiliate_ref: input.utm?.affiliate_ref ?? null,
    }),
  });

  let json: { ok?: boolean; already_joined?: boolean; error?: string } = {};
  try {
    json = (await response.json()) as typeof json;
  } catch {
    json = {};
  }

  if (!response.ok || json.ok === false) {
    return {
      ok: false,
      alreadyJoined: false,
      error: json.error || "We couldn’t save your place just now. Please try again.",
    };
  }

  return {
    ok: true,
    alreadyJoined: Boolean(json.already_joined),
  };
}
