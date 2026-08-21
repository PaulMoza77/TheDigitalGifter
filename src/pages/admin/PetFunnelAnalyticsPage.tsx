import React, { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  formatPct,
  formatSignedPct,
  formatUsdFromCents,
  percentChange,
  type DatePreset,
} from "@/features/pet/funnelDashboard";
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

export default function PetFunnelAnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const custom = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : undefined;
  const { loading, error, report, refresh } = usePetFunnelAnalytics(preset, custom);

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

  const maxSessions = Math.max(1, ...(report?.steps.map((step) => step.sessions) ?? [1]));

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">Pet Funnel Analytics</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              First-party My Pet’s Secret Life funnel. Unique sessions, not raw page refreshes.
              Spend / CPA / ROAS require a future Meta Ads spend sync and are shown as —.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
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

        {report?.firstEventAt ? (
          <p className="text-sm text-slate-500">
            Detailed funnel tracking available from {new Date(report.firstEventAt).toLocaleString("en-US")}.
            Historical paid orders before that date are not mixed into these conversion rates.
          </p>
        ) : (
          <p className="text-sm text-amber-200/80">
            Tracking may be incomplete — no first-party funnel events have been recorded yet.
          </p>
        )}

        {error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
        ) : null}

        {loading && !report ? (
          <p className="text-sm text-slate-400">Loading funnel analytics…</p>
        ) : null}

        {report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <StatCard label="Landing Page Views" value={String(report.kpis.landing)} helper={comparisonHelper(report.kpis.landing, report.previousSteps[0]?.sessions ?? 0)} />
              <StatCard label="Pet Names Submitted" value={String(report.kpis.names)} helper={comparisonHelper(report.kpis.names, report.previousSteps[1]?.sessions ?? 0)} />
              <StatCard label="Photo Uploads" value={String(report.kpis.uploads)} helper={comparisonHelper(report.kpis.uploads, report.previousSteps[2]?.sessions ?? 0)} />
              <StatCard label="Order Reviews" value={String(report.kpis.reviews)} helper={comparisonHelper(report.kpis.reviews, report.previousSteps[3]?.sessions ?? 0)} />
              <StatCard label="Initiate Checkouts" value={String(report.kpis.checkouts)} helper={comparisonHelper(report.kpis.checkouts, report.previousSteps[4]?.sessions ?? 0)} />
              <StatCard label="Purchases" value={String(report.kpis.purchases)} helper={comparisonHelper(report.kpis.purchases, report.previousSteps[5]?.sessions ?? 0)} />
              <StatCard label="Revenue" value={formatUsdFromCents(report.kpis.revenueCents)} helper={comparisonHelper(report.kpis.revenueCents, report.kpis.previousRevenueCents)} />
              <StatCard label="Landing → Purchase" value={formatPct(report.kpis.landingToPurchase)} />
              <StatCard label="Checkout → Purchase" value={formatPct(report.kpis.checkoutToPurchase)} />
              <StatCard
                label="AOV"
                value={formatUsdFromCents(report.kpis.averageOrderValueCents ?? 0)}
                helper={`Rev / LPV ${formatUsdFromCents(report.kpis.revenuePerLpvCents ?? 0)} · Rev / checkout ${formatUsdFromCents(report.kpis.revenuePerCheckoutCents ?? 0)}`}
              />
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
                  : "Unique funnel sessions"
              }
            >
              <div className="space-y-4">
                {report.steps.map((step, index) => (
                  <div key={step.eventName}>
                    {index > 0 ? <div className="mb-3 text-center text-slate-600">↓</div> : null}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{step.label}</p>
                          <p className="mt-1 text-2xl font-semibold text-white">{step.sessions}</p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <p>{formatPct(step.fromLandingPct)} of LPV</p>
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

            <SectionCard title="Campaign / ad set / ad" subtitle="No Meta spend is stored yet. Spend, CPA, and ROAS are omitted rather than estimated.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Campaign", "Ad Set", "Ad / Creative", "Spend", "LPV", "Name", "Upload", "Review", "Checkout", "Purchase", "LPV → Purchase", "Revenue", "CPA", "ROAS"].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="px-3 py-6 text-slate-500">
                          No attributed funnel traffic in this range.
                        </td>
                      </tr>
                    ) : (
                      report.campaigns.map((row) => (
                        <tr key={`${row.campaign}-${row.sourceGroup}`} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-100">{row.campaign}</td>
                          <td className="px-3 py-2 text-slate-300">{row.adSet}</td>
                          <td className="px-3 py-2 text-slate-300">{row.ad}</td>
                          <td className="px-3 py-2 text-slate-500">—</td>
                          <td className="px-3 py-2">{row.lpv}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.upload}</td>
                          <td className="px-3 py-2">{row.review}</td>
                          <td className="px-3 py-2">{row.checkout}</td>
                          <td className="px-3 py-2">{row.purchase}</td>
                          <td className="px-3 py-2">{formatPct(row.cvr)}</td>
                          <td className="px-3 py-2">{formatUsdFromCents(row.revenueCents)}</td>
                          <td className="px-3 py-2 text-slate-500">—</td>
                          <td className="px-3 py-2 text-slate-500">—</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Creative comparison" subtitle="Grouped by ad name / ad_id when present.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Ad", "LPV", "Upload", "Checkout", "Purchase", "CVR"].map((label) => (
                        <th key={label} className="px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.ads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-slate-500">
                          No creatives in this range.
                        </td>
                      </tr>
                    ) : (
                      report.ads.map((row) => (
                        <tr key={`${row.ad}-${row.campaign}`} className="border-t border-slate-800">
                          <td className="px-3 py-2 text-slate-100">{row.ad}</td>
                          <td className="px-3 py-2">{row.lpv}</td>
                          <td className="px-3 py-2">{row.upload}</td>
                          <td className="px-3 py-2">{row.checkout}</td>
                          <td className="px-3 py-2">{row.purchase}</td>
                          <td className="px-3 py-2">{formatPct(row.cvr)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
              <SectionCard title="Device" subtitle="Country is not collected. No geo-IP provider was added.">
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

            <SectionCard title="Recent activity">
              <div className="space-y-2">
                {report.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">No funnel events in this range.</p>
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
