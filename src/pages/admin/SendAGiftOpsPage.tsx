import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { adminDisableSendGift, adminListSendGifts } from "@/features/christmas/sendAGift/sendAGiftApi";

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; gifts: Array<Record<string, unknown>> };

export default function SendAGiftOpsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setState({ status: "error", message: "Admin session required." });
        return;
      }
      const res = await adminListSendGifts(token);
      const gifts = res.gifts || [];
      if (!gifts.length) setState({ status: "empty" });
      else setState({ status: "ready", gifts });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Failed to load Send-a-Gift ops",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Send a Gift — Ops</h1>
          <p className="text-sm text-slate-400">
            Order/payment, gift/share, email, entitlements. Private gift messages are not shown.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="text-sm text-indigo-300 underline" to="/admin/funnel-analytics">
            Funnel Analytics
          </Link>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
      </header>

      {state.status === "loading" ? (
        <p className="text-sm text-slate-400">Loading Send-a-Gift orders…</p>
      ) : null}
      {state.status === "empty" ? (
        <p className="text-sm text-slate-400">No Send-a-Gift shares yet.</p>
      ) : null}
      {state.status === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-rose-300">{state.message}</p>
          <button
            type="button"
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm text-white"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Gift</th>
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Entitlements</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.gifts.map((g) => (
                <tr key={String(g.id)} className="border-t border-slate-800">
                  <td className="px-3 py-2">{String(g.package_key)}</td>
                  <td className="px-3 py-2">{String(g.payment_status ?? "—")}</td>
                  <td className="px-3 py-2">{String(g.status)}</td>
                  <td className="px-3 py-2">
                    {g.first_opened_at ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2">{String(g.email_status ?? "—")}</td>
                  <td className="px-3 py-2">
                    {String(g.entitlements_used)}/{String(g.entitlements_total)} (rem{" "}
                    {String(g.entitlements_remaining)})
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {g.last_safe_error ? String(g.last_safe_error).slice(0, 80) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="text-left text-xs text-indigo-300 underline"
                        onClick={() => {
                          const url = `${window.location.origin}${String(g.gift_url || "")}`;
                          void navigator.clipboard.writeText(url);
                        }}
                      >
                        Copy gift URL
                      </button>
                      <button
                        type="button"
                        className="text-left text-xs text-rose-300 underline"
                        onClick={async () => {
                          const { data } = await supabase.auth.getSession();
                          const token = data.session?.access_token;
                          if (!token) return;
                          await adminDisableSendGift(token, String(g.share_id));
                          await load();
                        }}
                      >
                        Disable gift
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
