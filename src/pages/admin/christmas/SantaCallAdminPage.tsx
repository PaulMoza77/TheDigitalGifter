import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, CircleDollarSign, Clock3, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stats = {
  ok?: boolean;
  orders?: number;
  paidOrders?: number;
  refundedOrders?: number;
  entitlements?: Record<string, number>;
  secondsUsed?: number;
  aiCostUsd?: number;
  grossRevenueMinor?: number;
  currencyHint?: string;
  recentErrors?: Array<{ id: string; error_code: string | null; created_at: string }>;
  productEnabled?: boolean;
  error?: string;
};

async function adminHeaders() {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || anon;
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${token}`,
  };
}

export default function SantaCallAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const url = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-call`;
    const res = await fetch(url, {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ action: "stats" }),
    });
    const data = (await res.json()) as Stats;
    setStats(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: "resend_email" | "revoke" | "reissue") {
    setBusy(true);
    setMessage(null);
    try {
      const url = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-call`;
      const res = await fetch(url, {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({ action, order_id: orderId.trim() }),
      });
      const data = await res.json();
      setMessage(JSON.stringify(data));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function sweepStaleSessions() {
    setBusy(true);
    setMessage(null);
    try {
      const url = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-call`;
      const res = await fetch(url, { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ action: "sweep_stale_sessions", stale_seconds: 90 }) });
      setMessage(JSON.stringify(await res.json()));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ent = stats?.entitlements || {};
  const paid = stats?.paidOrders;
  const revenue = stats?.grossRevenueMinor != null && stats?.currencyHint
    ? `${(stats.grossRevenueMinor / 100).toFixed(2)} ${String(stats.currencyHint).toUpperCase()}`
    : "Not connected";
  const cards = [
    { label: "Paid initial + extension orders", value: paid ?? "Not connected", note: "Stripe-verified · TEST/LIVE separated", icon: CircleDollarSign },
    { label: "Gross revenue", value: revenue, note: "Stripe paid records only", icon: BarChart3 },
    { label: "Completed calls", value: ent.completed ?? "Not connected", note: "Santa entitlement sessions", icon: Sparkles },
    { label: "Active calls", value: ent.in_progress ?? "Not connected", note: "Server session state", icon: Activity },
    { label: "Estimated AI cost", value: stats?.aiCostUsd != null ? `$${stats.aiCostUsd.toFixed(4)}` : "Not connected", note: "Estimate, not provider billing", icon: Clock3 },
    { label: "Launch status", value: stats?.productEnabled === false ? "Paused" : "Not verified", note: "Production flag requires owner approval", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-full bg-[#070b14] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Analytics Command Center</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Santa Call Romania</h2>
          <p className="mt-1 text-sm text-slate-400">
            Authoritative Stripe, entitlement and provider operations. Customer PII and audio are excluded.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> Refresh data
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/10">
            <div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-400">{label}</p><Icon className="h-5 w-5 text-amber-300" /></div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{note} · Updated {stats ? "just now" : "not available"}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Conversion funnel</h3><p className="mt-1 text-xs text-slate-500">GA4 / Meta platform reception is not connected in this environment.</p></div><BarChart3 className="h-5 w-5 text-slate-500" /></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {["Landing page", "CTA", "Checkout", "Paid", "Call completed"].map((stage) => <div key={stage} className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-3"><p className="text-xs text-slate-500">{stage}</p><p className="mt-2 font-semibold text-slate-300">Not connected</p></div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" /><div><h3 className="font-semibold">Verification status</h3><p className="mt-2 text-sm leading-6 text-slate-300">Stripe and entitlement metrics are server-authoritative. Meta, GA4, Clarity, ad spend and provider billing are shown as unavailable until authenticated integrations are connected.</p></div></div></section>
      </div>

      {stats?.error ? (
        <p className="mt-4 text-sm text-rose-300">{stats.error}</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Orders", stats?.orders ?? "—"],
            ["Paid", stats?.paidOrders ?? "—"],
            ["Refunds", stats?.refundedOrders ?? "—"],
            ["Ready (unused)", ent.ready ?? "—"],
            ["In progress", ent.in_progress ?? "—"],
            ["Completed", ent.completed ?? "—"],
            ["Failed", ent.failed ?? "—"],
            ["Expired / revoked", (ent.expired || 0) + (ent.revoked || 0)],
            ["Seconds used", stats?.secondsUsed ?? "—"],
            ["AI cost (USD est.)", stats?.aiCostUsd ?? "—"],
            [
              "Gross revenue",
              stats?.grossRevenueMinor != null
                ? `${(stats.grossRevenueMinor / 100).toFixed(2)} ${String(stats.currencyHint || "").toUpperCase()}`
                : "—",
            ],
            ["Feature enabled", stats?.productEnabled === false ? "KILL SWITCH" : "yes"],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-white">Support actions</h3>
        <p className="mt-1 text-xs text-slate-400">Uses order UUID. Reissue returns a new access token once.</p>
        <input
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="christmas_order_id"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !orderId.trim()}
            onClick={() => void runAction("resend_email")}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Resend email
          </button>
          <button
            type="button"
            disabled={busy || !orderId.trim()}
            onClick={() => void runAction("reissue")}
            className="rounded-lg bg-emerald-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Reissue access
          </button>
          <button
            type="button"
            disabled={busy || !orderId.trim()}
            onClick={() => void runAction("revoke")}
            className="rounded-lg bg-rose-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Revoke link
          </button>
        </div>
        {message ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">{message}</pre>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h3 className="text-sm font-semibold text-white">Provider watchdog</h3><p className="mt-1 text-xs text-slate-400">Find active sessions with no heartbeat for 90 seconds and request provider hangup. Every result is returned for audit.</p></div>
          <button type="button" disabled={busy} onClick={() => void sweepStaleSessions()} className="rounded-lg border border-rose-400/40 px-3 py-2 text-sm text-rose-100 disabled:opacity-40">Sweep stale sessions</button>
        </div>
      </div>

      {stats?.recentErrors?.length ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-white">Recent technical errors</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {stats.recentErrors.map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-800 px-3 py-2">
                <span className="font-mono text-xs text-slate-500">{row.id.slice(0, 8)}</span> · {row.error_code} ·{" "}
                {row.created_at}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>
    </div>
  );
}
