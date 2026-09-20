import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatCard, SectionCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  CHRISTMAS_FUNNELS,
  eventMatchesFunnel,
  uniqueSessionCount,
} from "./christmasFunnelDefs";
import {
  VIEW_EVENTS,
  eventPlatform,
  formatUsd,
  isTestOrder,
  moneyByCurrency,
  orderPlatform,
  pct,
  type Platform,
  type RangeDays,
} from "./christmasAdminTypes";
import { computePlannerNorthStar } from "./plannerNorthStar";
import { useChristmasAdminData } from "./useChristmasAdminData";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <StatCard label={label} value={String(value)} helper={hint} />;
}

export default function ChristmasDashboardPage() {
  const [days, setDays] = useState<RangeDays>(7);
  const [platform, setPlatform] = useState<Platform>("all");
  const [includeTests, setIncludeTests] = useState(false);
  const data = useChristmasAdminData(days);

  const events = useMemo(
    () =>
      data.events.filter(
        (row) =>
          (includeTests || !row.is_test) &&
          (platform === "all" || eventPlatform(row) === platform),
      ),
    [data.events, includeTests, platform],
  );
  const orders = useMemo(
    () =>
      data.orders.filter(
        (row) =>
          (includeTests || !isTestOrder(row)) &&
          (platform === "all" || orderPlatform(row) === platform),
      ),
    [data.orders, includeTests, platform],
  );

  const paid = orders.filter((row) => row.payment_status === "paid" && row.amount_cents > 0);
  const sessions = new Set(events.map((row) => row.funnel_session_id)).size;
  const viewed = new Set(
    events
      .filter((row) => VIEW_EVENTS.has(row.event_name) || row.event_name.endsWith("page_view") || row.event_name.endsWith("_view"))
      .map((row) => row.funnel_session_id),
  ).size;
  const checkout = new Set(events.filter((row) => row.event_name.includes("checkout")).map((row) => row.funnel_session_id)).size;

  const ledgerSpend = data.costs
    .filter((row) => row.is_mock !== true)
    .reduce((sum, row) => sum + Number(row.cost_usd || 0), 0);
  const santaSpend = data.santaCosts.reduce((sum, row) => sum + Number(row.cost_total_usd || 0), 0);
  const totalSpentUsd = ledgerSpend + santaSpend;

  const pageRows = useMemo(() => {
    const counts = new Map<string, { views: number; sessions: Set<string> }>();
    for (const row of events) {
      const isView =
        VIEW_EVENTS.has(row.event_name) ||
        row.event_name.endsWith("page_view") ||
        row.event_name.endsWith("_view");
      if (!isView) continue;
      const path = row.pathname || "(unknown)";
      const current = counts.get(path) || { views: 0, sessions: new Set<string>() };
      current.views += 1;
      if (row.funnel_session_id) current.sessions.add(row.funnel_session_id);
      counts.set(path, current);
    }
    return [...counts.entries()]
      .map(([path, value]) => ({ path, views: value.views, sessions: value.sessions.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);
  }, [events]);

  const funnelSnapshot = useMemo(() => {
    return CHRISTMAS_FUNNELS.map((funnel) => {
      const funnelEvents = events.filter((row) => eventMatchesFunnel(row, funnel));
      const firstStep = funnel.steps[0];
      const lastPurchase = funnel.steps.find((step) => /purchase|join_completed|email_claim_success/.test(step.event));
      const landings = firstStep ? uniqueSessionCount(funnelEvents, firstStep.event) : new Set(funnelEvents.map((row) => row.funnel_session_id)).size;
      const conversions = lastPurchase ? uniqueSessionCount(funnelEvents, lastPurchase.event) : 0;
      return {
        id: funnel.id,
        label: funnel.label,
        sessions: new Set(funnelEvents.map((row) => row.funnel_session_id)).size,
        landings,
        conversions,
      };
    }).filter((row) => row.sessions > 0);
  }, [events]);

  const plannerKpis = useMemo(() => computePlannerNorthStar({ events, orders }), [events, orders]);
  const incomeLabel = moneyByCurrency(paid);
  const clubEmails = data.clubSignups.length;

  return (
    <div className="px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Dashboard</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Spend, income, traffic, and a snapshot of each funnel. Open Analytics for drop-off and email capture.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void data.load()}
            disabled={data.loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${data.loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as RangeDays)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={0}>All time</option>
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="all">Web + iOS</option>
            <option value="web">Web only</option>
            <option value="ios">iOS only</option>
          </select>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2">
            <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
            Include test / zero-value
          </label>
        </div>

        {data.error ? (
          <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {data.error}
          </div>
        ) : null}
        {data.softWarnings.length ? (
          <p className="text-xs text-slate-500">{data.softWarnings.join(" ")}</p>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Income" value={incomeLabel} hint={`${paid.length} paid orders`} />
          <Metric
            label="Total spent"
            value={formatUsd(totalSpentUsd)}
            hint={`Ledger ${formatUsd(ledgerSpend)} · Santa ${formatUsd(santaSpend)}`}
          />
          <Metric label="Sessions" value={sessions} hint={`${viewed} page views`} />
          <Metric label="Checkout → paid" value={pct(paid.length, checkout)} hint={`${checkout} checkout sessions`} />
          <Metric label="Club emails" value={clubEmails} hint="christmas_club_signups" />
          <Metric label="Pages tracked" value={pageRows.length} hint="Distinct view paths in range" />
          <Metric label="Paid orders" value={paid.length} hint={pct(paid.length, checkout) + " of checkout sessions"} />
          <Metric
            label="Refreshed"
            value={data.loadedAt ? data.loadedAt.toLocaleTimeString() : "—"}
            hint={data.loading ? "Loading…" : undefined}
          />
        </section>

        <SectionCard title="Views / pages" subtitle="Unique sessions that hit each path">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Path</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length ? (
                  pageRows.map((row) => (
                    <tr key={row.path} className="border-t border-slate-800">
                      <td className="p-3 font-mono text-xs text-slate-300">{row.path}</td>
                      <td className="p-3">{row.views}</td>
                      <td className="p-3">{row.sessions}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={3}>
                      No page views in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Planner North Star" subtitle="Acquisition through paid access and module activation. No recipient or search text.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Visitors" value={plannerKpis.visitors} />
            <Metric label="Planner starts" value={plannerKpis.starts} />
            <Metric label="Preview done" value={plannerKpis.previews} />
            <Metric label="Checkout starts" value={plannerKpis.checkoutStarts} />
            <Metric label="Purchases" value={plannerKpis.purchases} />
            <Metric label="Conversion" value={`${plannerKpis.conversionPct}%`} />
            <Metric label="Revenue" value={formatUsd(plannerKpis.revenueCents / 100)} />
            <Metric label="AOV" value={formatUsd(plannerKpis.aovCents / 100)} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3 text-sm">
            <div>
              <p className="text-xs uppercase text-slate-500">Source / UTM</p>
              {plannerKpis.bySource.slice(0, 8).map((row) => (
                <p key={row.source}>{row.source}: {row.sessions}</p>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Device</p>
              {plannerKpis.byDevice.map((row) => (
                <p key={row.device}>{row.device}: {row.sessions}</p>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Module activation</p>
              {plannerKpis.activations.slice(0, 8).map((row) => (
                <p key={row.module}>{row.module}: {row.sessions}</p>
              ))}
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-400">
            Drop-off: {plannerKpis.dropoff.map((d) => `${d.from}→${d.to} lost ${d.lost}`).join(" · ") || "—"}
          </div>
        </SectionCard>

        <SectionCard title="Funnel snapshot" subtitle="Open Analytics and pick a funnel for drop-off.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Funnel</th>
                  <th className="p-3">Sessions</th>
                  <th className="p-3">First step</th>
                  <th className="p-3">Converted</th>
                </tr>
              </thead>
              <tbody>
                {funnelSnapshot.length ? (
                  funnelSnapshot.map((row) => (
                    <tr key={row.id} className="border-t border-slate-800">
                      <td className="p-3">{row.label}</td>
                      <td className="p-3">{row.sessions}</td>
                      <td className="p-3">{row.landings}</td>
                      <td className="p-3">{row.conversions}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={4}>
                      No funnel traffic in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
