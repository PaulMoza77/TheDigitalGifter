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
  X,
  Loader2,
  Wallet,
  Building2,
  Mail,
  AlertTriangle,
  Clock3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import ClientStatsCards from "@/components/client/ClientStatsCards";
import type { ClientStat } from "@/components/client/types";
import { supabase } from "@/lib/supabase";

const MIN_WITHDRAWAL_AMOUNT = 10;

type PayoutMethod = "revolut" | "paypal" | "bank_transfer";

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

type AffiliateConversionRow = {
  commission_amount: number | string | null;
};

type AffiliateWithdrawalRow = {
  id: string;
  affiliate_user_id: string;
  amount: number | string | null;
  currency: string | null;
  method: PayoutMethod | string | null;
  status: string | null;
  requested_at: string | null;
  processed_at: string | null;
};

type WithdrawalForm = {
  method: PayoutMethod;
  fullName: string;
  country: string;
  revolutContact: string;
  paypalEmail: string;
  iban: string;
  bankName: string;
  swift: string;
  currency: string;
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

function toMoneyNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number) {
  return `$${toMoneyNumber(value).toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
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

function methodLabel(method: string | null) {
  if (method === "revolut") return "Revolut";
  if (method === "paypal") return "PayPal";
  if (method === "bank_transfer") return "Bank transfer";
  return "Unknown";
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

  return sanitizeAffiliateCode(
    `${baseCode.slice(0, 14)}${currentUserId.replace(/-/g, "").slice(0, 6).toUpperCase()}`
  );
}

async function loadAffiliateStats(profile: AffiliateProfileRow) {
  const affiliateUserId = profile.user_id;

  const [
    { count: clickCount, error: clickError },
    { count: conversionCount, error: conversionError },
    { data: earningsRows, error: earningsError },
    { data: conversionRows, error: conversionSumError },
    { data: withdrawalRows, error: withdrawalsError },
  ] = await Promise.all([
    supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("code", profile.referral_slug),

    supabase
      .from("affiliate_conversions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_user_id", affiliateUserId),

    supabase
      .from("affiliate_earnings")
      .select("amount")
      .eq("affiliate_user_id", affiliateUserId)
      .eq("status", "pending"),

    supabase
      .from("affiliate_conversions")
      .select("commission_amount")
      .eq("affiliate_user_id", affiliateUserId),

    supabase
      .from("affiliate_withdrawals")
      .select("amount,status")
      .eq("affiliate_user_id", affiliateUserId)
      .in("status", ["pending", "approved", "paid"]),
  ]);

  if (clickError) throw clickError;
  if (conversionError) throw conversionError;
  if (earningsError) throw earningsError;
  if (conversionSumError) throw conversionSumError;
  if (withdrawalsError) throw withdrawalsError;

  const earningsTotal = ((earningsRows ?? []) as AffiliateEarningRow[]).reduce(
    (sum, row) => sum + toMoneyNumber(row.amount),
    0
  );

  const conversionCommissionTotal = ((conversionRows ?? []) as AffiliateConversionRow[]).reduce(
    (sum, row) => sum + toMoneyNumber(row.commission_amount),
    0
  );

  const withdrawalReserved = ((withdrawalRows ?? []) as Array<{ amount: unknown }>).reduce(
    (sum, row) => sum + toMoneyNumber(row.amount),
    0
  );

  const grossAvailable =
    earningsTotal > 0
      ? earningsTotal
      : conversionCommissionTotal > 0
        ? conversionCommissionTotal
        : toMoneyNumber(profile.available_earnings);

  return {
    totalClicks: clickCount ?? profile.total_clicks ?? 0,
    totalConversions: conversionCount ?? profile.total_conversions ?? 0,
    availableEarnings: Math.max(0, grossAvailable - withdrawalReserved),
  };
}

function validateWithdrawalForm(form: WithdrawalForm) {
  if (!form.fullName.trim()) return "Please enter your full name.";
  if (!form.country.trim()) return "Please enter your country.";

  if (form.method === "revolut" && !form.revolutContact.trim()) {
    return "Please enter your Revolut phone or email.";
  }

  if (form.method === "paypal" && !form.paypalEmail.trim()) {
    return "Please enter your PayPal email.";
  }

  if (form.method === "bank_transfer") {
    if (!form.iban.trim()) return "Please enter your IBAN.";
    if (!form.bankName.trim()) return "Please enter your bank name.";
    if (!form.swift.trim()) return "Please enter your SWIFT/BIC.";
    if (!form.currency.trim()) return "Please enter your preferred currency.";
  }

  return "";
}

export default function AccountAffiliate() {
  const [copiedField, setCopiedField] = React.useState<"link" | "code" | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState("");
  const [affiliateCode, setAffiliateCode] = React.useState("");
  const [draftCode, setDraftCode] = React.useState("");
  const [referralSlug, setReferralSlug] = React.useState("");
  const [affiliateLink, setAffiliateLink] = React.useState("");
  const [totalClicks, setTotalClicks] = React.useState(0);
  const [totalConversions, setTotalConversions] = React.useState(0);
  const [availableEarnings, setAvailableEarnings] = React.useState(0);
  const [withdrawals, setWithdrawals] = React.useState<AffiliateWithdrawalRow[]>([]);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const [withdrawForm, setWithdrawForm] = React.useState<WithdrawalForm>({
    method: "revolut",
    fullName: "",
    country: "",
    revolutContact: "",
    paypalEmail: "",
    iban: "",
    bankName: "",
    swift: "",
    currency: "USD",
  });

  async function loadWithdrawals(userId: string) {
    const { data, error } = await supabase
      .from("affiliate_withdrawals")
      .select("id, affiliate_user_id, amount, currency, method, status, requested_at, processed_at")
      .eq("affiliate_user_id", userId)
      .order("requested_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    setWithdrawals((data ?? []) as AffiliateWithdrawalRow[]);
  }

  async function loadUserAndProfile() {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

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

      const stats = await loadAffiliateStats(profile);
      await loadWithdrawals(user.id);

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

  const hasPendingWithdrawal = withdrawals.some((item) => item.status === "pending");
  const canWithdraw = availableEarnings >= MIN_WITHDRAWAL_AMOUNT && !hasPendingWithdrawal;

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
        helper: hasPendingWithdrawal ? "Pending withdrawal already requested" : "Available balance right now",
        icon: "coins",
      },
    ],
    [availableEarnings, hasPendingWithdrawal, totalClicks, totalConversions]
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
      setSuccessMessage("");

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

      const refreshedStats = await loadAffiliateStats(updatedProfile);

      setAffiliateCode(updatedProfile.affiliate_code);
      setDraftCode(updatedProfile.affiliate_code);
      setReferralSlug(updatedProfile.referral_slug);
      setAffiliateLink(updatedProfile.referral_link || buildReferralLink(updatedProfile.referral_slug));
      setTotalClicks(refreshedStats.totalClicks);
      setTotalConversions(refreshedStats.totalConversions);
      setAvailableEarnings(refreshedStats.availableEarnings);
      setSuccessMessage("Affiliate code updated.");
    } catch (error) {
      console.error("[AccountAffiliate] save code error:", error);
      setErrorMessage("Could not save affiliate code.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestWithdrawal() {
    if (withdrawSubmitting) return;

    const validationError = validateWithdrawalForm(withdrawForm);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (availableEarnings < MIN_WITHDRAWAL_AMOUNT) {
      setErrorMessage(`Minimum withdrawal amount is ${formatMoney(MIN_WITHDRAWAL_AMOUNT)}.`);
      return;
    }

    try {
      setWithdrawSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payoutDetails =
        withdrawForm.method === "revolut"
          ? {
              full_name: withdrawForm.fullName.trim(),
              country: withdrawForm.country.trim(),
              revolut_contact: withdrawForm.revolutContact.trim(),
            }
          : withdrawForm.method === "paypal"
            ? {
                full_name: withdrawForm.fullName.trim(),
                country: withdrawForm.country.trim(),
                paypal_email: withdrawForm.paypalEmail.trim(),
              }
            : {
                account_holder_name: withdrawForm.fullName.trim(),
                country: withdrawForm.country.trim(),
                iban: withdrawForm.iban.trim(),
                bank_name: withdrawForm.bankName.trim(),
                swift_bic: withdrawForm.swift.trim(),
                currency: withdrawForm.currency.trim().toUpperCase(),
              };

      const { data, error } = await supabase.functions.invoke("request-affiliate-withdrawal", {
        body: {
          amount: availableEarnings,
          currency: "USD",
          method: withdrawForm.method,
          payout_details: payoutDetails,
        },
      });

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.message || "Could not request withdrawal.");
      }

      setWithdrawOpen(false);
      setSuccessMessage("Withdrawal request submitted. We’ll review it and pay manually.");
      await loadUserAndProfile();
    } catch (error) {
      console.error("[AccountAffiliate] withdrawal error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not request withdrawal."
      );
    } finally {
      setWithdrawSubmitting(false);
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
              Share your link or code, track performance and request manual payouts from your affiliate balance.
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

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
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
              Available affiliate earnings
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Manual payouts after approval
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock3 className="h-4 w-4 text-zinc-400" />
              Withdrawal history
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="text-sm text-zinc-500">Loading withdrawals...</div>
              ) : withdrawals.length ? (
                withdrawals.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-white">
                        {formatMoney(toMoneyNumber(item.amount))} · {methodLabel(item.method)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Requested {formatDate(item.requested_at)}
                      </div>
                    </div>

                    <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium capitalize text-zinc-300">
                      {item.status || "pending"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">No withdrawal requests yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.02] to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            <Wallet className="h-3.5 w-3.5" />
            Balance
          </div>

          <div className="mt-4 text-4xl font-semibold tracking-tight text-white">
            {formatMoney(availableEarnings)}
          </div>

          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Minimum withdrawal is {formatMoney(MIN_WITHDRAWAL_AMOUNT)}. Payouts are reviewed and paid manually.
          </p>

          {hasPendingWithdrawal ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              You already have a pending withdrawal request.
            </div>
          ) : availableEarnings < MIN_WITHDRAWAL_AMOUNT ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-400">
              Earn {formatMoney(MIN_WITHDRAWAL_AMOUNT - availableEarnings)} more to request a payout.
            </div>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            disabled={loading || !canWithdraw}
            onClick={() => setWithdrawOpen(true)}
            className="mt-6 w-full rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
          >
            Request Withdrawal
          </Button>
        </div>
      </section>

      {withdrawOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  <Wallet className="h-5 w-5" />
                </div>

                <h4 className="mt-5 text-xl font-semibold text-white">
                  Request withdrawal
                </h4>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  You are requesting {formatMoney(availableEarnings)}. We’ll review your details and pay manually.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawSubmitting}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { value: "revolut" as const, label: "Revolut", icon: Wallet },
                { value: "paypal" as const, label: "PayPal", icon: Mail },
                { value: "bank_transfer" as const, label: "Bank", icon: Building2 },
              ].map((option) => {
                const Icon = option.icon;
                const active = withdrawForm.method === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setWithdrawForm((current) => ({
                        ...current,
                        method: option.value,
                      }))
                    }
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                    <div className="mt-3 text-sm font-semibold">{option.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={withdrawForm.fullName}
                onChange={(event) =>
                  setWithdrawForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Full name"
                className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
              />

              <input
                value={withdrawForm.country}
                onChange={(event) =>
                  setWithdrawForm((current) => ({ ...current, country: event.target.value }))
                }
                placeholder="Country"
                className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
              />

              {withdrawForm.method === "revolut" ? (
                <input
                  value={withdrawForm.revolutContact}
                  onChange={(event) =>
                    setWithdrawForm((current) => ({
                      ...current,
                      revolutContact: event.target.value,
                    }))
                  }
                  placeholder="Revolut phone or email"
                  className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20 sm:col-span-2"
                />
              ) : null}

              {withdrawForm.method === "paypal" ? (
                <input
                  value={withdrawForm.paypalEmail}
                  onChange={(event) =>
                    setWithdrawForm((current) => ({
                      ...current,
                      paypalEmail: event.target.value,
                    }))
                  }
                  placeholder="PayPal email"
                  className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20 sm:col-span-2"
                />
              ) : null}

              {withdrawForm.method === "bank_transfer" ? (
                <>
                  <input
                    value={withdrawForm.iban}
                    onChange={(event) =>
                      setWithdrawForm((current) => ({ ...current, iban: event.target.value }))
                    }
                    placeholder="IBAN"
                    className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20 sm:col-span-2"
                  />

                  <input
                    value={withdrawForm.bankName}
                    onChange={(event) =>
                      setWithdrawForm((current) => ({ ...current, bankName: event.target.value }))
                    }
                    placeholder="Bank name"
                    className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
                  />

                  <input
                    value={withdrawForm.swift}
                    onChange={(event) =>
                      setWithdrawForm((current) => ({ ...current, swift: event.target.value }))
                    }
                    placeholder="SWIFT / BIC"
                    className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
                  />

                  <input
                    value={withdrawForm.currency}
                    onChange={(event) =>
                      setWithdrawForm((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase().slice(0, 3),
                      }))
                    }
                    placeholder="Currency"
                    className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
                  />
                </>
              ) : null}
            </div>

            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Make sure your payout details are correct. After submitting, the request is locked and reviewed manually.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={withdrawSubmitting}
                onClick={() => setWithdrawOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={withdrawSubmitting}
                onClick={() => void handleRequestWithdrawal()}
                className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
              >
                {withdrawSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit withdrawal"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}