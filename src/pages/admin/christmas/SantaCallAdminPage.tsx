import { useCallback, useEffect, useState } from "react";
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

  const ent = stats?.entitlements || {};

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Santa Voice Call</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ops dashboard — child PII is hidden unless needed for authorized support.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
        >
          Refresh
        </button>
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
  );
}
