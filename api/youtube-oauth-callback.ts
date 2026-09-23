import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { isAllowedAdminReturn } from "./_lib/metaAdminReturn";

function one(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim();
}

function publicBase(): string {
  return String(
    process.env.SOCIAL_PUBLISHER_PUBLIC_BASE_URL || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com",
  ).replace(/\/$/, "");
}

/**
 * Google OAuth for YouTube lands here. The code is forwarded to the
 * social-publisher edge function and is never written to logs or the response.
 */
export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const base = publicBase();
  const failed = `${base}/admin/social-accounts?oauth=error&message=oauth_failed`;
  const code = one(req.query.code);
  const state = one(req.query.state);
  const error = one(req.query.error);
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  let location = failed;
  if (supabaseUrl && serviceKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/social-publisher`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "youtube_oauth_callback", code, state, error }),
      });
      const payload = (await response.json()) as { redirect?: string };
      if (
        payload.redirect &&
        (isAllowedAdminReturn(payload.redirect, base) ||
          isAllowedAdminReturn(payload.redirect, "https://www.thedigitalgifter.com"))
      ) {
        location = payload.redirect;
      }
    } catch {
      location = failed;
    }
  }

  if (
    !isAllowedAdminReturn(location, base) &&
    !isAllowedAdminReturn(location, "https://www.thedigitalgifter.com")
  ) {
    location = failed;
  }
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end();
}
