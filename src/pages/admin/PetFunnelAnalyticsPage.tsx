import React, { useMemo, useState } from "react";
import { RefreshCcw, Database } from "lucide-react";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  formatPct,
  formatSignedPct,
  formatUsdFromCents,
  ofPreviousLabel,
  percentChange,
  type DatePreset,
} from "@/features/pet/funnelDashboard";
import { formatMetricOrDash } from "@/features/pet/funnelHybrid";
import { PET_FUNNEL_MEASUREMENT_RELIABLE_FROM, trackingCoverageSignal } from "@/features/pet/funnelEventContract";
import { FUNNEL_DATASETS, type FunnelDatasetId } from "@/features/pet/funnelDatasetConfig";
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
  photo_upload_completed: "photo selected (client-validated file)",
  order_review_viewed: "review viewed",
  initiate_checkout: "checkout started",
  purchase: "purchase",
  v2_landing_view: "v2 landing",
  v2_upload_started: "upload started",
  v2_upload_completed: "upload completed",
  v2_preview_generation_started: "preview generation started",
  v2_preview_generation_completed: "preview generation completed",
  v2_preview_viewed: "preview viewed",
  v2_offer_viewed: "offer viewed",
  v2_unlock_clicked: "unlock clicked",
  v2_begin_checkout: "begin checkout",
  v2_purchase: "v2 purchase",
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

