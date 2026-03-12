import React from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import ClientStatsCards from "@/components/client/ClientStatsCards";
import RecentGenerations from "@/components/client/RecentGenerations";
import ContinueCreatingCard from "@/components/client/ContinueCreatingCard";
import AccountInfoCard from "@/components/client/AccountInfoCard";
import NeedHelpCard from "@/components/client/NeedHelpCard";
import UsageSummaryCard from "@/components/client/UsageSummaryCard";

import type { ClientGeneration, ClientStat } from "@/components/client/types";

type DashboardSummaryRow = {
  user_id: string;
  credits_balance: number | null;
  credits_used: number | null;
  total_purchased: number | null;
  total_generations: number | null;
  saved_results_count: number | null;
  recent_activity_count: number | null;
};

type GenerationRow = {
  id: string;
  user_id: string | null;
  status: string | null;
  final_image_url: string | null;
  result_image_url: string | null;
  preview_image_url: string | null;
  created_at: string | null;
};

function formatRelativeDate(value?: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} min ago`;
  if (diffMs < day) return `${Math.max(1, Math.floor(diffMs / hour))} hours ago`;
  if (diffMs < day * 7) return `${Math.max(1, Math.floor(diffMs / day))} days ago`;

  return date.toLocaleDateString();
}

function mapStatus(status?: string | null): ClientGeneration["status"] {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "completed") return "Completed";
  if (normalized === "saved") return "Saved";
  if (normalized === "processing" || normalized === "pending") return "Processing";

  return "Saved";
}

function buildGenerationTitle(item: GenerationRow, index: number) {
  const shortId = item.id?.slice(0, 8).toUpperCase();
  return `Creation #${shortId || String(index + 1)}`;
}

function resolveGenerationImage(item: GenerationRow) {
  const finalUrl = (item.final_image_url || "").trim();
  const resultUrl = (item.result_image_url || "").trim();
  const previewUrl = (item.preview_image_url || "").trim();

  if (finalUrl) return finalUrl;
  if (resultUrl) return resultUrl;
  if (previewUrl) return previewUrl;

  return null;
}

function resolveGenerationStyle(item: GenerationRow) {
  const finalUrl = (item.final_image_url || "").trim();
  const resultUrl = (item.result_image_url || "").trim();
  const previewUrl = (item.preview_image_url || "").trim();
  const normalized = String(item.status || "").trim().toLowerCase();

  if (finalUrl) return "Final Result";
  if (resultUrl) return "Saved Result";
  if (previewUrl && (normalized === "processing" || normalized === "pending")) {
    return "Preview";
  }
  if (previewUrl) return "Saved Preview";

  return "AI Creation";
}

function normalizeSummaryRow(input: unknown): DashboardSummaryRow | null {
  if (!input || typeof input !== "object") return null;

  const row = input as Record<string, unknown>;

  return {
    user_id: String(row.user_id || ""),
    credits_balance:
      typeof row.credits_balance === "number" ? row.credits_balance : Number(row.credits_balance ?? 0),
    credits_used:
      typeof row.credits_used === "number" ? row.credits_used : Number(row.credits_used ?? 0),
    total_purchased:
      typeof row.total_purchased === "number" ? row.total_purchased : Number(row.total_purchased ?? 0),
    total_generations:
      typeof row.total_generations === "number" ? row.total_generations : Number(row.total_generations ?? 0),
    saved_results_count:
      typeof row.saved_results_count === "number"
        ? row.saved_results_count
        : Number(row.saved_results_count ?? 0),
    recent_activity_count:
      typeof row.recent_activity_count === "number"
        ? row.recent_activity_count
        : Number(row.recent_activity_count ?? 0),
  };
}

function normalizeGenerationRows(input: unknown): GenerationRow[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const r = row as Record<string, unknown>;

      return {
        id: String(r.id || ""),
        user_id: r.user_id ? String(r.user_id) : null,
        status: r.status ? String(r.status) : null,
        final_image_url: r.final_image_url ? String(r.final_image_url) : null,
        result_image_url: r.result_image_url ? String(r.result_image_url) : null,
        preview_image_url: r.preview_image_url ? String(r.preview_image_url) : null,
        created_at: r.created_at ? String(r.created_at) : null,
      };
    })
    .filter((row) => Boolean(row.id));
}

