export type SocialPublisherInvokeResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

export async function invokeSocialPublisher(
  body: Record<string, unknown>,
  init?: { timeoutMs?: number },
): Promise<SocialPublisherInvokeResult> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  const cronSecret = String(
    process.env.SOCIAL_PUBLISHER_CRON_SECRET || process.env.CRON_SECRET || process.env.PET_ANALYTICS_CRON_SECRET || "",
  ).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs || 45_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/social-publisher`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function tickSocialPublisher() {
  return invokeSocialPublisher({ action: "tick" });
}