function TrackingHealth({
  kpis,
  latestFirstPartyAt,
  failedWrites,
}: {
  kpis: { firstPartyLandings: number; metaLpv: number | null; lpv: number | null };
  latestFirstPartyAt: string | null | undefined;
  failedWrites: number | null;
}) {
  const metaLpv = kpis.metaLpv ?? kpis.lpv;
  const coverage = trackingCoverageSignal(kpis.firstPartyLandings, metaLpv);
  return (
    <SectionCard title="Tracking health" subtitle="Coverage signal only — not an attribution conversion rate.">
      {coverage.unhealthy ? (
        <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          First-party funnel tracking may be unhealthy.
        </p>
      ) : null}
      <p className="text-sm text-slate-300">
        Tracking coverage signal: {kpis.firstPartyLandings} FP landings
        {metaLpv != null ? ` / ${metaLpv} Meta LPV` : ""}
        {coverage.ratio == null ? "" : ` (${(coverage.ratio * 100).toFixed(0)}%)`}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Latest first-party event: {latestFirstPartyAt ? new Date(latestFirstPartyAt).toLocaleString("en-US") : "none in view"}
        {failedWrites == null ? "" : ` · Failed server writes: ${failedWrites}`}
      </p>
    </SectionCard>
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
    <div className="space-y-3">
      {daily.map((row) => (
        <div key={row.date} className="min-w-0 space-y-1 text-xs text-slate-300">
          <div className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 font-mono text-slate-400">{row.date.slice(5)}</span>
            <span className="min-w-0 truncate text-right text-slate-400">
              {row.spendCents == null ? "—" : formatUsdFromCents(row.spendCents)} · {row.purchases ?? "—"} sales
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500/70"
              style={{ width: `${Math.max(row.spendCents ? 4 : 0, ((row.spendCents ?? 0) / maxSpend) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PetFunnelAnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [datasetId, setDatasetId] = useState<FunnelDatasetId>("v1");
  const custom = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : undefined;
  const { loading, error, report, refresh, syncing, syncMessage, runSync } = usePetFunnelAnalytics(preset, custom, datasetId);
  const dataset = FUNNEL_DATASETS[datasetId];
  const labels = dataset.kpiLabels;

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
                "rounded-2xl border px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm",
                preset === item.id
                  ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="inline-flex max-w-full flex-wrap rounded-xl border border-slate-700 bg-slate-900 p-0.5">
          {(["v1", "v2"] as const).map((id) => {
            const item = FUNNEL_DATASETS[id];
            const selected = datasetId === id;
            const title =
              report?.datasetId === id && report.campaignLabel
                ? report.campaignLabel
                : `${item.shortLabel} - ${item.displayName}`;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDatasetId(id)}
                title={title}
                className={[
                  "max-w-[16rem] truncate rounded-lg px-2.5 py-1 text-[11px] font-medium transition sm:max-w-xs sm:px-3 sm:text-xs",
                  selected
                    ? "bg-indigo-500/20 text-indigo-100"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100",
                ].join(" ")}
              >
                {item.shortLabel} · {item.displayName}
              </button>
            );
          })}
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

        {datasetId === "v2" && report && report.datasetConfigured === false ? (
          <p className="text-sm text-amber-200/80">Campaign 2 not configured yet</p>
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
            Conversion rates are certified only after production measurement release
            {PET_FUNNEL_MEASUREMENT_RELIABLE_FROM
              ? ` (${new Date(PET_FUNNEL_MEASUREMENT_RELIABLE_FROM).toLocaleString("en-US")})`
              : " (timestamp unset until production deploy)"}
            .
          </p>
        ) : (
          <p className="text-sm text-amber-200/80">
            First-party tracking starts when the first pet_funnel_events row is recorded. Historical Meta/GA4/Stripe data is shown where available. Funnel conversion is not certified until the same-origin tracker is live in production.
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
            <SectionCard title="Meta acquisition" subtitle="Ads Insights only. Meta LPV is not the first-party funnel denominator.">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <StatCard label="Spend" value={formatMetricOrDash(kpis.spendCents, formatUsdFromCents)} helper={report.spendAvailable ? "Meta" : "Meta sync required"} />
                <StatCard label="Meta LPV" value={formatMetricOrDash(kpis.metaLpv ?? kpis.lpv)} helper="Meta Ads landing page views" />
                <StatCard label="CPC" value={formatMetricOrDash(kpis.cpcCents, formatUsdFromCents)} />
                <StatCard label="CTR" value={formatPct(kpis.ctrPct)} />
              </div>
            </SectionCard>

            <SectionCard
              title="First-party funnel"
              subtitle="Unique funnel_session_id counts from the same first-party event stream. Photo Selected = client-validated file, not storage upload."
            >
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label={labels.landing} value={formatMetricOrDash(kpis.firstPartyLandings)} helper={labels.landingHelper} />
                <StatCard
                  label={labels.step2}
                  value={formatMetricOrDash(kpis.names)}
                  helper={[kpis.namesSource.replace(/_/g, " "), ofPreviousLabel(kpis.names, kpis.firstPartyLandings, labels.step2Of)].filter(Boolean).join(" · ")}
                />
                <StatCard
                  label={labels.step3}
                  value={formatMetricOrDash(kpis.uploads)}
                  helper={[kpis.uploadsSource.replace(/_/g, " "), ofPreviousLabel(kpis.uploads, kpis.names, labels.step3Of)].filter(Boolean).join(" · ")}
                />
                <StatCard
                  label={labels.step4}
                  value={formatMetricOrDash(kpis.reviews)}
                  helper={[kpis.reviewsSource.replace(/_/g, " "), ofPreviousLabel(kpis.reviews, kpis.uploads, labels.step4Of)].filter(Boolean).join(" · ")}
                />
                <StatCard
                  label={labels.checkout}
                  value={formatMetricOrDash(kpis.checkouts)}
                  helper={["Production customer Stripe Checkout", ofPreviousLabel(kpis.checkouts, kpis.reviews, labels.checkoutOf)].filter(Boolean).join(" · ")}
                />
                <StatCard
                  label="Purchases"
                  value={String(kpis.purchases)}
                  helper={[comparisonHelper(kpis.purchases, report.previousSteps[5]?.sessions ?? 0) || "Paid production", ofPreviousLabel(kpis.purchases, kpis.checkouts, "checkouts")].filter(Boolean).join(" · ")}
                />
              </div>
            </SectionCard>

            <TrackingHealth
              kpis={kpis}
              latestFirstPartyAt={report.recent[0]?.createdAt ?? report.firstPartyTrackingStartedAt}
              failedWrites={report.trackingHealth?.failedWrites ?? null}
            />

            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
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
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-sm font-medium text-slate-200">
                              {dataset.stageLabels[step.eventName] || step.label}
                            </p>
                            <SourceBadge label={step.sourceLabel} />
                          </div>
                          <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                            {step.value == null ? "—" : step.value}
                          </p>
                        </div>
                        <div className="min-w-0 text-xs leading-snug text-slate-400 sm:shrink-0 sm:text-right">
                          {step.value == null ? (
                            <p className="break-words">Historical detail unavailable</p>
                          ) : (
                            <>
                              <p>{formatPct(step.fromLandingPct)} of first-party landing</p>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {speciesRows.map((row) => (
                  <div key={row.species} className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
                    <p className="text-sm font-semibold capitalize text-slate-100">{row.species}</p>
                    <p className="mt-2 text-lg font-semibold sm:text-xl">{row.purchase} sales</p>
                    <p className="mt-1 break-words text-xs leading-snug text-slate-500">
                      {row.lpv} LPV · {row.checkout} checkouts · {formatPct(row.cvr)} CVR · {formatUsdFromCents(row.revenueCents)}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {report.devices.length > 0 ? (
              <SectionCard title="Device" subtitle="First-party device when available. Country from GA4 sync is stored server-side only.">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {report.devices.map((row) => (
                    <div key={row.deviceType} className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
                      <p className="text-sm font-semibold capitalize text-slate-100">{row.deviceType}</p>
                      <p className="mt-1 break-words text-xs leading-snug text-slate-500">
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