export default function AccountDashboard() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [summary, setSummary] = React.useState<DashboardSummaryRow | null>(null);
  const [recentRows, setRecentRows] = React.useState<GenerationRow[]>([]);
  const [generationsLoadError, setGenerationsLoadError] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setGenerationsLoadError("");

        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (authError) {
          console.error("[AccountDashboard] auth error:", authError);
        }

        setUser(authUser ?? null);

        if (!authUser) {
          setIsAdmin(false);
          setSummary(null);
          setRecentRows([]);
          setLoading(false);
          return;
        }

        const email = authUser.email?.trim().toLowerCase() ?? "";

        const [summaryRes, adminRes] = await Promise.all([
          supabase
            .from("client_dashboard_summary")
            .select(
              "user_id, credits_balance, credits_used, total_purchased, total_generations, saved_results_count, recent_activity_count"
            )
            .eq("user_id", authUser.id)
            .maybeSingle(),

          supabase
            .from("admin_users")
            .select("email")
            .eq("email", email)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        if (summaryRes.error) {
          console.error("[AccountDashboard] summary error:", summaryRes.error);
        }

        if (adminRes.error) {
          console.error("[AccountDashboard] admin check error:", adminRes.error);
        }

        setIsAdmin(Boolean(adminRes.data?.email));
        setSummary(normalizeSummaryRow(summaryRes.data));

        const generationsRes = await supabase
          .from("generations")
          .select(
            "id, user_id, status, final_image_url, result_image_url, preview_image_url, created_at"
          )
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!mounted) return;

        if (generationsRes.error) {
          console.error("[AccountDashboard] generations error:", generationsRes.error);
          setGenerationsLoadError(generationsRes.error.message || "Failed to load generations.");
          setRecentRows([]);
        } else {
          const normalizedRows = normalizeGenerationRows(generationsRes.data);
          setRecentRows(normalizedRows);

          if (
            normalizedRows.length === 0 &&
            Number(summaryRes.data?.total_generations ?? 0) > 0
          ) {
            setGenerationsLoadError(
              "Generations exist for this account, but the list query returned no rows."
            );
          }
        }
      } catch (error) {
        console.error("[AccountDashboard] fatal:", error);

        if (!mounted) return;

        setIsAdmin(false);
        setSummary(null);
        setRecentRows([]);
        setGenerationsLoadError(
          error instanceof Error ? error.message : "Failed to load dashboard."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const completedCreations = React.useMemo(
    () =>
      recentRows.filter((item) => {
        const s = String(item.status || "").trim().toLowerCase();
        return s === "completed" || s === "saved";
      }).length,
    [recentRows]
  );

  const inProgress = React.useMemo(
    () =>
      recentRows.filter((item) => {
        const s = String(item.status || "").trim().toLowerCase();
        return s === "pending" || s === "processing";
      }).length,
    [recentRows]
  );

  const totalGenerations =
    recentRows.length > 0
      ? recentRows.length
      : Number(summary?.total_generations ?? 0);

  const remainingCredits = Number(summary?.credits_balance ?? 0);
  const savedResults =
    recentRows.length > 0
      ? recentRows.filter((item) => String(item.status || "").trim().toLowerCase() === "saved")
          .length
      : Number(summary?.saved_results_count ?? 0);

  const recentActivity =
    recentRows.length > 0 ? recentRows.length : Number(summary?.recent_activity_count ?? 0);

  const creditsUsed = Number(summary?.credits_used ?? 0);

  const stats: ClientStat[] = [
    {
      label: "Total Generations",
      value: String(totalGenerations),
      helper: "All-time creations",
      icon: "sparkles",
    },
    {
      label: "Remaining Credits",
      value: String(remainingCredits),
      helper: `${creditsUsed} used so far`,
      icon: "coins",
    },
    {
      label: "Saved Results",
      value: String(savedResults),
      helper: "Saved in your account",
      icon: "bookmark",
    },
    {
      label: "Recent Activity",
      value: String(recentActivity),
      helper: "Last 7 days",
      icon: "activity",
    },
  ];

  const recentGenerations: ClientGeneration[] = React.useMemo(
    () =>
      recentRows.map((item, index) => ({
        id: item.id,
        title: buildGenerationTitle(item, index),
        occasion: "AI Creation",
        style: resolveGenerationStyle(item),
        status: mapStatus(item.status),
        createdAt: formatRelativeDate(item.created_at),
        imageUrl: resolveGenerationImage(item),
        resultHref: `/funnel/result?id=${encodeURIComponent(item.id)}`,
      })),
    [recentRows]
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-6 shadow-[0_20px_60px_rgba(0,0,0,0.26)] sm:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              Client Dashboard
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Welcome back, {firstName}.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Access your creations, monitor credits and continue building new visuals from one premium workspace.
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
              className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <Link to="/account/dashboard">Refresh Overview</Link>
            </Button>

            {isAdmin ? (
              <Button
                asChild
                variant="secondary"
                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
              >
                <Link to="/admin">
                  Admin Panel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-[28px] border border-amber-400/15 bg-gradient-to-br from-amber-400/10 via-white/[0.02] to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                <Shield className="h-3.5 w-3.5" />
                Admin Access
              </div>

              <h2 className="mt-3 text-2xl font-semibold text-white">Admin Panel</h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                You are logged in as an admin. Open the admin area to manage templates,
                funnel settings, credits, orders and customers.
              </p>
            </div>

            <div className="shrink-0">
              <Button
                asChild
                className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200"
              >
                <Link to="/admin">
                  Open Admin Panel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <ClientStatsCards stats={stats} />

      {generationsLoadError ? (
        <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-white">
          {generationsLoadError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.5fr)_420px]">
        <RecentGenerations items={recentGenerations} />

        <div className="space-y-6">
          <ContinueCreatingCard />
          <UsageSummaryCard
            creditsAvailable={remainingCredits}
            completedCreations={completedCreations}
            inProgress={inProgress}
            savedItems={savedResults}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AccountInfoCard user={user} />
        <NeedHelpCard />
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-400">
          Loading account data...
        </div>
      ) : null}
    </div>
  );
}