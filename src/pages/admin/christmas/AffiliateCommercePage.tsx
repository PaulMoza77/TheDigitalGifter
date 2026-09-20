import { useEffect, useMemo, useState } from "react";
import { StatCard, SectionCard } from "@/components/admin/overview/AdminOverviewCards";
import { fetchAffiliateAdminStatus, type AffiliateAdminStatusResponse } from "@/features/christmas/affiliateProducts/client";
import type { AffiliateProviderHealth } from "@/features/christmas/affiliateProducts";
import { useChristmasAdminData } from "./useChristmasAdminData";
import { type RangeDays } from "./christmasAdminTypes";
import { computeAffiliateFunnelMetrics } from "./affiliateAdminMetrics";

function healthLabel(row: AffiliateProviderHealth) {
  if (row.enabled) return row.reason === "DEGRADED" ? "Degraded" : "Enabled";
  return "Disabled";
}

export default function AffiliateCommercePage() {
  const [days, setDays] = useState<RangeDays>(7);
  const data = useChristmasAdminData(days);
  const [status, setStatus] = useState<AffiliateAdminStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAffiliateAdminStatus()
      .then((row) => {
        setStatus(row);
        setStatusError(null);
      })
      .catch(() => setStatusError("Could not load provider status."));
  }, []);

  const metrics = useMemo(() => computeAffiliateFunnelMetrics(data.events), [data.events]);
  const providers = status?.providers || (status?.ebay ? [status.ebay] : []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Affiliate Commerce</h2>
          <p className="mt-1 text-sm text-slate-400">
            Operational value of Planner product shopping. No recipient names, notes, or secrets.
          </p>
        </div>
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as RangeDays)}
        >
          <option value={1}>1 day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={0}>All</option>
        </select>
      </div>

      <SectionCard title="Provider status">
        {statusError ? <p className="text-sm text-amber-300">{statusError}</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {providers.map((row) => (
            <div key={row.provider} className="rounded-xl border border-slate-800 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{row.provider}</p>
              <p className="mt-1 text-lg text-white">{healthLabel(row)}</p>
              <dl className="mt-3 space-y-1 text-sm text-slate-300">
                <div>Feature flag: {row.enabled ? "on" : "off"}</div>
                <div>Production access: {row.productionAccess ? "yes" : "no"}</div>
                <div>
                  Credentials present:{" "}
                  {status?.credentialsPresent?.[row.provider] ? "yes" : "no"}
                </div>
                <div>Reason: {row.reason}</div>
              </dl>
            </div>
          ))}
        </div>
        <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <div>Last successful provider request: {metrics.lastSuccessAt || "None yet"}</div>
          <div>
            Last provider error: {metrics.lastErrorAt ? `${metrics.lastErrorAt} (${metrics.lastErrorReason})` : "None"}
          </div>
          <div>Rate-limit: {metrics.lastRateLimitedAt ? `hit ${metrics.lastRateLimitedAt}` : "No 429s in range"}</div>
        </dl>
      </SectionCard>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Product searches" value={String(metrics.searches)} />
        <StatCard label="Results viewed" value={String(metrics.resultsViewed)} />
        <StatCard label="Outbound clicks" value={String(metrics.clicks)} />
        <StatCard label="Added to Planner" value={String(metrics.added)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Search failure rate" value={metrics.failureRate} />
        <StatCard label="Search → click CTR" value={metrics.searchToClickCtr} />
        <StatCard label="Results → add rate" value={metrics.resultsToAddRate} />
        <StatCard label="Clicks per search" value={metrics.clicksPerSearch} />
      </div>

      <SectionCard title="Clicks by source">
        <p className="text-sm text-slate-300">Gift idea: {metrics.clicksBySource.giftIdea}</p>
        <p className="text-sm text-slate-300">Recipient search: {metrics.clicksBySource.recipientSearch}</p>
      </SectionCard>

      <SectionCard title="Breakdowns">
        <Breakdown title="Provider" rows={metrics.breakdowns.byProvider} />
        <Breakdown title="Marketplace" rows={metrics.breakdowns.byMarketplace} />
        <Breakdown title="Price bucket" rows={metrics.breakdowns.byPriceBucket} />
        <Breakdown title="Date" rows={metrics.breakdowns.byDate} />
      </SectionCard>

      <SectionCard title="Revenue">
        <p className="text-sm text-slate-300">Awaiting provider reporting</p>
        <p className="mt-1 text-xs text-slate-500">
          Commission is imported later from eBay EPN / Awin transactions. Clicks are not converted into revenue here.
        </p>
      </SectionCard>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; searches?: number; clicks?: number; added?: number }>;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No events in range.</p>
      ) : (
        <table className="mt-2 w-full text-left text-sm text-slate-300">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Key</th>
              <th>Searches</th>
              <th>Clicks</th>
              {rows.some((r) => "added" in r) ? <th>Added</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-800">
                <td className="py-1">{row.key}</td>
                <td>{row.searches ?? "—"}</td>
                <td>{row.clicks ?? "—"}</td>
                {"added" in row ? <td>{row.added}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
