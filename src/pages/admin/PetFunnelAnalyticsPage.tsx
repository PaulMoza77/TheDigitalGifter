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
import { trackingCoverageSignal } from "@/features/pet/funnelEventContract";
import {
  buildCompareRows,
  buildSelectorOptions,
  funnelVariantNotice,
  measurementReliability,
  type CampaignViewMode,
  type FunnelVariant,
} from "@/features/pet/funnelCampaignAnalytics";
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

function formatRoas(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

function TrackingHealth({
  firstPartyLandings,
  metaLpv,
  latestFirstPartyAt,
  failedWrites,
}: {
  firstPartyLandings: number;
  metaLpv: number | null;
  latestFirstPartyAt: string | null | undefined;
  failedWrites: number | null;
}) {
  const coverage = trackingCoverageSignal(firstPartyLandings, metaLpv);
  return (
    <SectionCard title="Tracking health" subtitle="Measurement coverage signal — not a conversion rate.">
      {coverage.unhealthy ? (
        <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          ⚠ Campaign first-party tracking may be unhealthy
        </p>
      ) : null}
      <p className="text-sm text-slate-300">
        Measurement coverage signal: {firstPartyLandings} FP sessions
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

function FunnelViz({
  stages,
  subtitle,
}: {
  stages: Array<{ eventName: string; label: string; sessions: number; fromPreviousPct: number | null; fromLandingPct: number | null }>;
  subtitle?: string;
}) {
  const maxSessions = Math.max(1, ...stages.map((step) => step.sessions), 1);
  return (
    <SectionCard title="First-party funnel" subtitle={subtitle || "Unique funnel_session_id counts. First-party denominators only — Meta LPV is never used here."}>
      <div className="space-y-4">
        {stages.map((step, index) => (
          <div key={step.eventName}>
            {index > 0 ? (
              <div className="mb-3 text-center text-sm text-slate-400">
                ↓ {step.fromPreviousPct == null ? "" : `${stages[index - 1]?.label} → ${step.label}: ${formatPct(step.fromPreviousPct, 0)}`}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words text-sm font-medium text-slate-200">{step.label}</p>
                    <SourceBadge label="First-party" />
                  </div>
                  <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{step.sessions}</p>
                </div>
                <div className="min-w-0 text-xs leading-snug text-slate-400 sm:shrink-0 sm:text-right">
                  <p>{formatPct(step.fromLandingPct)} of first-party landing</p>
                  <p>{index === 0 ? "100% start" : `${formatPct(step.fromPreviousPct)} from previous`}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${Math.max(4, (step.sessions / maxSessions) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function PetFunnelAnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewMode, setViewMode] = useState<CampaignViewMode>("all");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [adsetId, setAdsetId] = useState<string | null>(null);
  const [mappingVariant, setMappingVariant] = useState<FunnelVariant | "">("");
  const [mappingBusy, setMappingBusy] = useState(false);
  const custom = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : undefined;
  const { loading, error, report, refresh, syncing, syncMessage, runSync, saveCampaignMapping } = usePetFunnelAnalytics(
    preset,
    custom,
    { mode: viewMode, campaignId, adsetId },
  );

  const selectorOptions = useMemo(
    () => buildSelectorOptions(report?.catalog || []),
    [report?.catalog],
  );

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

  const kpis = report?.hybridKpis;
  const selectedCampaign = (report?.catalog || []).find((row) => row.campaignId === campaignId) || null;
  const reliability = measurementReliability({
    rangeFromIso: report?.from || "",
    rangeToIso: report?.to || "",
    measurementReliableFrom: selectedCampaign?.measurementReliableFrom || report?.measurementReliableFrom || null,
  });
  const compareRows = useMemo(
    () => (viewMode === "compare" ? buildCompareRows(report?.campaignSummaries || []) : []),
    [viewMode, report?.campaignSummaries],
  );

  function selectView(next: CampaignViewMode, nextCampaignId: string | null) {
    setViewMode(next);
    setCampaignId(nextCampaignId);
    setAdsetId(null);
    setMappingVariant("");
  }

  async function saveMapping() {
    if (!campaignId || !mappingVariant) return;
    setMappingBusy(true);
    try {
      await saveCampaignMapping({
        campaignId,
        funnelVariant: mappingVariant,
        displayName: selectedCampaign?.displayName,
        utmCampaignAliases: selectedCampaign?.utmCampaignAliases,
      });
    } finally {
      setMappingBusy(false);
    }
  }

  const fpLanding =
    report?.funnelVariant === "v2_preview"
      ? report.v2Kpis
        ? report.variantStages?.[0]?.sessions || 0
        : 0
      : kpis?.firstPartyLandings || 0;

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">Pet Funnel Analytics</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Campaign-scoped Meta spend and first-party funnel. Sources are never summed as separate people.
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

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Date range</p>
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

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Campaign</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectorOptions.map((option) => {
              const active =
                option.mode === viewMode &&
                (option.mode !== "campaign" || option.campaignId === campaignId);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectView(option.mode, option.campaignId)}
                  className={[
                    "shrink-0 rounded-2xl border px-3 py-2 text-sm font-medium transition",
                    active
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {report?.dateFilterNote ? (
          <p className="text-xs text-slate-500">{report.dateFilterNote}</p>
        ) : null}

        {reliability.crosses && reliability.label ? (
          <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {reliability.label} Historical detail unavailable for first-party stages before that timestamp.
          </p>
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
            . Conversion rates are certified only after each campaign’s measurement-reliable timestamp.
          </p>
        ) : (
          <p className="text-sm text-amber-200/80">
            First-party tracking starts when the first pet_funnel_events row is recorded. Historical Meta/Stripe data is shown where available.
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

        {report && kpis && viewMode === "all" ? (
          <>
            <SectionCard title="Overall business" subtitle="Totals across allowlisted campaigns. Funnel variants are not merged.">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                <StatCard label="Spend" value={formatMetricOrDash(kpis.spendCents, formatUsdFromCents)} helper="Meta" />
                <StatCard label="Checkouts" value={String(kpis.checkouts ?? 0)} helper="Stripe customer checkouts" />
                <StatCard label="Purchases" value={String(kpis.purchases)} helper="Paid production" />
                <StatCard label="Revenue" value={formatUsdFromCents(kpis.revenueCents)} />
                <StatCard label="CPA" value={formatMetricOrDash(kpis.cpaCents, formatUsdFromCents)} />
                <StatCard label="ROAS" value={formatRoas(kpis.roas)} helper="Stripe revenue / Meta spend" />
              </div>
            </SectionCard>
            <SectionCard title="Campaign summary" subtitle="Each row is isolated by campaign_id. V1 and V2 stages are not combined.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Campaign", "Variant", "Spend", "Meta LPV", "FP Landing", "Checkout", "Purchase", "CPA"].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(report.campaignSummaries || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-slate-500">
                          No allowlisted campaigns yet. Add a Meta campaign ID to the allowlist / PET_META_CAMPAIGN_IDS, then sync.
                        </td>
                      </tr>
                    ) : (
                      (report.campaignSummaries || []).map((row) => (
                        <tr key={row.campaignId} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-100">{row.displayName}</td>
                          <td className="px-3 py-2 text-slate-300">{row.funnelVariant || "not configured"}</td>
                          <td className="px-3 py-2">{formatMetricOrDash(row.spendCents, formatUsdFromCents)}</td>
                          <td className="px-3 py-2">{row.metaLpv}</td>
                          <td className="px-3 py-2">{row.funnelVariant ? row.fpLanding : "—"}</td>
                          <td className="px-3 py-2">{row.funnelVariant ? row.checkout : "—"}</td>
                          <td className="px-3 py-2">{row.funnelVariant ? row.purchase : "—"}</td>
                          <td className="px-3 py-2">
                            {row.funnelVariant ? formatMetricOrDash(row.spendCents == null ? null : row.purchase > 0 && row.spendCents != null ? Math.round(row.spendCents / row.purchase) : null, formatUsdFromCents) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            {report.unattributed ? (
              <p className="text-sm text-slate-400">
                Unattributed first-party landings: {report.unattributed.v1Landings + report.unattributed.v2Landings}
                {report.unattributed.pct == null ? "" : ` (${formatPct(report.unattributed.pct)} of FP landings)`}.
                These are not assigned to a paid campaign.
              </p>
            ) : null}
          </>
        ) : null}

        {report && viewMode === "compare" ? (
          <SectionCard title="Compare campaigns" subtitle="Common business milestones only. Variant-specific stages keep their own labels.">
            {(report.campaignSummaries || []).length < 1 ? (
              <p className="text-sm text-slate-500">Need at least one allowlisted campaign to compare.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">KPI</th>
                      {(report.campaignSummaries || []).map((campaign) => (
                        <th key={campaign.campaignId} className="whitespace-nowrap px-3 py-2 font-medium">
                          {campaign.displayName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.key} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-slate-200">
                          {row.label}
                          {row.incompatible ? <span className="ml-2 text-[10px] uppercase text-slate-500">variant-specific</span> : null}
                        </td>
                        {row.values.map((cell) => (
                          <td key={`${row.key}-${cell.campaignId}`} className="px-3 py-2 text-right text-slate-100">
                            {cell.display}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}

        {report && kpis && (viewMode === "campaign" || viewMode === "unattributed") ? (
          <>
            {viewMode === "campaign" && selectedCampaign && !selectedCampaign.funnelVariant ? (
              <SectionCard title="Funnel variant not configured" subtitle="Meta metrics are shown. First-party stages are hidden until you map this campaign_id.">
                <p className="mb-3 text-sm text-amber-100">
                  {funnelVariantNotice(null)}. Do not infer V1 vs V2 from the campaign name.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm text-slate-300">
                    Funnel variant
                    <select
                      value={mappingVariant}
                      onChange={(event) => setMappingVariant(event.target.value as FunnelVariant | "")}
                      className="mt-1 block rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="">Select…</option>
                      <option value="v1">v1</option>
                      <option value="v2_preview">v2_preview</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!mappingVariant || mappingBusy}
                    onClick={() => void saveMapping()}
                    className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:opacity-50"
                  >
                    {mappingBusy ? "Saving…" : "Save mapping"}
                  </button>
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Acquisition — Meta" subtitle="Ads Insights only. Meta LPV is not the first-party funnel denominator.">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <StatCard label="Spend" value={formatMetricOrDash(kpis.spendCents, formatUsdFromCents)} helper={report.spendAvailable ? "Meta" : "Meta sync required"} />
                <StatCard label="Meta LPV" value={formatMetricOrDash(kpis.metaLpv ?? kpis.lpv)} helper="Meta Ads landing page views" />
                <StatCard label="CPC" value={formatMetricOrDash(kpis.cpcCents, formatUsdFromCents)} />
                <StatCard label="CTR" value={formatPct(kpis.ctrPct)} />
              </div>
            </SectionCard>

            {viewMode === "unattributed" ? (
              <SectionCard title="Unattributed traffic" subtitle="Sessions with no campaign_id and no unique utm_campaign alias. Not assigned to a paid campaign.">
                <p className="text-sm text-slate-300">
                  {report.unattributed?.v1Landings || 0} V1 landings · {report.unattributed?.v2Landings || 0} V2 landings
                  {report.unattributed?.pct == null ? "" : ` · ${formatPct(report.unattributed.pct)} of all first-party landings`}
                </p>
              </SectionCard>
            ) : null}

            {report.funnelVariant === "v1" ? (
              <>
                <SectionCard
                  title="V1 first-party funnel"
                  subtitle="Unique funnel_session_id counts. Photo Selected = client-validated file, not storage upload."
                >
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
                    <StatCard label="Landing sessions" value={formatMetricOrDash(kpis.firstPartyLandings)} helper="First-party landing_view" />
                    <StatCard
                      label="Names Submitted"
                      value={formatMetricOrDash(kpis.names)}
                      helper={[kpis.namesSource.replace(/_/g, " "), ofPreviousLabel(kpis.names, kpis.firstPartyLandings, "first-party landing")].filter(Boolean).join(" · ")}
                    />
                    <StatCard
                      label="Photos Selected"
                      value={formatMetricOrDash(kpis.uploads)}
                      helper={[kpis.uploadsSource.replace(/_/g, " "), ofPreviousLabel(kpis.uploads, kpis.names, "names")].filter(Boolean).join(" · ")}
                    />
                    <StatCard
                      label="Order Reviews"
                      value={formatMetricOrDash(kpis.reviews)}
                      helper={[kpis.reviewsSource.replace(/_/g, " "), ofPreviousLabel(kpis.reviews, kpis.uploads, "photos")].filter(Boolean).join(" · ")}
                    />
                    <StatCard
                      label="Checkout"
                      value={formatMetricOrDash(kpis.checkouts)}
                      helper={["Production customer Stripe Checkout", ofPreviousLabel(kpis.checkouts, kpis.reviews, "reviews")].filter(Boolean).join(" · ")}
                    />
                    <StatCard
                      label="Purchases"
                      value={String(kpis.purchases)}
                      helper={[comparisonHelper(kpis.purchases, report.previousSteps[5]?.sessions ?? 0) || "Paid production", ofPreviousLabel(kpis.purchases, kpis.checkouts, "checkouts")].filter(Boolean).join(" · ")}
                    />
                  </div>
                </SectionCard>
                {(report.variantStages || []).length > 0 ? <FunnelViz stages={report.variantStages || []} /> : null}
              </>
            ) : null}

            {(report.funnelVariant === "v2_preview" || viewMode === "unattributed") && report.v2Kpis ? (
              <>
                <SectionCard title="V2 first-party KPIs" subtitle="Denominators are first-party V2 stages only.">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                    <StatCard label="Upload rate" value={formatPct(report.v2Kpis.uploadRate)} helper="v2_upload_completed / v2_landing_view" />
                    <StatCard label="Preview gen success" value={formatPct(report.v2Kpis.previewGenerationSuccessRate)} helper="completed / started" />
                    <StatCard label="Preview gen failure" value={formatPct(report.v2Kpis.previewGenerationFailureRate)} helper="failed / started" />
                    <StatCard label="Landing → Preview Viewed" value={formatPct(report.v2Kpis.landingToPreviewViewed)} />
                    <StatCard label="Preview Viewed → Unlock" value={formatPct(report.v2Kpis.previewViewedToUnlock)} />
                    <StatCard label="Unlock → Checkout" value={formatPct(report.v2Kpis.unlockToCheckout)} />
                    <StatCard label="Checkout → Purchase" value={formatPct(report.v2Kpis.checkoutToPurchase)} />
                    <StatCard
                      label="Median preview generation"
                      value={report.v2Kpis.medianPreviewGenerationMs == null ? "—" : `${Math.round(report.v2Kpis.medianPreviewGenerationMs)} ms`}
                      helper={report.v2Kpis.p90PreviewGenerationMs == null ? "Not enough latency samples" : `P90 ${Math.round(report.v2Kpis.p90PreviewGenerationMs)} ms`}
                    />
                  </div>
                </SectionCard>
                {(report.funnelVariant === "v2_preview" ? report.variantStages : report.v2Stages || []).length > 0 ? (
                  <FunnelViz
                    stages={(report.funnelVariant === "v2_preview" ? report.variantStages : report.v2Stages) || []}
                    subtitle="V2 preview funnel. Stages are not comparable 1:1 with V1."
                  />
                ) : null}
              </>
            ) : null}

            {viewMode === "unattributed" ? (
              <FunnelViz
                stages={report.steps.map((step) => ({
                  eventName: step.eventName,
                  label: step.label,
                  sessions: step.sessions,
                  fromPreviousPct: step.fromPreviousPct,
                  fromLandingPct: step.fromLandingPct,
                }))}
                subtitle="Unattributed V1 progression"
              />
            ) : null}

            {report.costMetrics && viewMode === "campaign" && report.funnelVariant ? (
              <SectionCard title="Business results" subtitle="Meta campaign spend / first-party unique sessions attributed to the same campaign_id.">
                {report.costMetrics.attributionCoverageWarning ? (
                  <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Attribution coverage is thin. Cost / FP metrics may be unstable.
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                  <StatCard label="Cost / FP Landing" value={formatMetricOrDash(report.costMetrics.costPerFpLandingCents, formatUsdFromCents)} />
                  <StatCard label="Cost / First Action" value={formatMetricOrDash(report.costMetrics.costPerFirstActionCents, formatUsdFromCents)} />
                  <StatCard label="Cost / Checkout" value={formatMetricOrDash(report.costMetrics.costPerCheckoutCents, formatUsdFromCents)} />
                  <StatCard label="CPA" value={formatMetricOrDash(report.costMetrics.cpaCents, formatUsdFromCents)} />
                  <StatCard label="ROAS" value={formatRoas(report.costMetrics.roas)} />
                  <StatCard label="Landing → Purchase" value={formatPct(kpis.landingToPurchase)} helper="First-party landing denominator" />
                  <StatCard label="Revenue" value={formatUsdFromCents(kpis.revenueCents)} />
                  <StatCard label="Free / 100% Discount Orders" value={String(kpis.freeDiscountOrders)} helper="Excluded from CPA / ROAS" />
                </div>
              </SectionCard>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                <StatCard label="Revenue" value={formatUsdFromCents(kpis.revenueCents)} />
                <StatCard label="Free / 100% Discount Orders" value={String(kpis.freeDiscountOrders)} helper="Excluded from CPA / ROAS" />
                <StatCard label="CPA" value={formatMetricOrDash(kpis.cpaCents, formatUsdFromCents)} />
                <StatCard label="ROAS" value={formatRoas(kpis.roas)} helper="Stripe revenue / Meta spend" />
              </div>
            )}

            <TrackingHealth
              firstPartyLandings={fpLanding || kpis.firstPartyLandings}
              metaLpv={kpis.metaLpv ?? kpis.lpv}
              latestFirstPartyAt={report.trackingHealth?.latestFirstPartyAt ?? report.recent[0]?.createdAt ?? report.firstPartyTrackingStartedAt}
              failedWrites={report.trackingHealth?.failedWrites ?? null}
            />

            {report.warnings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {report.warnings.map((warning) => (
                  <span key={warning} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            {viewMode === "campaign" ? (
              <SectionCard
                title="Ad set / ad drilldown"
                subtitle={adsetId ? `Filtered to ad set ${adsetId} inside this campaign.` : "Campaign → ad set → ad. First-party counts stay inside the selected campaign_id."}
              >
                {adsetId ? (
                  <button
                    type="button"
                    onClick={() => setAdsetId(null)}
                    className="mb-3 rounded-xl border border-slate-700 px-3 py-1 text-xs text-slate-200"
                  >
                    Clear ad set filter
                  </button>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Ad set", "Spend", "Meta LPV", "FP Landing", report.funnelVariant === "v2_preview" ? "Upload" : "Name", report.funnelVariant === "v2_preview" ? "Preview" : "Review", "Checkout", "Purchase"].map((label) => (
                          <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(report.metaAdsets || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-slate-500">
                            No ad set rows in this campaign/range.
                          </td>
                        </tr>
                      ) : (
                        (report.metaAdsets || []).map((row) => (
                          <tr key={row.adsetId} className="border-t border-slate-800">
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setAdsetId(row.adsetId)}
                                className="text-left text-indigo-200 hover:underline"
                              >
                                {row.adsetName}
                              </button>
                            </td>
                            <td className="px-3 py-2">{formatUsdFromCents(row.spendCents)}</td>
                            <td className="px-3 py-2">{row.lpv}</td>
                            <td className="px-3 py-2">{row.fpLanding}</td>
                            <td className="px-3 py-2">{row.firstAction}</td>
                            <td className="px-3 py-2">{row.preview ?? "—"}</td>
                            <td className="px-3 py-2">{row.checkout}</td>
                            <td className="px-3 py-2">{row.purchase}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Creative comparison" subtitle="Meta ad-level metrics. First-party columns appear when ad_id attribution exists inside this campaign.">
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

            <SectionCard title="Daily performance" subtitle="Same UTC interval as Meta, first-party, and Stripe.">
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
              <SectionCard title="Device" subtitle="First-party device when available.">
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

            <SectionCard title="Recent activity" subtitle="First-party events in range for this view">
              <div className="space-y-2">
                {report.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">No first-party funnel events in this range.</p>
                ) : (
                  report.recent.map((item, index) => (
                    <p key={`${item.createdAt}-${index}`} className="text-sm text-slate-300">
                      {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {item.species || "pet"} {EVENT_COPY[item.eventName] || item.eventName}
                      {item.eventName.includes("purchase") && item.amountCents ? ` ${formatUsdFromCents(item.amountCents)}` : ""}
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
