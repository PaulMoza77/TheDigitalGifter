import React, { useMemo, useState } from "react";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import { formatPct, formatUsdFromCents } from "@/features/pet/funnelDashboard";
import { formatMetricOrDash } from "@/features/pet/funnelHybrid";
import { formatDurationSec, minutesAgoLabel, type V4DashboardReport } from "@/features/pet-v4/v4Dashboard";

type JourneyFilter = "all" | "purchased" | "checkout" | "uploaded" | "bounced" | "abandoned";

const JOURNEY_FILTERS: Array<{ id: JourneyFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "purchased", label: "Purchased" },
  { id: "checkout", label: "Reached checkout" },
  { id: "uploaded", label: "Uploaded" },
  { id: "bounced", label: "Bounced" },
  { id: "abandoned", label: "Abandoned offer" },
];

function formatRoas(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

function formatRatioPct(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return formatPct(ratio * 100);
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return formatDurationSec(ms / 1000);
}

function CompactBreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; landing: number; uploads?: number; checkouts?: number; purchases?: number }>;
}) {
  if (!rows.length) {
    return (
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-sm text-slate-500">No rows.</p>
      </div>
    );
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <table className="min-w-full text-left text-xs text-slate-300">
        <thead className="text-slate-500">
          <tr>
            <th className="px-2 py-1 font-medium">{title === "Ads" ? "Ad" : "Key"}</th>
            <th className="px-2 py-1 font-medium">Land</th>
            <th className="px-2 py-1 font-medium">Up</th>
            <th className="px-2 py-1 font-medium">CO</th>
            <th className="px-2 py-1 font-medium">Buy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-800">
              <td className="max-w-[10rem] truncate px-2 py-1 text-slate-100" title={row.key}>
                {row.key || "—"}
              </td>
              <td className="px-2 py-1 font-mono">{row.landing}</td>
              <td className="px-2 py-1 font-mono">{row.uploads ?? "—"}</td>
              <td className="px-2 py-1 font-mono">{row.checkouts ?? "—"}</td>
              <td className="px-2 py-1 font-mono">{row.purchases ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JourneyRow({
  journey,
}: {
  journey: V4DashboardReport["journeys"][number];
}) {
  const [open, setOpen] = useState(false);
  const visitorLabel = `Visitor #${String(journey.session_short || "????").slice(0, 4).toUpperCase()}`;
  const flags = [
    journey.purchased ? "purchased" : null,
    journey.reached_checkout ? "checkout" : null,
    journey.uploaded ? "uploaded" : null,
    journey.bounced ? "bounced" : null,
    journey.abandoned_offer ? "abandoned offer" : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="font-mono text-sm text-slate-100">{visitorLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {journey.placement || "unknown placement"}
            {journey.duration_seconds != null ? ` · ${formatDurationSec(journey.duration_seconds)}` : ""}
            {journey.revenue_cents ? ` · ${formatUsdFromCents(journey.revenue_cents)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {flags.length === 0 ? (
            <span className="text-xs text-slate-500">no flags</span>
          ) : (
            flags.map((flag) => (
              <span
                key={String(flag)}
                className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400"
              >
                {flag}
              </span>
            ))
          )}
        </div>
      </button>
      {open && journey.events && journey.events.length > 0 ? (
        <div className="border-t border-slate-800 px-3 py-2">
          <ol className="space-y-1.5">
            {journey.events.map((ev, idx) => (
              <li key={`${ev.created_at}-${idx}`} className="flex gap-2 text-xs text-slate-400">
                <span className="shrink-0 font-mono text-slate-500">
                  {new Date(ev.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="min-w-0 break-all text-slate-300">
                  {ev.event_name.replace(/^v4_/, "")}
                  {ev.scroll_pct != null ? ` · scroll ${ev.scroll_pct}%` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function PetV4AnalyticsPanels({
  dashboard,
  metaLastSyncedAt,
}: {
  dashboard: V4DashboardReport;
  metaLastSyncedAt?: string | null;
}) {
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>("all");
  const fp = dashboard.firstParty;
  const meta = dashboard.meta;
  const eco = dashboard.economics;
  const behavior = dashboard.behavior;
  const recent = dashboard.recent60m;
  const dq = dashboard.dataQuality;

  const filteredJourneys = useMemo(() => {
    return dashboard.journeys.filter((j) => {
      if (journeyFilter === "all") return true;
      if (journeyFilter === "purchased") return Boolean(j.purchased);
      if (journeyFilter === "checkout") return Boolean(j.reached_checkout);
      if (journeyFilter === "uploaded") return Boolean(j.uploaded);
      if (journeyFilter === "bounced") return Boolean(j.bounced);
      if (journeyFilter === "abandoned") return Boolean(j.abandoned_offer);
      return true;
    });
  }, [dashboard.journeys, journeyFilter]);

  const scrollEntries = Object.entries(behavior.scroll_depth || {});
  const ctaRows = behavior.ctas || [];
  const timeEntries = Object.entries(dashboard.timeToAction || {});
  const deviceRows = (dashboard.breakdowns.device || []).map((r) => ({ ...r, key: r.key }));
  const browserRows = (dashboard.breakdowns.browser || []).map((r) => ({ ...r, key: r.key }));
  const placementRows = (dashboard.breakdowns.placement || []).map((r) => ({ ...r, key: r.key }));
  const countryRows = (dashboard.breakdowns.country || []).map((r) => ({ ...r, key: r.key }));
  const adRows = dashboard.breakdowns.ads || [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="V4 health summary"
        subtitle="Last 60 minutes — live pulse, not the selected date range."
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
          <StatCard label="Visitors" value={String(recent.visitors ?? 0)} />
          <StatCard label="Uploads" value={String(recent.uploads ?? 0)} />
          <StatCard label="Offers viewed" value={String(recent.offers ?? 0)} />
          <StatCard label="Checkout clicks" value={String(recent.checkout_clicks ?? 0)} />
          <StatCard label="Purchases" value={String(recent.purchases ?? 0)} />
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Last event: {minutesAgoLabel(recent.last_event_at ?? null)}
        </p>
      </SectionCard>

      <SectionCard title="Meta acquisition" subtitle="Ads Insights for New Sales Campaign.">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatCard label="Spend" value={formatUsdFromCents(meta.spend_cents ?? 0)} />
          <StatCard label="Impressions" value={String(meta.impressions ?? 0)} />
          <StatCard label="Reach" value={String(meta.reach ?? 0)} />
          <StatCard label="Link Clicks" value={String(meta.link_clicks ?? 0)} />
          <StatCard label="Meta LPV" value={String(meta.landing_page_views ?? 0)} />
          <StatCard label="CTR" value={formatRatioPct(eco.ctr)} />
          <StatCard label="CPC" value={formatMetricOrDash(eco.cpc, formatUsdFromCents)} />
          <StatCard label="CPM" value={formatMetricOrDash(eco.cpm, formatUsdFromCents)} />
        </div>
      </SectionCard>

      <SectionCard title="First-party KPIs" subtitle="V4 cohort counts for the selected range.">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Landing Sessions" value={String(fp.landing_sessions ?? 0)} />
          <StatCard label="Unique Visitors" value={String(fp.unique_visitors ?? 0)} />
          <StatCard label="Engaged Sessions" value={String(fp.engaged_sessions ?? 0)} />
          <StatCard label="Photo Upload Starts" value={String(fp.upload_starts ?? 0)} />
          <StatCard label="Photo Upload Completes" value={String(fp.upload_completes ?? 0)} />
          <StatCard label="Generations" value={String(fp.generations ?? 0)} />
          <StatCard label="Teaser Views" value={String(fp.teaser_views ?? 0)} />
          <StatCard label="Offer Views" value={String(fp.offer_views ?? 0)} />
          <StatCard label="Checkout CTA Clicks" value={String(fp.checkout_cta_clicks ?? 0)} />
          <StatCard label="Stripe Checkout Sessions" value={String(fp.stripe_checkout_sessions ?? 0)} />
          <StatCard label="Purchases" value={String(fp.purchases ?? 0)} />
          <StatCard label="Revenue" value={formatUsdFromCents(fp.revenue_cents ?? 0)} />
        </div>
      </SectionCard>

      <SectionCard title="Economics" subtitle="Spend denominators use first-party counts.">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Cost / Landing" value={formatMetricOrDash(eco.costPerLanding, formatUsdFromCents)} />
          <StatCard label="Cost / Upload" value={formatMetricOrDash(eco.costPerUpload, formatUsdFromCents)} />
          <StatCard label="Cost / Checkout" value={formatMetricOrDash(eco.costPerCheckout, formatUsdFromCents)} />
          <StatCard label="CPA" value={formatMetricOrDash(eco.cpa, formatUsdFromCents)} />
          <StatCard
            label="Revenue / Visitor"
            value={formatMetricOrDash(eco.revenuePerVisitor, formatUsdFromCents)}
          />
          <StatCard label="ROAS" value={formatRoas(eco.roas)} />
        </div>
      </SectionCard>

      <SectionCard
        title="Sequential funnel"
        subtitle="Landing-cohort chain. Later stages never exceed earlier stages."
      >
        <div className="space-y-1">
          {dashboard.sequentialSteps.map((step, index) => {
            const prev = index > 0 ? dashboard.sequentialSteps[index - 1] : null;
            return (
              <div key={step.stage}>
                {prev ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 py-2 text-sm text-slate-400">
                    <span className="font-mono text-emerald-300/90">
                      ↓ {prev.toNextPct != null ? `${prev.toNextPct}%` : "—"}
                    </span>
                    <span className="text-slate-500">
                      {prev.dropOffUsers != null
                        ? `${prev.dropOffUsers} lost · ${prev.dropOffPct ?? "—"}% drop-off`
                        : "—"}
                    </span>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 sm:px-5 sm:py-5">
                  <p className="text-sm font-medium text-slate-300">{step.label}</p>
                  <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {step.users}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Top drop-off points" subtitle="Ranked by absolute users lost between sequential stages.">
        {dashboard.dropOffs.length === 0 ? (
          <p className="text-sm text-slate-500">No drop-offs in this range.</p>
        ) : (
          <ol className="space-y-2">
            {dashboard.dropOffs.map((point) => (
              <li
                key={`${point.from}-${point.to}`}
                className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <p className="text-sm text-slate-200">
                  <span className="mr-2 font-mono text-slate-500">#{point.rank}</span>
                  {point.fromLabel} → {point.toLabel}
                </p>
                <p className="font-mono text-sm text-amber-100/90">
                  {point.lost} lost · {point.dropOffPct}%
                </p>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <SectionCard title="V4 user behavior" subtitle="Scroll, engagement, CTAs, and stage mini-stats.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Scroll depth (% of landing sessions)</p>
            {scrollEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No scroll data.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-slate-300">
                {scrollEntries.map(([bucket, pct]) => (
                  <li key={bucket} className="flex justify-between gap-3">
                    <span className="text-slate-400">{bucket}</span>
                    <span className="font-mono">{Number(pct).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Engagement</p>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li className="flex justify-between gap-3">
                <span className="text-slate-400">Median engaged</span>
                <span className="font-mono">{formatMs(behavior.engagement?.median_engaged_ms)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-slate-400">Avg engaged</span>
                <span className="font-mono">{formatMs(behavior.engagement?.avg_engaged_ms)}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-slate-400">Bounced</span>
                <span className="font-mono">{behavior.engagement?.bounced ?? 0}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-slate-400">Single-action</span>
                <span className="font-mono">{behavior.engagement?.single_action ?? 0}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-slate-400">Multi-action</span>
                <span className="font-mono">{behavior.engagement?.multi_action ?? 0}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">CTA performance</p>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Location", "Exposures", "Clicks", "CTR"].map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctaRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500">
                    No CTA rows.
                  </td>
                </tr>
              ) : (
                ctaRows.map((row) => (
                  <tr key={row.location} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-100">{row.location}</td>
                    <td className="px-3 py-2 font-mono">{row.exposures}</td>
                    <td className="px-3 py-2 font-mono">{row.clicks}</td>
                    <td className="px-3 py-2 font-mono">
                      {row.ctr == null ? "—" : formatPct(row.ctr > 1 ? row.ctr : row.ctr * 100)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Upload</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {Object.entries(behavior.upload || {}).length === 0 ? (
                <li className="text-slate-500">—</li>
              ) : (
                Object.entries(behavior.upload || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate text-slate-400">{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Generation</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {Object.entries(behavior.generation || {}).length === 0 ? (
                <li className="text-slate-500">—</li>
              ) : (
                Object.entries(behavior.generation || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate text-slate-400">{k}</span>
                    <span className="font-mono">{v ?? "—"}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Checkout</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {Object.entries(behavior.checkout || {}).length === 0 ? (
                <li className="text-slate-500">—</li>
              ) : (
                Object.entries(behavior.checkout || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate text-slate-400">{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Time to action" subtitle="Median and p75 when available.">
        {timeEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No timing data.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {timeEntries.map(([key, stats]) => (
              <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</p>
                <p className="mt-1 font-mono text-lg text-slate-100">
                  {formatDurationSec(stats?.median_sec)}
                  {stats?.p75_sec != null ? (
                    <span className="ml-2 text-sm text-slate-500">p75 {formatDurationSec(stats.p75_sec)}</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Breakdowns" subtitle="Device, browser, placement, country, and ads.">
        <div className="grid gap-6 lg:grid-cols-2">
          <CompactBreakdownTable title="Device" rows={deviceRows} />
          <CompactBreakdownTable title="Browser" rows={browserRows} />
          <CompactBreakdownTable title="Placement" rows={placementRows} />
          <CompactBreakdownTable title="Country" rows={countryRows} />
        </div>
        <div className="mt-6 overflow-x-auto">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Ads</p>
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="text-slate-500">
              <tr>
                {["Ad", "Spend", "Landings", "Uploads", "Checkouts", "Purchases", "CPA"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-2 py-1 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-slate-500">
                    No ad rows.
                  </td>
                </tr>
              ) : (
                adRows.map((row, idx) => (
                  <tr key={`${row.ad_id || row.ad_name || idx}`} className="border-t border-slate-800">
                    <td className="max-w-[12rem] truncate px-2 py-1 text-slate-100" title={row.ad_name || row.ad_id}>
                      {row.ad_name || row.ad_id || "—"}
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {row.spend_cents == null ? "—" : formatUsdFromCents(row.spend_cents)}
                    </td>
                    <td className="px-2 py-1 font-mono">{row.landing ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{row.uploads ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{row.checkouts ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{row.purchases ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">
                      {formatMetricOrDash(row.cpa_cents ?? null, formatUsdFromCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent V4 journeys" subtitle="Anonymized visitor prefixes only — no email, name, or images.">
        <div className="mb-3 flex flex-wrap gap-2">
          {JOURNEY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setJourneyFilter(item.id)}
              className={[
                "rounded-xl border px-2.5 py-1 text-xs font-medium transition",
                journeyFilter === item.id
                  ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
        {filteredJourneys.length === 0 ? (
          <p className="text-sm text-slate-500">No journeys match this filter.</p>
        ) : (
          <div className="space-y-2">
            {filteredJourneys.map((journey, idx) => (
              <JourneyRow key={`${journey.session_short}-${idx}`} journey={journey} />
            ))}
          </div>
        )}
      </SectionCard>

      <details className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">Data quality</summary>
        <div className="mt-3 space-y-1.5 text-sm text-slate-400">
          <p>
            Meta last sync:{" "}
            {metaLastSyncedAt ? new Date(metaLastSyncedAt).toLocaleString("en-US") : "never"}
          </p>
          <p>
            First-party freshness:{" "}
            {dq.first_party_freshness
              ? new Date(dq.first_party_freshness).toLocaleString("en-US")
              : "—"}
          </p>
          <p>Events in range: {dq.events_in_range ?? "—"}</p>
          <p>Unattributed sessions: {dq.unattributed_sessions ?? 0}</p>
          <p>Duplicate events detected: {dq.duplicate_events_detected ?? 0}</p>
          <p>Checkout without click: {dq.checkout_sessions_without_click ?? 0}</p>
          <p>Purchases without session: {dq.purchases_without_session ?? 0}</p>
        </div>
      </details>
    </div>
  );
}
