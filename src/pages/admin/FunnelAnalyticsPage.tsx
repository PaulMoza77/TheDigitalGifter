import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  TDG_FUNNEL_REGISTRY,
  type FunnelHealthState,
  type FunnelRegistryEntry,
} from "@/features/analytics/funnelRegistry";

type MetricState = "loaded" | "empty" | "error" | "unavailable";

type MetricCard = {
  key: string;
  label: string;
  value: string;
  state: MetricState;
  note?: string;
};

function HealthPill({ state }: { state: FunnelHealthState }) {
  const colors: Record<FunnelHealthState, string> = {
    healthy: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    degraded: "bg-amber-500/20 text-amber-100 border-amber-500/40",
    unverified: "bg-slate-500/20 text-slate-200 border-slate-500/40",
    disabled: "bg-slate-800 text-slate-400 border-slate-700",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${colors[state]}`}>
      {state}
    </span>
  );
}

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{m.label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-50">{m.value}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {m.state}
            {m.note ? ` · ${m.note}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: FunnelRegistryEntry }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">{funnel.label}</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">{funnel.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HealthPill state={funnel.ga4} />
          <HealthPill state={funnel.metaPixel} />
          <HealthPill state={funnel.metaCapi} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Routes: {funnel.routes.join(", ")}</p>
      <p className="mt-1 text-xs text-slate-400">
        Purchase-capable: {funnel.purchaseCapable ? "yes" : "no"} · First-party:{" "}
        {funnel.firstPartyEvents ? "yes" : "no"} · Purchase dedupe: {funnel.purchaseDedupe}
      </p>
      {funnel.notes ? <p className="mt-2 text-xs text-slate-500">{funnel.notes}</p> : null}
    </article>
  );
}

async function loadSendAGiftMetrics(): Promise<MetricCard[]> {
  const { data, error } = await supabase
    .from("christmas_orders")
    .select("id,payment_status,fulfillment_status,amount_cents,currency,utm_source,landing_path,created_at")
    .eq("product_key", "christmas_send_a_gift")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return [
      {
        key: "error",
        label: "First-party orders",
        value: "Error",
        state: "error",
        note: "Retry from Admin after auth",
      },
    ];
  }

  const rows = data || [];
  if (rows.length === 0) {
    return [
      { key: "sessions", label: "Sessions / users", value: "—", state: "empty", note: "No first-party rows yet" },
      { key: "steps", label: "Step counts", value: "—", state: "empty", note: "Awaiting funnel events" },
      { key: "checkout", label: "Checkout starts", value: "0", state: "empty" },
      { key: "purchases", label: "Purchases / failures", value: "0 / 0", state: "empty" },
      { key: "conversion", label: "Conversion / dropoff", value: "—", state: "empty" },
      { key: "revenue", label: "Revenue / AOV", value: "$0 / —", state: "empty" },
      { key: "attribution", label: "Attribution", value: "—", state: "empty" },
      { key: "device", label: "Browser / device / in-app", value: "—", state: "unavailable", note: "Not collected yet" },
      { key: "errors", label: "Safe errors", value: "0", state: "empty" },
      {
        key: "health",
        label: "GA4 / Pixel / CAPI / dedupe",
        value: "unverified",
        state: "loaded",
        note: "External delivery not proven",
      },
    ];
  }

  const paid = rows.filter((r) => r.payment_status === "paid");
  const failed = rows.filter((r) => r.payment_status === "failed" || r.fulfillment_status === "failed");
  const revenueCents = paid.reduce((s, r) => s + Number(r.amount_cents || 0), 0);
  const aov = paid.length ? revenueCents / paid.length / 100 : 0;
  const sources = [...new Set(rows.map((r) => r.utm_source).filter(Boolean))];
  const checkoutStarts = rows.length;
  const conversion = checkoutStarts ? ((paid.length / checkoutStarts) * 100).toFixed(1) : "0";

  return [
    {
      key: "sessions",
      label: "Sessions / users",
      value: String(rows.length),
      state: "loaded",
      note: "Order rows as first-party proxy",
    },
    {
      key: "steps",
      label: "Step counts",
      value: "partial",
      state: "unavailable",
      note: "Detailed step table not exposed here",
    },
    { key: "checkout", label: "Checkout starts", value: String(checkoutStarts), state: "loaded" },
    {
      key: "purchases",
      label: "Purchases / failures",
      value: `${paid.length} / ${failed.length}`,
      state: "loaded",
    },
    {
      key: "conversion",
      label: "Conversion / dropoff",
      value: `${conversion}% / ${(100 - Number(conversion)).toFixed(1)}%`,
      state: "loaded",
    },
    {
      key: "revenue",
      label: "Revenue / AOV",
      value: `$${(revenueCents / 100).toFixed(2)} / $${aov.toFixed(2)}`,
      state: "loaded",
    },
    {
      key: "attribution",
      label: "Attribution",
      value: sources.length ? sources.slice(0, 4).join(", ") : "none",
      state: sources.length ? "loaded" : "empty",
    },
    {
      key: "device",
      label: "Browser / device / in-app",
      value: "—",
      state: "unavailable",
      note: "Not in christmas_orders",
    },
    { key: "errors", label: "Safe errors", value: String(failed.length), state: "loaded" },
    {
      key: "health",
      label: "GA4 / Pixel / CAPI / dedupe",
      value: "unverified",
      state: "loaded",
      note: "External delivery evidence required for healthy",
    },
  ];
}

export default function FunnelAnalyticsPage() {
  const [selected, setSelected] = useState<string>("christmas_send_a_gift");
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const funnels = useMemo(() => TDG_FUNNEL_REGISTRY, []);
  const active = funnels.find((f) => f.id === selected) || funnels[0];

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setLoadError(null);
      try {
        if (active?.id === "christmas_send_a_gift") {
          const next = await loadSendAGiftMetrics();
          if (!cancelled) setMetrics(next);
        } else {
          if (!cancelled) {
            setMetrics([
              {
                key: "placeholder",
                label: "Deep metrics",
                value: "Use linked dashboards",
                state: "unavailable",
                note: "Send-a-Gift depth is wired; other funnels keep existing Pet/Christmas pages",
              },
            ]);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "load_failed");
          setMetrics([
            {
              key: "error",
              label: "Metrics",
              value: "Error",
              state: "error",
              note: "Retry",
            },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [active?.id, refreshKey]);

  return (
    <div className="space-y-6 p-1">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-50">Funnel Analytics</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Registry-driven visibility across Pet and Christmas funnels. External delivery is never
          marked healthy without evidence.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-indigo-300 underline" to="/admin/pet-funnel-analytics">
            Pet Funnel Analytics
          </Link>
          <Link className="text-indigo-300 underline" to="/admin/christmas-control">
            Christmas control center
          </Link>
          <Link className="text-indigo-300 underline" to="/admin/send-a-gift">
            Send a Gift ops
          </Link>
        </div>
      </header>

      <label className="block max-w-md space-y-1 text-sm text-slate-300">
        <span>Funnel</span>
        <select
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          value={active?.id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {active ? <FunnelCard funnel={active} /> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-200">Conversion metrics</h2>
          {loadError ? (
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Retry
            </button>
          ) : null}
        </div>
        {loading ? <p className="text-sm text-slate-400">Loading metrics…</p> : <MetricGrid metrics={metrics} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-200">All registered funnels</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {funnels.map((f) => (
            <FunnelCard key={f.id} funnel={f} />
          ))}
        </div>
      </section>
    </div>
  );
}
