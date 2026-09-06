import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { adminDisableSendGift, adminListSendGifts } from "@/features/christmas/sendAGift/sendAGiftApi";

type GiftRow = {
  id: string;
  order_id: string;
  share_id: string;
  gift_url: string;
  package_key: string;
  status: string;
  first_opened_at: string | null;
  email_status: string;
  last_safe_error: string | null;
  entitlements_total: number;
  entitlements_used: number;
  entitlements_remaining: number;
  payment_status: string | null;
  fulfillment_status: string | null;
  created_at: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; gifts: GiftRow[] };

export default function SendAGiftAdminPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setState({ status: "error", message: "Sign in required." });
        return;
      }
      const res = await adminListSendGifts(token);
      const gifts = (res.gifts || []) as GiftRow[];
      setState(gifts.length ? { status: "ready", gifts } : { status: "empty" });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Failed to load Send-a-Gift orders",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-1">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Christmas</p>
        <h1 className="text-2xl font-semibold text-slate-50">Send a Gift</h1>
        <p className="text-sm text-slate-400">
          Order/package, payment, share, first-opened, email, entitlements, and last safe error.
          Private gift messages are hidden by default.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-indigo-300 underline" to="/admin/christmas-control">
            Christmas control center
          </Link>
          <Link className="text-indigo-300 underline" to="/admin/funnel-analytics">
            Funnel Analytics
          </Link>
        </div>
      </header>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {state.status === "loading" ? (
        <p className="text-sm text-slate-400">Loading Send-a-Gift orders…</p>
      ) : null}
      {state.status === "empty" ? (
        <p className="text-sm text-slate-400">No Send-a-Gift shares yet.</p>
      ) : null}
      {state.status === "error" ? (
        <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-100">{state.message}</p>
          <Button type="button" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Share</th>
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Entitlements</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.gifts.map((g) => (
                <tr key={g.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">{g.package_key}</td>
                  <td className="px-3 py-2 text-xs">
                    {g.payment_status || "—"} / {g.fulfillment_status || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{g.status}</td>
                  <td className="px-3 py-2 text-xs">
                    {g.first_opened_at ? new Date(g.first_opened_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{g.email_status}</td>
                  <td className="px-3 py-2 text-xs">
                    {g.entitlements_used}/{g.entitlements_total} (rem {g.entitlements_remaining})
                  </td>
                  <td className="px-3 py-2 text-xs text-amber-200">{g.last_safe_error || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = `${window.location.origin}${g.gift_url}`;
                          void navigator.clipboard.writeText(url);
                        }}
                      >
                        Copy URL
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy === g.share_id || g.status === "disabled"}
                        onClick={async () => {
                          setBusy(g.share_id);
                          try {
                            const { data: session } = await supabase.auth.getSession();
                            const token = session.session?.access_token;
                            if (!token) throw new Error("auth required");
                            await adminDisableSendGift(token, g.share_id);
                            await load();
                          } catch {
                            /* load() surfaces errors */
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        Disable
                      </Button>
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
