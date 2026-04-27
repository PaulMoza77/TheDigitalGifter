import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Link2,
  MousePointerClick,
  DollarSign,
  BadgePercent,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import ClientStatsCards from "@/components/client/ClientStatsCards";
import type { ClientStat } from "@/components/client/types";
import { supabase } from "@/lib/supabase";

type AffiliateProfileRow = {
  id: string;
  user_id: string;
  email: string | null;
  affiliate_code: string;
  referral_slug: string;
  referral_link: string;
  total_clicks: number | null;
  total_conversions: number | null;
  available_earnings: number | null;
  created_at?: string;
  updated_at?: string;
};

type AffiliateEarningRow = {
  amount: number | string | null;
};

function sanitizeAffiliateCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
}

function sanitizeReferralSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildBaseCode(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  const emailPrefix = user.email?.split("@")[0] ?? "";
  const raw = fullName || emailPrefix || "TDGUSER";

  return (
    sanitizeAffiliateCode(raw.replace(/\s+/g, "").replace(/[^A-Za-z0-9_-]/g, "")) ||
    "TDGUSER"
  );
}

function buildReferralSlug(code: string) {
  return sanitizeReferralSlug(code);
}

function buildReferralLink(slug: string) {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://thedigitalgifter.com";

  return `${origin}/?ref=${encodeURIComponent(slug)}`;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function ensureUniqueAffiliateCode(baseCode: string, currentUserId: string) {
  let candidate = sanitizeAffiliateCode(baseCode) || "TDGUSER";

  for (let i = 0; i < 30; i += 1) {
    const { data, error } = await supabase
      .from("affiliate_profiles")
      .select("user_id")
      .eq("affiliate_code", candidate)
      .maybeSingle<{ user_id: string }>();

    if (error) throw error;
    if (!data || data.user_id === currentUserId) return candidate;

    const suffix =
      i === 0
        ? currentUserId.replace(/-/g, "").slice(0, 4).toUpperCase()
        : `${currentUserId.replace(/-/g, "").slice(0, 2).toUpperCase()}${i}`;

    candidate = sanitizeAffiliateCode(`${baseCode.slice(0, 20 - suffix.length)}${suffix}`);
  }

  return sanitizeAffiliateCode(`${baseCode.slice(0, 14)}${currentUserId.replace(/-/g, "").slice(0, 6).toUpperCase()}`);
}

async function loadAffiliateStats(userId: string, profile: AffiliateProfileRow) {
  const [
    { count: clickCount, error: clickError },
    { count: conversionCount, error: conversionError },
    { data: earningsRows, error: earningsError },
  ] = await Promise.all([
    supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("code", profile.referral_slug),

    supabase
      .from("affiliate_conversions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_user_id", userId),

    supabase
      .from("affiliate_earnings")
      .select("amount")
      .eq("affiliate_user_id", userId)
      .eq("status", "pending"),
  ]);

  if (clickError) throw clickError;
  if (conversionError) throw conversionError;
  if (earningsError) throw earningsError;

  const earnings = ((earningsRows ?? []) as AffiliateEarningRow[]).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  return {
    totalClicks: clickCount ?? profile.total_clicks ?? 0,
    totalConversions: conversionCount ?? profile.total_conversions ?? 0,
    availableEarnings: earnings || Number(profile.available_earnings ?? 0),
  };
}

export default function AccountAffiliate() {
  const [copiedField, setCopiedField] = React.useState<"link" | "code" | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState("");
  const [affiliateCode, setAffiliateCode] = React.useState("");
  const [draftCode, setDraftCode] = React.useState("");
  const [referralSlug, setReferralSlug] = React.useState("");
  const [affiliateLink, setAffiliateLink] = React.useState("");
  const [totalClicks, setTotalClicks] = React.useState(0);
  const [totalConversions, setTotalConversions] = React.useState(0);
  const [availableEarnings, setAvailableEarnings] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState("");

  async function loadUserAndProfile() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User not found.");

      setUserEmail(user.email ?? "");

      const { data: existingProfile, error: profileError } = await supabase
        .from("affiliate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle<AffiliateProfileRow>();

      if (profileError) throw profileError;

      let profile = existingProfile;

      if (!profile) {
        const uniqueCode = await ensureUniqueAffiliateCode(buildBaseCode(user), user.id);
        const slug = buildReferralSlug(uniqueCode);
        const link = buildReferralLink(slug);

        const { data: insertedProfile, error: insertError } = await supabase
          .from("affiliate_profiles")
          .insert({
            user_id: user.id,
            email: user.email ?? null,
            affiliate_code: uniqueCode,
            referral_slug: slug,
            referral_link: link,
            total_clicks: 0,
            total_conversions: 0,
            available_earnings: 0,
          })
          .select("*")
          .single<AffiliateProfileRow>();

        if (insertError) throw insertError;
        profile = insertedProfile;
      }

      const stats = await loadAffiliateStats(user.id, profile);

      setAffiliateCode(profile.affiliate_code);
      setDraftCode(profile.affiliate_code);
      setReferralSlug(profile.referral_slug);
      setAffiliateLink(profile.referral_link || buildReferralLink(profile.referral_slug));
      setTotalClicks(stats.totalClicks);
      setTotalConversions(stats.totalConversions);
      setAvailableEarnings(stats.availableEarnings);
    } catch (error) {
      console.error("[AccountAffiliate] load error:", error);
      setErrorMessage("Could not load affiliate profile.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadUserAndProfile();
  }, []);

  const stats: ClientStat[] = React.useMemo(
    () => [
      {
        label: "Entered on Link",
        value: String(totalClicks),
        helper: "Total visits on your referral link",
        icon: "activity",
      },
      {
        label: "Conversions",
        value: String(totalConversions),
        helper: "Paid customers attributed to your code",
        icon: "bookmark",
      },
      {
        label: "Affiliate Earnings",
        value: formatMoney(availableEarnings),
        helper: "Available balance right now",
        icon: "coins",
      },
    ],
    [availableEarnings, totalClicks, totalConversions]
  );

  async function copyValue(value: string, field: "link" | "code") {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1600);
  }

  async function handleSaveCode() {
    const clean = sanitizeAffiliateCode(draftCode);
    if (!clean || saving) return;

    try {
      setSaving(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User not found.");

      const uniqueCode = await ensureUniqueAffiliateCode(clean, user.id);
      const slug = buildReferralSlug(uniqueCode);
      const link = buildReferralLink(slug);

      const { data: updatedProfile, error: updateError } = await supabase
        .from("affiliate_profiles")
        .update({
          affiliate_code: uniqueCode,
          referral_slug: slug,
          referral_link: link,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select("*")
        .single<AffiliateProfileRow>();

      if (updateError) throw updateError;

      const refreshedStats = await loadAffiliateStats(user.id, updatedProfile);

      setAffiliateCode(updatedProfile.affiliate_code);
      setDraftCode(updatedProfile.affiliate_code);
      setReferralSlug(updatedProfile.referral_slug);
      setAffiliateLink(updatedProfile.referral_link);
      setTotalClicks(refreshedStats.totalClicks);
      setTotalConversions(refreshedStats.totalConversions);
      setAvailableEarnings(refreshedStats.availableEarnings);
    } catch (error) {
      console.error("[AccountAffiliate] save code error:", error);
      setErrorMessage("Could not save affiliate code.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-6 shadow-[0_20px_60px_rgba(0,0,0,0.26)] sm:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-emerald-200">
              <BadgePercent className="h-3.5 w-3.5" />
              Affiliate Dashboard
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Grow with your personal referral link.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Share your link or code, track performance and keep everything in one premium workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200">
              <Link to="/generator">
                Open Generator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadUserAndProfile()}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
            >
              Refresh Affiliate
            </Button>
          </div>
        </div>
      </section>

      <ClientStatsCards stats={stats} />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <Link2 className="h-3.5 w-3.5" />
                Referral Link
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">Share your affiliate link</h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Anyone entering through this link can be attributed to your affiliate account.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Your link
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white">
                  <div className="truncate">{loading ? "Loading affiliate link..." : affiliateLink}</div>
                </div>

                <Button
                  type="button"
                  disabled={loading || !affiliateLink}
                  onClick={() => void copyValue(affiliateLink, "link")}
                  className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
                >
                  {copiedField === "link" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copiedField === "link" ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Current email
              </div>
              <div className="mt-3 text-sm text-white">{userEmail || "No email found"}</div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Referral slug
              </div>
              <div className="mt-3 text-sm text-white">{loading ? "Loading..." : referralSlug || "-"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <DollarSign className="h-3.5 w-3.5" />
                Affiliate Code
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">Manage your code</h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Keep it short, clean and easy to say in videos.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Write or edit code
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={draftCode}
                  onChange={(event) => setDraftCode(sanitizeAffiliateCode(event.target.value))}
                  placeholder="Write affiliate code"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
                />

                <Button
                  type="button"
                  onClick={() => void handleSaveCode()}
                  disabled={loading || saving}
                  variant="secondary"
                  className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Code"}
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Active code
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold tracking-[0.16em] text-white">
                  {loading ? "Loading..." : affiliateCode || "-"}
                </div>

                <Button
                  type="button"
                  disabled={loading || !affiliateCode}
                  onClick={() => void copyValue(affiliateCode, "code")}
                  className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
                >
                  {copiedField === "code" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copiedField === "code" ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            <MousePointerClick className="h-3.5 w-3.5" />
            Affiliate Notes
          </div>

          <h3 className="mt-4 text-xl font-semibold text-white">What this page is tracking</h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Referral link clicks
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Paid conversions from affiliate code
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Pending affiliate earnings
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              One affiliate profile per user
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.02] to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            <DollarSign className="h-3.5 w-3.5" />
            Balance
          </div>

          <div className="mt-4 text-4xl font-semibold tracking-tight text-white">
            {formatMoney(availableEarnings)}
          </div>

          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Available affiliate earnings currently tracked for your account.
          </p>

          <Button
            type="button"
            variant="secondary"
            className="mt-6 w-full rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
          >
            Request Payout
          </Button>
        </div>
      </section>
    </div>
  );
}