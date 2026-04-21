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

function sanitizeAffiliateCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

export default function AccountAffiliate() {
  const [copiedField, setCopiedField] = React.useState<"link" | "code" | null>(null);
  const [userEmail, setUserEmail] = React.useState("");
  const [affiliateCode, setAffiliateCode] = React.useState("RENTALCARS");
  const [draftCode, setDraftCode] = React.useState("RENTALCARS");

  React.useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUserEmail(user?.email ?? "");

      const fallbackCode = sanitizeAffiliateCode(
        (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          user?.email?.split("@")[0] ||
          "TDGUSER"
      );

      const finalCode = fallbackCode || "TDGUSER";

      setAffiliateCode(finalCode);
      setDraftCode(finalCode);
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const affiliateLink = React.useMemo(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://thedigitalgifter.com";

    return `${origin}/?ref=${encodeURIComponent(affiliateCode)}`;
  }, [affiliateCode]);

  const stats: ClientStat[] = [
    {
      label: "Entered on Link",
      value: "128",
      helper: "Total visits on your referral link",
      icon: "activity",
    },
    {
      label: "Conversions",
      value: "9",
      helper: "Paid customers attributed to your code",
      icon: "bookmark",
    },
    {
      label: "Affiliate Earnings",
      value: "$12",
      helper: "Available balance right now",
      icon: "coins",
    },
  ];

  async function copyValue(value: string, field: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch (error) {
      console.error(`[AccountAffiliate] failed to copy ${field}:`, error);
    }
  }

  function handleSaveCode() {
    const clean = sanitizeAffiliateCode(draftCode);

    if (!clean) return;

    setAffiliateCode(clean);
    setDraftCode(clean);
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
            <Button
              asChild
              className="rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200"
            >
              <Link to="/generator">
                Open Generator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
            >
              <Link to="/account/affiliate">Refresh Affiliate</Link>
            </Button>
          </div>
        </div>
      </section>

      <ClientStatsCards stats={stats} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <Link2 className="h-3.5 w-3.5" />
                Referral Link
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">
                Share your affiliate link
              </h2>

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
                  <div className="truncate">{affiliateLink}</div>
                </div>

                <Button
                  type="button"
                  onClick={() => copyValue(affiliateLink, "link")}
                  className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200"
                >
                  {copiedField === "link" ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Current email
              </div>
              <div className="mt-3 text-sm text-white">{userEmail || "No email found"}</div>
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

              <h2 className="mt-4 text-2xl font-semibold text-white">
                Manage your code
              </h2>

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
                  onChange={(event) =>
                    setDraftCode(sanitizeAffiliateCode(event.target.value))
                  }
                  placeholder="Write affiliate code"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
                />

                <Button
                  type="button"
                  onClick={handleSaveCode}
                  variant="secondary"
                  className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
                >
                  Save Code
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Active code
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold tracking-[0.16em] text-white">
                  {affiliateCode}
                </div>

                <Button
                  type="button"
                  onClick={() => copyValue(affiliateCode, "code")}
                  className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200"
                >
                  {copiedField === "code" ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                <MousePointerClick className="h-3.5 w-3.5" />
                Affiliate Notes
              </div>

              <h3 className="mt-4 text-xl font-semibold text-white">
                What this page is ready for
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Personal link display and copy action
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Editable affiliate code UI
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Top cards for clicks, conversions and earnings
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              Clean base for later Supabase tracking
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.02] to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            <DollarSign className="h-3.5 w-3.5" />
            Balance
          </div>

          <div className="mt-4 text-4xl font-semibold tracking-tight text-white">$12</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Initial UI value for available affiliate earnings.
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