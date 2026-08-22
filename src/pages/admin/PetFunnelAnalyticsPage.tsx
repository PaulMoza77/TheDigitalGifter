import React, { useMemo, useState } from "react";
import { RefreshCcw, Database } from "lucide-react";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  formatPct,
  formatSignedPct,
  formatUsdFromCents,
  percentChange,
  type DatePreset,
} from "@/features/pet/funnelDashboard";
import { formatMetricOrDash } from "@/features/pet/funnelHybrid";
import { usePetFunnelAnalytics } from "@/hooks/usePetFunnelAnalytics";

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "custom", label: "Custom" },
];

const EVENT_COPY: Record<string, string> = {
  landing_view: "dog landing",
  pet_name_submitted: "name submitted",
  photo_upload_completed: "photo uploaded",
  order_review_viewed: "review viewed",
  initiate_checkout: "checkout started",
  purchase: "purchase",
};

function comparisonHelper(current: number, previous: number): string | undefined {
  const change = formatSignedPct(percentChange(current, previous));
  return change ? `${change} vs previous period` : undefined;
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-slate-700/80 bg-slate-900/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
      {label}
    </span>
  );
}

function formatRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

function DailyBars({ daily }: { daily: Array<{ date: string; spendCents: number | null; purchases: number | null }> }) {
  const maxSpend = Math.max(1, ...daily.map((d) => d.spendCents ?? 0));
  if (daily.length === 0) return <p className="text-sm text-slate-500">No daily rows in this range.</p>;
  return (
    <div className="space-y-2">
      {daily.map((row) => (
        <div key={row.date} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-xs text-slate-300">
          <span className="font-mono text-slate-400">{row.date.slice(5)}</span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500/70"
              style={{ width: `${Math.max(row.spendCents ? 4 : 0, ((row.spendCents ?? 0) / maxSpend) * 100)}%` }}
            />
          </div>
          <span className="w-28 text-right text-slate-400">
            {row.spendCents == null ? "—" : formatUsdFromCents(row.spendCents)} · {row.purchases ?? "—"} sales
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PetFunnelAnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const custom = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : undefined;
  const { loading, error, report, refresh, syncing, syncMessage, runSync } = usePetFunnelAnalytics(preset, custom);

  const speciesRows = useMemo(() => {
    const bySpecies = new Map(report?.species.map((row) => [row.species, row]) ?? []);
    return (["dog", "cat", "other"] as const).map((species) => {
      return (
        bySpecies.get(species) || {
          species,
          lpv: 0,
          checkout: 0,
          purchase: 0,
          cvr: null,
          revenueCents: 0,
        }
      );
    });
  }, [report]);

  const hybridStages = report?.hybridStages ?? [];
  const maxSessions = Math.max(1, ...hybridStages.map((step) => step.value ?? 0), 1);
  const kpis = report?.hybridKpis;

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">Pet Funnel Analytics</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Hybrid daily overview: first-party funnel, Stripe-verified purchases, Meta Ads spend, and GA4 traffic where configured.
              Sources are never summed as separate people.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh data
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void runSync("today_yesterday")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              {syncing ? "Syncing…" : "Sync today / yesterday"}
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void runSync("historical")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              Sync historical data
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={[
                "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                preset === item.id
                  ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        ) : null}

        {report?.firstPartyTrackingStartedAt ? (
          <p className="text-sm text-slate-400">
            Detailed first-party funnel tracking active since{" "}
            {new Date(report.firstPartyTrackingStartedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
            {report.rangeMode === "first_party"
              ? " This range uses first-party unique-session funnel + Stripe purchase truth."
              : report.rangeMode === "mixed"
                ? " This range crosses the tracking boundary — historical and first-party sources are both shown."
                : " This range is before first-party tracking — Meta/GA4/Stripe historical data is shown where available."}
          </p>
        ) : (
          <p className="text-sm text-amber-200/80">
            First-party tracking starts when the first pet_funnel_events row is recorded. Historical Meta/GA4/Stripe data is shown where available.
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>
            Meta last synced:{" "}
            {report?.sync.metaLastSyncedAt ? new Date(report.sync.metaLastSyncedAt).toLocaleString("en-US") : "never"}
            {report?.sync.metaConfigured === false ? " · Meta historical sync not configured" : ""}
          </span>
          <span>
            GA4 last synced:{" "}
            {report?.sync.ga4LastSyncedAt ? new Date(report.sync.ga4LastSyncedAt).toLocaleString("en-US") : "never"}
            {report?.sync.ga4Configured === false ? " · GA4 historical sync not configured" : ""}
          </span>
          {syncMessage ? <span className="text-slate-300">{syncMessage}</span> : null}
        </div>

        {error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
        ) : null}

        {loading && !report ? (
          <p className="text-sm text-slate-400">Loading funnel analytics…</p>
        ) : null}

        {report && kpis ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <StatCard label="Spend" value={formatMetricOrDash(kpis.spendCents, formatUsdFromCents)} helper={report.spendAvailable ? "Meta" : "Meta sync required"} />
              <StatCard label="LPV" value={formatMetricOrDash(kpis.lpv)} helper={kpis.lpvSource.replace(/_/g, " ")} />
              <StatCard label="CPC" value={formatMetricOrDash(kpis.cpcCents, formatUsdFromCents)} />
              <StatCard label="CTR" value={formatPct(kpis.ctrPct)} />
              <StatCard label="Names Submitted" value={formatMetricOrDash(kpis.names)} helper={kpis.namesSource.replace(/_/g, " ")} />
              <StatCard label="Photo Uploads" value={formatMetricOrDash(kpis.uploads)} helper={kpis.uploadsSource.replace(/_/g, " ")} />
              <StatCard label="Order Reviews" value={formatMetricOrDash(kpis.reviews)} helper={kpis.reviewsSource.replace(/_/g, " ")} />
              <StatCard
                label="Initiate Checkouts"
                value={formatMetricOrDash(kpis.checkouts)}
                helper="Production customer Stripe Checkout"
              />
              <StatCard
                label="Purchases"
                value={String(kpis.purchases)}
                helper={comparisonHelper(kpis.purchases, report.previousSteps[5]?.sessions ?? 0) || "Paid production"}
              />
              <StatCard
                label="Revenue"
                value={formatUsdFromCents(kpis.revenueCents)}
                helper={comparisonHelper(kpis.revenueCents, report.kpis.previousRevenueCents) || "Paid production"}
              />
              <StatCard
                label="Free / 100% Discount Orders"
                value={String(kpis.freeDiscountOrders)}
                helper="Excluded from CPA / ROAS"
              />
              <StatCard label="Cost per Checkout" value={formatMetricOrDash(kpis.costPerCheckoutCents, formatUsdFromCents)} />
              <StatCard label="CPA" value={formatMetricOrDash(kpis.cpaCents, formatUsdFromCents)} />
              <StatCard label="ROAS" value={formatRoas(kpis.roas)} helper="Stripe revenue / Meta spend" />
              <StatCard label="Landing → Purchase" value={formatPct(kpis.landingToPurchase)} />
            </div>

            {report.warnings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {report.warnings.map((warning) => (
                  <span key={warning} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            <SectionCard
              title="Funnel"
              subtitle={
                report.biggestDrop
                  ? `Biggest drop: ${report.biggestDrop.from} → ${report.biggestDrop.to} (-${report.biggestDrop.dropPct.toFixed(0)}%)`
                  : report.rangeMode === "first_party"
                    ? "Unique first-party funnel sessions"
                    : "Hybrid funnel — unavailable stages show — (not zero)"
              }
            >
              <div className="space-y-4">
                {hybridStages.map((step, index) => (
                  <div key={step.eventName}>
                    {index > 0 ? <div className="mb-3 text-center text-slate-600">↓</div> : null}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200">{step.label}</p>
                            <SourceBadge label={step.sourceLabel} />
                          </div>
                          <p className="mt-1 text-2xl font-semibold text-white">
                            {step.value == null ? "—" : step.value}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          {step.value == null ? (
                            <p>Historical detail unavailable</p>
                          ) : (
                            <>
                              <p>{formatPct(step.fromLandingPct)} of LPV</p>
                              <p>{index === 0 ? "100% start" : `${formatPct(step.fromPreviousPct)} from previous`}</p>
                            </>
                          )}
                        </div>
                      </div>
                      {step.value != null ? (
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${Math.max(4, (step.value / maxSessions) * 100)}%` }}
                          />
                        </div>
                      ) : (
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Campaign / ad set / ad"
              subtitle={
                report.spendAvailable
                  ? "Meta Ads Insights spend with attributed conversions. ROAS = attributed purchase value / spend."
                  : "Configure Meta Ads Insights credentials (ad account + ads_read token) and run Sync historical data to populate spend."
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Campaign", "Ad Set", "Ad", "Spend", "Impressions", "LPV", "CPC", "CTR", "Checkout", "Purchase", "Revenue", "CPA", "ROAS"].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-6 text-slate-500">
                          No campaign rows in this range.
                        </td>
                      </tr>
                    ) : (
                      report.campaigns.map((row) => (
                        <tr key={`${row.campaign}-${row.campaignId || row.sourceGroup}`} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-100">{row.campaign}</td>
                          <td className="px-3 py-2 text-slate-300">{row.adSet}</td>
                          <td className="px-3 py-2 text-slate-300">{row.ad}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.spendCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.impressions ?? null)}</td>
                          <td className="px-3 py-2">{row.lpv}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.cpcCentsComputed ?? null, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatPct(row.ctrPct ?? null)}</td>
                          <td className="px-3 py-2">{row.checkout}</td>
                          <td className="px-3 py-2">{row.purchase}</td>
                          <td className="px-3 py-2">{formatUsdFromCents(row.revenueCents)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.cpaCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatRoas(row.roas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Creative comparison" subtitle="Meta ad-level metrics for comparing Dog creatives. First-party uploads appear when ad_id attribution exists.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Ad", "Ad ID", "Spend", "Impressions", "Link clicks", "LPV", "CPC", "CTR", "FP uploads", "Checkout", "Purchase", "Revenue", "CPA", "ROAS"].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.metaAds.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="px-3 py-6 text-slate-500">
                          No Meta ad rows yet. Run Sync historical data after configuring Ads credentials.
                        </td>
                      </tr>
                    ) : (
                      report.metaAds.map((row) => (
                        <tr key={`${row.adId}-${row.adsetId}`} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-100">{row.adName}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.adId || "—"}</td>
                          <td className="px-3 py-2">{formatUsdFromCents(row.spendCents)}</td>
                          <td className="px-3 py-2">{row.impressions}</td>
                          <td className="px-3 py-2">{row.linkClicks}</td>
                          <td className="px-3 py-2">{row.lpv}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.cpcCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatPct(row.ctrPct)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.firstPartyUploads)}</td>
                          <td className="px-3 py-2">{row.checkout}</td>
                          <td className="px-3 py-2">{row.purchase}</td>
                          <td className="px-3 py-2">{formatUsdFromCents(row.revenueCents)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.cpaCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatRoas(row.roas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Daily performance" subtitle="Date · Spend · LPV · Checkout · Purchases · Revenue · ROAS">
              <div className="overflow-x-auto">
                <table className="mb-4 min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Date", "Spend", "LPV", "Checkout", "Purchases", "Revenue", "ROAS"].map((label) => (
                        <th key={label} className="px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-slate-500">
                          No daily rows yet.
                        </td>
                      </tr>
                    ) : (
                      report.daily.map((row) => (
                        <tr key={row.date} className="border-t border-slate-800">
                          <td className="px-3 py-2 font-mono text-slate-300">{row.date}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.spendCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.lpv)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.checkout)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.purchases)}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.revenueCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{formatRoas(row.roas)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <DailyBars daily={report.daily} />
            </SectionCard>

            <SectionCard title="Species">
              <div className="grid gap-3 sm:grid-cols-3">
                {speciesRows.map((row) => (
                  <div key={row.species} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-sm font-semibold capitalize text-slate-100">{row.species}</p>
                    <p className="mt-2 text-xl font-semibold">{row.purchase} sales</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.lpv} LPV · {row.checkout} checkouts · {formatPct(row.cvr)} CVR · {formatUsdFromCents(row.revenueCents)}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {report.devices.length > 0 ? (
              <SectionCard title="Device" subtitle="First-party device when available. Country from GA4 sync is stored server-side only.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {report.devices.map((row) => (
                    <div key={row.deviceType} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-sm font-semibold capitalize text-slate-100">{row.deviceType}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.lpv} LPV · {row.checkout} checkouts · {row.purchase} purchases
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Recent activity" subtitle="First-party events in range">
              <div className="space-y-2">
                {report.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">No first-party funnel events in this range.</p>
                ) : (
                  report.recent.map((item, index) => (
                    <p key={`${item.createdAt}-${index}`} className="text-sm text-slate-300">
                      {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {item.species || "pet"} {EVENT_COPY[item.eventName] || item.eventName}
                      {item.eventName === "purchase" && item.amountCents
                        ? ` ${formatUsdFromCents(item.amountCents)}`
                        : ""}
                      {item.sessionShort ? ` · ${item.sessionShort}` : ""}
                    </p>
                  ))
                )}
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
