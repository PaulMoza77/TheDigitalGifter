/**
 * Photo / Santa V1 transactional delivery-email seam.
 *
 * Post-success only. Token recovery uses `source_route` (then landing / product).
 * No marketing, welcome, abandon, or cross-sell copy — those are GAP-LIFECYCLE-003.
 * When Resend is unconfigured, the plan is `skip` and callers must not POST.
 *
 * Keep in sync with `supabase/functions/_shared/christmas/deliveryEmail.ts`.
 */

export const PHOTO_SANTA_RESEND_ENDPOINT = "https://api.resend.com/emails";
export const PHOTO_SANTA_DEFAULT_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export type PhotoSantaDeliveryKind = "portrait" | "santa";

export type DeliveryEmailSkipReason =
  | "missing_email"
  | "missing_token"
  | "unconfigured";

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

export function asTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

export function deliveryKindForProduct(productKey: string): PhotoSantaDeliveryKind {
  return asTrimmed(productKey) === "christmas_santa_video" ? "santa" : "portrait";
}

/** Mirrors `recoveryRouteForOrder` in portraitPromptRegistry.ts. */
export function recoveryRouteForOrder(input: {
  productKey: string;
  species?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
}): string {
  const route = asTrimmed(input.sourceRoute);
  if (route.startsWith("/christmas/")) return route.split("?")[0];
  const landing = asTrimmed(input.landingPath).split("?")[0];
  if (
    landing.startsWith("/christmas/family") ||
    landing.startsWith("/christmas/couples") ||
    landing.startsWith("/christmas/pets") ||
    landing.startsWith("/christmas/dogs") ||
    landing.startsWith("/christmas/cats") ||
    landing.startsWith("/christmas/photo-generator") ||
    landing.startsWith("/christmas/santa-video")
  ) {
    return landing;
  }
  if (input.productKey === "christmas_santa_video") return "/christmas/santa-video";
  if (input.productKey === "christmas_family") return "/christmas/family";
  if (input.productKey === "christmas_couple") return "/christmas/couples";
  if (input.productKey === "christmas_pet") {
    const sp = asTrimmed(input.species).toLowerCase();
    if (sp === "dog") return "/christmas/dogs";
    if (sp === "cat") return "/christmas/cats";
    return "/christmas/pets";
  }
  return "/christmas/photo-generator";
}

export function buildDeliveryRecoveryUrl(input: {
  siteOrigin: string;
  token: string;
  productKey: string;
  species?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
}): { recoveryUrl: string; recoveryRoute: string } {
  const origin = asTrimmed(input.siteOrigin).replace(/\/$/, "") || PHOTO_SANTA_DEFAULT_SITE_ORIGIN;
  const recoveryRoute = recoveryRouteForOrder({
    productKey: input.productKey,
    species: input.species,
    sourceRoute: input.sourceRoute,
    landingPath: input.landingPath,
  });
  return {
    recoveryRoute,
    recoveryUrl: `${origin}${recoveryRoute}?token=${encodeURIComponent(asTrimmed(input.token))}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

const MARKETING_PHRASES = [
  "unsubscribe",
  "upgrade",
  "cross-sell",
  "cross sell",
  "also try",
  "limited time",
  "newsletter",
  "welcome bonus",
  "abandon",
  "discount",
  "% off",
  "buy now",
  "special offer",
];

export function deliveryEmailHasMarketingCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return MARKETING_PHRASES.some((phrase) => lower.includes(phrase));
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
  const email = asTrimmed(input.email);
  const tokenHint = asTrimmed(input.tokenHint);
  const resendApiKey = asTrimmed(input.resendApiKey);
  const fromAddress = asTrimmed(input.fromAddress);
  if (!email) return { action: "skip", reason: "missing_email" };
  if (!tokenHint) return { action: "skip", reason: "missing_token" };
  if (!resendApiKey || !fromAddress) return { action: "skip", reason: "unconfigured" };

  const kind = deliveryKindForProduct(input.productKey);
  const { recoveryUrl, recoveryRoute } = buildDeliveryRecoveryUrl({
    siteOrigin: asTrimmed(input.siteOrigin) || PHOTO_SANTA_DEFAULT_SITE_ORIGIN,
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

export async function sendPhotoSantaDeliveryEmail(
  input: PlanPhotoSantaDeliveryEmailInput & { fetchImpl?: typeof fetch },
): Promise<{ sent: boolean; reason?: string; providerMessageId?: string }> {
  const plan = planPhotoSantaDeliveryEmail(input);
  if (plan.action === "skip") {
    return { sent: false, reason: plan.reason };
  }

  const fetchFn = input.fetchImpl ?? fetch;
  const res = await fetchFn(PHOTO_SANTA_RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${asTrimmed(input.resendApiKey)}`,
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

  let providerMessageId: string | undefined;
  try {
    const body = (await res.json()) as { id?: string };
    providerMessageId = asTrimmed(body.id) || undefined;
  } catch {
    providerMessageId = undefined;
  }
  return { sent: true, providerMessageId };
}
