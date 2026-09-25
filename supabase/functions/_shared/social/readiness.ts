/** Pure social-account readiness. No Deno env, no tokens. */

export type SocialProvider = "meta" | "tiktok" | "youtube";

export type ProviderReadinessAccount = {
  provider?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
};

export type ProviderReadinessInput = {
  configured: Record<SocialProvider, boolean>;
  live: boolean;
  missingEnv: Record<SocialProvider, string[]>;
  accounts?: ProviderReadinessAccount[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function latestAccount(accounts: ProviderReadinessAccount[] | undefined, provider: SocialProvider) {
  const rows = (accounts || []).filter((row) => row.provider === provider && row.status !== "revoked");
  return rows.find((row) => row.status === "connected") || rows[0] || null;
}

function withLiveGate(missing: string[], live: boolean): string[] {
  if (!live && !missing.includes("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS")) {
    missing.push("SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS");
  }
  return missing;
}

export function metaReadinessMissing(input: {
  oauthConfigured: boolean;
  missingEnv: string[];
  live: boolean;
  account?: ProviderReadinessAccount | null;
}): string[] {
  const missing: string[] = [];
  if (!input.oauthConfigured) missing.push(...input.missingEnv);
  const metadata = (input.account?.metadata || {}) as Record<string, unknown>;
  if (input.account) {
    missing.push(...asStringArray(metadata.missing_permissions));
  }
  return withLiveGate(missing, input.live);
}

export function youtubeReadinessMissing(input: {
  oauthConfigured: boolean;
  missingEnv: string[];
  live: boolean;
  account?: ProviderReadinessAccount | null;
}): string[] {
  const missing: string[] = [];
  if (!input.oauthConfigured) missing.push(...input.missingEnv);
  const metadata = (input.account?.metadata || {}) as Record<string, unknown>;
  if (input.account) {
    const scopeGaps = asStringArray(metadata.missing_scopes);
    missing.push(...(scopeGaps.length ? scopeGaps : asStringArray(metadata.missing_permissions)));
  }
  return withLiveGate(missing, input.live);
}

export function tiktokReadinessMissing(input: {
  oauthConfigured: boolean;
  missingEnv: string[];
  live: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.oauthConfigured) missing.push(...input.missingEnv);
  return withLiveGate(missing, input.live);
}

export function buildProviderReadiness(input: ProviderReadinessInput) {
  const metaAccount = latestAccount(input.accounts, "meta");
  const youtubeAccount = latestAccount(input.accounts, "youtube");
  return {
    meta: {
      ui: true,
      oauth: input.configured.meta,
      publishing:
        input.live && input.configured.meta
          ? "adapter_ready_not_live_proven"
          : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: metaReadinessMissing({
        oauthConfigured: input.configured.meta,
        missingEnv: input.missingEnv.meta,
        live: input.live,
        account: metaAccount,
      }),
    },
    tiktok: {
      ui: true,
      oauth: input.configured.tiktok,
      publishing:
        input.live && input.configured.tiktok
          ? "adapter_ready_not_live_proven"
          : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: tiktokReadinessMissing({
        oauthConfigured: input.configured.tiktok,
        missingEnv: input.missingEnv.tiktok,
        live: input.live,
      }),
    },
    youtube: {
      ui: true,
      oauth: input.configured.youtube,
      publishing:
        input.live && input.configured.youtube
          ? "adapter_ready_not_live_proven"
          : "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL",
      missing: youtubeReadinessMissing({
        oauthConfigured: input.configured.youtube,
        missingEnv: input.missingEnv.youtube,
        live: input.live,
        account: youtubeAccount,
      }),
    },
  };
}
