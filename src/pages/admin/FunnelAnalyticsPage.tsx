import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TDG_FUNNEL_REGISTRY,
  type FunnelHealthState,
  type FunnelRegistryEntry,
} from "@/features/analytics/funnelRegistry";

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
      <p className="mt-3 text-xs text-slate-400">
        Routes: {funnel.routes.join(", ")}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Purchase-capable: {funnel.purchaseCapable ? "yes" : "no"} · First-party:{" "}
        {funnel.firstPartyEvents ? "yes" : "no"} · Purchase dedupe: {funnel.purchaseDedupe}
      </p>
      {funnel.notes ? <p className="mt-2 text-xs text-slate-500">{funnel.notes}</p> : null}
      <p className="mt-3 text-[11px] text-slate-500">
        Sessions/users, step conversion, checkout, revenue/AOV, attribution, device, and safe errors
        appear when first-party event data exists for this funnel. External GA4/Meta stay unverified
        or disabled until delivery evidence exists.
      </p>
    </article>
  );
}

export default function FunnelAnalyticsPage() {
  const [selected, setSelected] = useState<string>("christmas_send_a_gift");
  const funnels = useMemo(() => TDG_FUNNEL_REGISTRY, []);
  const active = funnels.find((f) => f.id === selected) || funnels[0];

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
