// src/pages/admin/Credits.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CreditRow = {
  id: string;
  user_convex_id: string;
  user_name: string | null;
  user_email: string | null;
  user_image: string | null;

  event_type: string;
  direction: "in" | "out";
  credits: number;

  order_convex_id: string | null;
  template_id: string | null;
  template_title: string | null;
  category: string | null;

  amount: number | null;
  currency: string | null;
  note: string | null;

  occurred_at: string;
  created_at: string;
};

type BalanceRow = {
  user_convex_id: string;
  user_name: string | null;
  user_email: string | null;
  user_image: string | null;
  balance: number;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function clsBadge(dir: "in" | "out") {
  return dir === "in"
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
    : "bg-rose-500/15 text-rose-200 border-rose-500/30";
}

export default function Credits() {
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [limit, setLimit] = useState(200);

  async function load() {
    setLoading(true);

    const [ledgerRes, balRes] = await Promise.all([
      supabase
        .from("credits_admin_view")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit),
      supabase
        .from("user_credits_balance_view")
        .select("*")
        .order("balance", { ascending: false })
        .limit(2000),
    ]);

    if (ledgerRes.error) console.error(ledgerRes.error);
    if (balRes.error) console.error(balRes.error);

    setRows((ledgerRes.data as any) ?? []);
    setBalances((balRes.data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (dir !== "all" && r.direction !== dir) return false;

      if (!needle) return true;

      const hay = [
        r.user_name,
        r.user_email,
        r.user_convex_id,
        r.event_type,
        r.order_convex_id,
        r.template_title,
        r.template_id,
        r.category,
        r.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [rows, q, dir]);

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Credits</h1>
          <p className="text-white/60 text-sm">
            Ledger (Supabase) — istoric complet + balance per user.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user / email / order / template..."
            className="w-full md:w-[360px] rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          />

          <select
            value={dir}
            onChange={(e) => setDir(e.target.value as any)}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
          >
            <option value="all">All</option>
            <option value="in">IN</option>
            <option value="out">OUT</option>
          </select>

          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
          >
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
          </select>

          <button
            onClick={load}
            className="rounded-xl bg-white text-black px-4 py-2 font-medium hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Balances */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/70">Top balances</div>
          <div className="text-xs text-white/50">
            Users: {balances.length}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {balances.slice(0, 9).map((b) => (
            <div
              key={b.user_convex_id}
              className="rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <div className="text-sm font-medium">
                {b.user_name || "Unknown"}
              </div>
              <div className="text-xs text-white/60">{b.user_email || "-"}</div>
              <div className="mt-2 text-lg font-semibold">
                {Number(b.balance || 0).toLocaleString()} credits
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ledger table */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-white/70">Ledger</div>
          <div className="text-xs text-white/50">
            Showing: {filtered.length} / {rows.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Dir</th>
                <th className="text-right px-4 py-3">Credits</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Template</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Note</th>
                <th className="text-left px-4 py-3">Occurred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-white/70" colSpan={9}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-white/70" colSpan={9}>
                    No rows.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.user_name || "Unknown"}
                      </div>
                      <div className="text-xs text-white/60">
                        {r.user_email || r.user_convex_id}
                      </div>
                    </td>

                    <td className="px-4 py-3">{r.event_type}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${clsBadge(
                          r.direction
                        )}`}
                      >
                        {r.direction.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(r.credits || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-xs text-white/70">
                      {r.order_convex_id || "-"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs text-white/70">
                        {r.template_title || "-"}
                      </div>
                      <div className="text-[11px] text-white/40">
                        {r.template_id || ""}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-white/70">
                      {r.category || "-"}
                    </td>

                    <td className="px-4 py-3 text-xs text-white/70">
                      {r.note || "-"}
                    </td>

                    <td className="px-4 py-3 text-xs text-white/70">
                      {fmtDate(r.occurred_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}