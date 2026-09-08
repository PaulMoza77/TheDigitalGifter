import React from "react";
import { Link } from "react-router-dom";
import { RefreshCcw } from "lucide-react";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import { useFunnelAnalyticsRegistry } from "@/hooks/useFunnelAnalyticsRegistry";
import { FUNNEL_HEALTH_STATES, type FunnelHealthState } from "@/features/funnel-analytics/funnelHealth";
import type { FunnelChannelSnapshot } from "@/features/funnel-analytics/funnelAnalyticsService";

const HEALTH_STYLES: Record<FunnelHealthState, string> = {
  healthy: "border-emerald-700/70 bg-emerald-950/50 text-emerald-200",
  degraded: "border-amber-700/70 bg-amber-950/40 text-amber-200",
  unverified: "border-sky-800/70 bg-sky-950/40 text-sky-200",
  disabled: "border-slate-700 bg-slate-900/70 text-slate-400",
};

function HealthBadge({ state }: { state: FunnelHealthState }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${HEALTH_STYLES[state]}`}
    >
      {state}
    </span>
  );
}

function ChannelCell({ label, channel }: { label: string; channel: FunnelChannelSnapshot }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
        <HealthBadge state={channel.health} />
      </div>
      <p className="mt-1 break-words text-xs leading-5 text-slate-400">{channel.reason}</p>
    </div>
  );
}

export default function FunnelAnalyticsPage() {
  const { loading, error, report, refresh } = useFunnelAnalyticsRegistry();
  const rows = report?.rows ?? [];

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">Funnel Analytics</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Single registry of pet and Christmas funnels. Health is healthy, degraded, unverified, or
              disabled only. GA4 and Meta are never marked healthy without delivered sync rows. Production
              counts exclude founder / test traffic (Romania and Italy on pet).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh registry
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {FUNNEL_HEALTH_STATES.map((state) => (
            <StatCard
              key={state}
              label={state}
              value={loading ? "—" : String(report?.summary[state] ?? 0)}
              helper={state === "unverified" ? "Wired, no delivery evidence" : undefined}
            />
          ))}
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <SectionCard
          title="Required funnels"
          subtitle="Live evidence from Supabase event and sync tables. No mock runtime data."
        >
          {loading && !report ? (
            <p className="text-sm text-slate-400">Loading registry…</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <HealthBadge state={row.health} />
                        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          {row.family}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-100">
                          {row.shortLabel} — {row.displayName}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.routePath}
                        {row.ingestPath ? ` · ingest ${row.ingestPath}` : ""}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{row.notes}</p>
                      {row.detailPath ? (
                        <Link
                          to={row.detailPath}
                          className="mt-2 inline-block text-sm text-sky-300 underline underline-offset-2"
                        >
                          Open detailed pet dashboard
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <ChannelCell label="First-party" channel={row.firstParty} />
                    <ChannelCell label="GA4" channel={row.ga4} />
                    <ChannelCell label="Meta" channel={row.meta} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
