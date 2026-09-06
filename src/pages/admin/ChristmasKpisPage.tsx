import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  buildChristmasKpiSnapshot,
  formatCents,
  formatPct,
  type ChristmasFunnelEventRow,
  type ChristmasKpiDatePreset,
  type ChristmasLifecycleKpiRow,
  type ChristmasOrderKpiRow,
  CHRISTMAS_KPI_SOURCE_MATRIX,
} from "@/features/christmas/adminKpis/kpiCore";

const PRESETS: Array<{ id: ChristmasKpiDatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function ChristmasKpisPage() {
  const [preset, setPreset] = useState<ChristmasKpiDatePreset>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [events, setEvents] = useState<ChristmasFunnelEventRow[]>([]);
  const [orders, setOrders] = useState<ChristmasOrderKpiRow[]>([]);
  const [lifecycle, setLifecycle] = useState<ChristmasLifecycleKpiRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const soft: string[] = [];

    const [evRes, ordRes, lifeRes] = await Promise.all([
      supabase
        .from("christmas_funnel_events")
        .select(
          "event_name,funnel_session_id,order_id,product_key,package_key,amount_cents,utm_source,utm_campaign,device_type,is_test,created_at,idempotency_key",
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("christmas_orders")
        .select(
          "id,product_key,package_key,amount_cents,currency,payment_status,fulfillment_status,stripe_checkout_session_id,utm_source,utm_campaign,created_at,paid_at,refunded_at",
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("christmas_lifecycle_events")
        .select("template_key,status,locale,created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);

    if (evRes.error && ordRes.error) {
      setError(evRes.error.message || ordRes.error.message || "Failed to load KPIs");
      setEvents([]);
      setOrders([]);
      setLifecycle([]);
      setPartialErrors([]);
      setLoading(false);
      return;
    }
    if (evRes.error) soft.push(`Funnel events: ${evRes.error.message}`);
    if (ordRes.error) soft.push(`Orders: ${ordRes.error.message}`);
    if (lifeRes.error) soft.push(`Lifecycle emails: ${lifeRes.error.message}`);

    setEvents((evRes.data || []) as ChristmasFunnelEventRow[]);
    // Never surface email/PII columns — select list excludes email by design.
    setOrders((ordRes.data || []) as ChristmasOrderKpiRow[]);
    setLifecycle((lifeRes.data || []) as ChristmasLifecycleKpiRow[]);
    setPartialErrors(soft);
    setLoading(false);
    if (soft.length) toast.message("Some KPI sources failed", { description: soft.join(" · ") });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = useMemo(
    () =>
      buildChristmasKpiSnapshot({
        preset,
        events,
        orders,
        lifecycle,
      }),
    [preset, events, orders, lifecycle],
  );

  const empty =
    !loading &&
    !error &&
    snap.funnel.entriesSessions === 0 &&
    snap.commercial.checkoutSessionsCreated === 0 &&
    snap.commercial.paidOrders === 0;

  return (
    <div className="space-y-6 text-slate-100">
      <PageHead
        title="Christmas KPIs"
        description="Founder Christmas funnel and commerce KPIs"
        noindex
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
            Christmas · Founder
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Christmas KPIs</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Commercial truth from <code className="text-slate-300">christmas_orders</code>.
            Funnel stages from first-party events as{" "}
            <strong className="font-medium text-slate-200">aggregate unique sessions</strong>, not
            cohort-exact conversion. No child media or customer emails.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-slate-900"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              preset === p.id
                ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-100">
          Failed to load Christmas KPIs: {error}
        </div>
      ) : null}

      {partialErrors.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
          Partial query failure — showing available sources.
          <ul className="mt-2 list-disc pl-5">
            {partialErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-sm text-slate-400">
          Loading Christmas KPI sources…
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-sm text-slate-400">
          Zero data for {snap.rangeLabel}. No funnel events or Christmas orders in range.
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Entries (sessions)" value={snap.funnel.entriesSessions} />
            <Stat label="Uploads" value={snap.funnel.uploads} />
            <Stat label="Previews" value={snap.funnel.previews} />
            <Stat label="Offers viewed" value={snap.funnel.offers} />
            <Stat label="Checkout CTAs" value={snap.funnel.checkoutStarts} />
            <Stat
              label="Checkout sessions created"
              value={snap.commercial.checkoutSessionsCreated}
              hint="Orders with Stripe session id — not purchases"
            />
            <Stat label="Paid orders" value={snap.commercial.paidOrders} />
            <Stat label="Delivered" value={snap.commercial.deliveredOrders} />
            <Stat
              label="Gross revenue"
              value={formatCents(snap.commercial.grossRevenueCents, "eur")}
            />
            <Stat
              label="AOV"
              value={
                snap.commercial.aovCents == null
                  ? "—"
                  : formatCents(snap.commercial.aovCents, "eur")
              }
            />
            <Stat label="Refunds" value={snap.commercial.refundOrders} />
            <Stat
              label="Refund amount"
              value={formatCents(snap.commercial.refundAmountCents, "eur")}
            />
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-semibold text-white">Funnel progression</h2>
            <p className="mt-1 text-xs text-amber-200/80">{snap.progressionCaveat}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Stage</th>
                    <th className="py-2 pr-4">From</th>
                    <th className="py-2 pr-4">To</th>
                    <th className="py-2">Aggregate ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.progression.map((row) => (
                    <tr key={`${row.from}-${row.to}`} className="border-t border-slate-800">
                      <td className="py-2 pr-4 text-slate-200">
                        {row.from} → {row.to}
                      </td>
                      <td className="py-2 pr-4">{row.fromCount}</td>
                      <td className="py-2 pr-4">{row.toCount}</td>
                      <td className="py-2">{formatPct(row.ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Checkout health</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Abandoned checkouts: {snap.commercial.abandonedCheckouts}</li>
                <li>Abandoned %: {formatPct(snap.checkoutHealth.abandonedPct)}</li>
                <li>Checkout → paid: {formatPct(snap.checkoutHealth.checkoutToPaidPct)}</li>
                <li>
                  Sessions with zero purchase: {snap.checkoutHealth.zeroPurchaseSessions}
                </li>
                <li>Refund rate: {formatPct(snap.commercial.refundRate)}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Founder funnel health</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Largest drop-off: {snap.health.largestDropoff || "—"}</li>
                <li>Weakest progression: {snap.health.weakestProgression || "—"}</li>
                <li>
                  Checkout created → paid:{" "}
                  {formatPct(snap.health.checkoutCreatedToPaid)}
                </li>
                <li>
                  Silent / broken stages:{" "}
                  {snap.health.silentStages.length
                    ? snap.health.silentStages.join("; ")
                    : "none detected"}
                </li>
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-semibold text-white">Package / revenue</h2>
            {snap.packageMix.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No paid package mix in range.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4">Package</th>
                      <th className="py-2 pr-4">Orders</th>
                      <th className="py-2 pr-4">Revenue</th>
                      <th className="py-2">Mix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.packageMix.map((row) => (
                      <tr
                        key={`${row.productKey}-${row.packageKey}`}
                        className="border-t border-slate-800"
                      >
                        <td className="py-2 pr-4">{row.productKey}</td>
                        <td className="py-2 pr-4">{row.packageKey}</td>
                        <td className="py-2 pr-4">{row.orders}</td>
                        <td className="py-2 pr-4">{formatCents(row.revenueCents)}</td>
                        <td className="py-2">{formatPct(row.mixPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Free paid-status orders (0¢): {snap.commercial.freeOrders}. Upsell/extra-gift
              split: unsupported.
            </p>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Attribution (UTM source)</h2>
              {snap.attribution.byUtmSource.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No paid attribution rows.</p>
              ) : (
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {snap.attribution.byUtmSource.slice(0, 12).map((row) => (
                    <li key={row.source}>
                      {row.source}: {row.paidOrders} paid · {formatCents(row.revenueCents)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Unsupported: {snap.attribution.unsupported.join(", ")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-lg font-semibold text-white">Lifecycle email ledger</h2>
              {snap.lifecycleEmail.byTemplateStatus.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No lifecycle rows in range.</p>
              ) : (
                <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-sm text-slate-300">
                  {snap.lifecycleEmail.byTemplateStatus.slice(0, 20).map((row) => (
                    <li key={`${row.template}-${row.status}`}>
                      {row.template} · {row.status}: {row.count}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="text-lg font-semibold text-white">Telemetry quality</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {snap.telemetryQuality.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <details className="mt-4 text-sm text-slate-400">
              <summary className="cursor-pointer text-slate-300">Source-of-truth matrix</summary>
              <ul className="mt-2 space-y-1">
                {CHRISTMAS_KPI_SOURCE_MATRIX.map((row) => (
                  <li key={row.stage}>
                    <span className="text-slate-200">{row.stage}</span>: {row.source} (
                    {row.reliability})
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </>
      ) : null}
    </div>
  );
}
