/**
 * Photo / Santa V1 transactional delivery-email seam (Deno Edge).
 * Keep in sync with `src/features/christmas/deliveryEmail.ts`.
 *
 * Called after photo/Santa generation success. Never sends when Resend is
 * unconfigured (local/CI/testing without keys). Token link prefers source_route.
 */
import { recoveryRouteForOrder } from "./portraitPromptRegistry.ts";
import { asString } from "./crypto.ts";

export const PHOTO_SANTA_RESEND_ENDPOINT = "https://api.resend.com/emails";
export const PHOTO_SANTA_DEFAULT_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export type PhotoSantaDeliveryKind = "portrait" | "santa";
export type DeliveryEmailSkipReason = "missing_email" | "missing_token" | "unconfigured";

export type PhotoSantaDeliveryPlan =
  | { action: "skip"; reason: DeliveryEmailSkipReason }
  | {
      action: "send";
      kind: PhotoSantaDeliveryKind;
      to: string;
      from: string;
      subject: string;
      html: string;
      recoveryUrl: string;
      recoveryRoute: string;
    };

export function deliveryKindForProduct(productKey: string): PhotoSantaDeliveryKind {
  return asString(productKey) === "christmas_santa_video" ? "santa" : "portrait";
}

export function buildDeliveryRecoveryUrl(input: {
  siteOrigin: string;
  token: string;
  productKey: string;
  species?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
}): { recoveryUrl: string; recoveryRoute: string } {
  const origin = asString(input.siteOrigin).replace(/\/$/, "") || PHOTO_SANTA_DEFAULT_SITE_ORIGIN;
  const recoveryRoute = recoveryRouteForOrder({
    productKey: input.productKey,
    species: input.species,
    sourceRoute: input.sourceRoute,
    landingPath: input.landingPath,
  });
  return {
    recoveryRoute,
    recoveryUrl: `${origin}${recoveryRoute}?token=${encodeURIComponent(asString(input.token))}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPhotoSantaDeliveryContent(input: {
  kind: PhotoSantaDeliveryKind;
  recoveryUrl: string;
}): { subject: string; html: string } {
  const subject =
    input.kind === "santa" ? "Your Santa video is ready" : "Your Christmas portrait is ready";
  const body =
    input.kind === "santa"
      ? "Your personalized Santa video is ready."
      : "Your personalized Christmas portrait is ready.";
  const html = `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(input.recoveryUrl)}">Open your result</a></p><p>— The Digital Gifter</p>`;
  return { subject, html };
}

export type PlanPhotoSantaDeliveryEmailInput = {
  productKey: string;
  email?: string | null;
  tokenHint?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
  species?: string | null;
  siteOrigin?: string | null;
  resendApiKey?: string | null;
  fromAddress?: string | null;
};

export function planPhotoSantaDeliveryEmail(
  input: PlanPhotoSantaDeliveryEmailInput,
): PhotoSantaDeliveryPlan {
  const email = asString(input.email);
  const tokenHint = asString(input.tokenHint);
  const resendApiKey = asString(input.resendApiKey);
  const fromAddress = asString(input.fromAddress);
  if (!email) return { action: "skip", reason: "missing_email" };
  if (!tokenHint) return { action: "skip", reason: "missing_token" };
  if (!resendApiKey || !fromAddress) return { action: "skip", reason: "unconfigured" };

  const kind = deliveryKindForProduct(input.productKey);
  const { recoveryUrl, recoveryRoute } = buildDeliveryRecoveryUrl({
    siteOrigin: asString(input.siteOrigin) || PHOTO_SANTA_DEFAULT_SITE_ORIGIN,
    token: tokenHint,
    productKey: input.productKey,
    species: input.species,
    sourceRoute: input.sourceRoute,
    landingPath: input.landingPath,
  });
  const { subject, html } = buildPhotoSantaDeliveryContent({ kind, recoveryUrl });
  return {
    action: "send",
    kind,
    to: email,
    from: fromAddress,
    subject,
    html,
    recoveryUrl,
    recoveryRoute,
  };
}

function readResendEnv(): { resendApiKey: string; fromAddress: string; siteOrigin: string } {
  const resendApiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const fromAddress = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") || Deno.env.get("TRANSACTIONAL_EMAIL_FROM"),
  );
  const siteOrigin = asString(
    Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL") || PHOTO_SANTA_DEFAULT_SITE_ORIGIN,
  ).replace(/\/$/, "");
  return { resendApiKey, fromAddress, siteOrigin };
}

export async function sendPhotoSantaDeliveryEmail(input: {
  email?: string | null;
  tokenHint?: string | null;
  productKey: string;
  sourceRoute?: string | null;
  landingPath?: string | null;
  species?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const env = readResendEnv();
  const plan = planPhotoSantaDeliveryEmail({
    ...input,
    ...env,
  });
  if (plan.action === "skip") {
    return { sent: false, reason: plan.reason };
  }

  const res = await fetch(PHOTO_SANTA_RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: plan.from,
      to: [plan.to],
      subject: plan.subject,
      html: plan.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Photo/Santa delivery email failed (${res.status})`);
  }
  return { sent: true };
}
