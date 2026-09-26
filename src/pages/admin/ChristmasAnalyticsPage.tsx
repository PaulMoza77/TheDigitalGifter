import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  CHRISTMAS_FUNNELS,
  emailsCollectedInFunnel,
  eventMatchesFunnel,
  funnelById,
  funnelDropoff,
} from "./christmas/christmasFunnelDefs";
import {
  VIEW_EVENTS,
  eventPlatform,
  isTestOrder,
  moneyByCurrency,
  orderPlatform,
  pct,
  type Platform,
  type RangeDays,
} from "./christmas/christmasAdminTypes";
import { useChristmasAdminData } from "./christmas/useChristmasAdminData";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <StatCard label={label} value={String(value)} helper={hint} />;
}

export default function ChristmasAnalyticsPage() {
  const [days, setDays] = useState<RangeDays>(7);
  const [platform, setPlatform] = useState<Platform>("all");
  const [funnelId, setFunnelId] = useState("all");
  const [includeTests, setIncludeTests] = useState(false);
  const data = useChristmasAdminData(days);
  const selectedFunnel = funnelId === "all" ? null : funnelById(funnelId);

  const filteredEvents = useMemo(
    () =>
      data.events.filter((row) => {
        if (!includeTests && row.is_test) return false;
        if (platform !== "all" && eventPlatform(row) !== platform) return false;
        if (selectedFunnel && !eventMatchesFunnel(row, selectedFunnel)) return false;
        return true;
      }),
    [data.events, includeTests, platform, selectedFunnel],
  );
  const filteredOrders = useMemo(
    () =>
      data.orders.filter((row) => {
        if (!includeTests && isTestOrder(row)) return false;
        if (platform !== "all" && orderPlatform(row) !== platform) return false;
        if (selectedFunnel && !selectedFunnel.productKeys.includes(row.product_key)) return false;
        return true;
      }),
    [data.orders, includeTests, platform, selectedFunnel],
  );

  const sessionCount = new Set(filteredEvents.map((row) => row.funnel_session_id)).size;
  const viewed = new Set(
    filteredEvents
      .filter((row) => VIEW_EVENTS.has(row.event_name) || row.event_name.endsWith("page_view"))
      .map((row) => row.funnel_session_id),
  ).size;
  const checkout = new Set(filteredEvents.filter((row) => row.event_name.includes("checkout")).map((row) => row.funnel_session_id)).size;
  const paid = filteredOrders.filter((row) => row.payment_status === "paid");
  const paidCommercial = paid.filter((row) => row.amount_cents > 0);
  const fulfillmentFailures = paid.filter((row) => row.fulfillment_status === "failed" || Boolean(row.last_error));
  const pending = filteredOrders.filter((row) => row.payment_status === "pending");
  const allEmails = [...data.emails, ...data.legacyEmails];
  const emailSent = allEmails.filter((row) => row.status === "sent").length;
  const emailFailed = allEmails.filter((row) => row.status === "failed").length;
  const latestEventAt = filteredEvents[0]?.created_at || null;
  const dropSteps = selectedFunnel ? funnelDropoff(filteredEvents, selectedFunnel.steps) : [];
  const emailsFromEvents = selectedFunnel
    ? selectedFunnel.id === "club"
      ? 0
      : emailsCollectedInFunnel(filteredEvents, selectedFunnel)
    : CHRISTMAS_FUNNELS.filter((funnel) => funnel.id !== "club").reduce((sum, funnel) => {
        const rows = filteredEvents.filter((row) => eventMatchesFunnel(row, funnel));
        return sum + emailsCollectedInFunnel(rows, funnel);
      }, 0);
  const clubEmails = !selectedFunnel || selectedFunnel.id === "club" ? data.clubSignups.length : 0;
  const emailsCollected = clubEmails + emailsFromEvents;

  const biggestDrop = dropSteps
    .filter((step) => step.dropped != null)
    .sort((a, b) => (b.dropped || 0) - (a.dropped || 0))[0];

  const productRows = useMemo(() => {
    const keys = [...new Set(filteredOrders.map((row) => row.product_key).concat(filteredEvents.map((row) => row.product_key || "").filter(Boolean)))].sort();
    return keys
      .map((key) => {
        const productEvents = filteredEvents.filter((row) => row.product_key === key);
        const productOrders = filteredOrders.filter((row) => row.product_key === key);
        const sessions = new Set(productEvents.map((row) => row.funnel_session_id)).size;
        const checkouts = new Set(productEvents.filter((row) => row.event_name.includes("checkout")).map((row) => row.funnel_session_id)).size;
        const purchases = productOrders.filter((row) => row.payment_status === "paid" && row.amount_cents > 0);
        return { key, sessions, checkouts, purchases: purchases.length, revenue: moneyByCurrency(purchases) };
      })
      .filter((row) => row.sessions || row.checkouts || row.purchases);
  }, [filteredEvents, filteredOrders]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredEvents) {
      const key = [row.utm_source || "direct", row.utm_campaign || "(none)"].join(" / ");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredEvents]);

  return (
    <div className="px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Analytics</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Filter one funnel to see where people stop and how many emails you collected. Test traffic is off by default.
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
          <select value={funnelId} onChange={(e) => setFunnelId(e.target.value)} className="max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="all">All funnels</option>
            {CHRISTMAS_FUNNELS.map((funnel) => (
              <option key={funnel.id} value={funnel.id}>
                {funnel.label}
              </option>
            ))}
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tracked sessions" value={sessionCount} hint={`${viewed} reached a page view`} />
          <Metric
            label="Emails collected"
            value={emailsCollected}
            hint={
              selectedFunnel?.id === "club"
                ? "Club signup rows"
                : selectedFunnel?.emailEvents.length
                  ? selectedFunnel.emailEvents.join(", ")
                  : "Club signups + funnel claim events"
            }
          />
          <Metric label="Checkout sessions" value={checkout} hint={`${pct(checkout, viewed || sessionCount)} of views`} />
          <Metric label="Paid orders" value={paidCommercial.length} hint={`${pct(paidCommercial.length, checkout)} from checkout`} />
          <Metric label="Verified revenue" value={moneyByCurrency(paidCommercial)} hint="Stripe-paid, amount > 0" />
          <Metric label="Pending orders" value={pending.length} hint="Open or abandoned checkout" />
          <Metric label="Fulfillment failures" value={fulfillmentFailures.length} hint="Paid orders needing recovery" />
          <Metric label="Delivery emails sent" value={emailSent} hint={`${emailFailed} failed · ${allEmails.length} ledger rows`} />
        </section>

        {selectedFunnel ? (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-4">
              <h3 className="font-semibold">{selectedFunnel.label} drop-off</h3>
              <p className="mt-1 text-sm text-slate-400">
                {biggestDrop && biggestDrop.dropped
                  ? `Largest drop: ${biggestDrop.label} lost ${biggestDrop.dropped} sessions (${biggestDrop.fromPreviousPct} continued).`
                  : "Sessions unique per step. A drop means they did the previous step but not this one."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Step</th>
                    <th className="p-3">Sessions</th>
                    <th className="p-3">Kept from previous</th>
                    <th className="p-3">Lost here</th>
                  </tr>
                </thead>
                <tbody>
                  {dropSteps.map((step) => (
                    <tr key={step.event} className="border-t border-slate-800">
                      <td className="p-3">
                        <div>{step.label}</div>
                        <div className="font-mono text-[11px] text-slate-500">{step.event}</div>
                      </td>
                      <td className="p-3">{step.sessions}</td>
                      <td className="p-3">{step.fromPreviousPct}</td>
                      <td className="p-3">{step.dropped == null ? "-" : step.dropped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <p className="text-sm text-slate-400">Pick a funnel above to see step-by-step drop-off.</p>
        )}

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-4">
              <h3 className="font-semibold">By product</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Sessions</th>
                    <th className="p-3">Checkout</th>
                    <th className="p-3">Paid</th>
                    <th className="p-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-800">
                      <td className="p-3 font-mono text-xs">{row.key}</td>
                      <td className="p-3">{row.sessions}</td>
                      <td className="p-3">{row.checkouts}</td>
                      <td className="p-3">{row.purchases}</td>
                      <td className="p-3">{row.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="font-semibold">Source / campaign</h3>
            <div className="mt-4 space-y-2 text-sm">
              {sourceRows.length ? (
                sourceRows.map(([label, count]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="truncate text-slate-400">{label}</span>
                    <span>{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No events in this view.</p>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Tracking: {latestEventAt ? new Date(latestEventAt).toLocaleString() : "No events"}
              {data.loadedAt ? ` · refreshed ${data.loadedAt.toLocaleTimeString()}` : ""}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold">Operational health</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className={`rounded-xl border p-3 ${fulfillmentFailures.length ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
              <p className="flex items-center gap-2 font-medium">
                {fulfillmentFailures.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Paid fulfillment
              </p>
              {fulfillmentFailures.slice(0, 6).map((row) => (
                <p key={row.id} className="mt-2 break-words font-mono text-xs text-slate-300">
                  {row.product_key} · {row.id.slice(0, 8)} · {row.last_error || row.fulfillment_status}
                </p>
              ))}
              {!fulfillmentFailures.length ? <p className="mt-2 text-sm text-slate-400">No paid fulfillment failures in this view.</p> : null}
            </div>
            <div className={`rounded-xl border p-3 ${emailFailed ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
              <p className="flex items-center gap-2 font-medium">
                {emailFailed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Delivery email
              </p>
              {allEmails
                .filter((row) => row.status !== "sent")
                .slice(0, 6)
                .map((row) => (
                  <p key={row.id} className="mt-2 break-words font-mono text-xs text-slate-300">
                    {row.kind} · {row.status} · {row.last_error || row.order_id.slice(0, 8)}
                  </p>
                ))}
              {!allEmails.length ? (
                <p className="mt-2 text-sm text-amber-200">No delivery-email ledger rows yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
