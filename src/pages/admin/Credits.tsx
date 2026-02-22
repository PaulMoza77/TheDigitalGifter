// src/pages/admin/Credits.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type CreditRow = {
  id: string;

  user_convex_id: string;
  user_name: string | null;
  user_email: string | null;
  user_image: string | null;

  event_type: string | null;
  direction: "in" | "out";
  credits: number;

  order_convex_id: string | null;
  template_id: string | null;
  template_title: string | null;
  category: string | null;

  amount: number | null;
  currency: string | null;
  note: string | null;

  occurred_at: string | null;
  created_at: string | null;
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
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

function clsBadge(dir: "in" | "out") {
  return dir === "in"
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
    : "bg-rose-500/15 text-rose-200 border-rose-500/30";
}

function num(v: any, fallback = 0) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickFirst<T>(...vals: T[]): T {
  for (const v of vals) {
    if (v !== null && v !== undefined && (typeof v !== "string" || v !== "")) return v;
  }
  return vals[vals.length - 1];
}

function normalizeDirection(v: any): "in" | "out" {
  const s = String(v || "").toLowerCase();
  return s === "in" ? "in" : "out";
}

function toISO(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "number") {
    const n = v > 10_000_000_000 ? v : v * 1000;
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function mapLedgerRow(r: any): CreditRow {
  const user_convex_id = String(
    pickFirst(r.user_convex_id, r.user_id, r.userId, r.customer_id, "")
  );

  const user_name = pickFirst<string | null>(
    r.user_name,
    r.customer_name,
    r.name,
    null
  );

  const user_email = pickFirst<string | null>(
    r.user_email,
    r.customer_email,
    r.email,
    null
  );

  const user_image = pickFirst<string | null>(
    r.user_image,
    r.customer_image,
    r.image,
    r.image_url,
    null
  );

  const direction = normalizeDirection(pickFirst(r.direction, r.dir, "out"));
  const credits = num(pickFirst(r.credits, r.delta_credits, r.credit_delta, r.amount_credits, 0), 0);

  return {
    id: String(pickFirst(r.id, r.ledger_id, r.row_id, r.uuid, "")),

    user_convex_id,
    user_name,
    user_email,
    user_image,

    event_type: pickFirst<string | null>(
      r.event_type,
      r.type,
      r.source,
      null
    ),

    direction,
    credits,

    order_convex_id: pickFirst<string | null>(
      r.order_convex_id,
      r.order_id,
      r.reference_id,
      null
    ),

    template_id: pickFirst<string | null>(r.template_id, r.templateId, null),
    template_title: pickFirst<string | null>(
      r.template_title,
      r.title,
      r.template_name,
      null
    ),
    category: pickFirst<string | null>(r.category, r.template_category, null),

    amount: r.amount === null || r.amount === undefined ? null : num(r.amount, 0),
    currency: pickFirst<string | null>(r.currency, null),
    note: pickFirst<string | null>(r.note, r.message, r.reason, null),

    occurred_at: toISO(pickFirst(r.occurred_at, r.created_at, r.timestamp, null)),
    created_at: toISO(pickFirst(r.created_at, r.occurred_at, null)),
  };
}

function mapBalanceRow(b: any): BalanceRow {
  const user_convex_id = String(pickFirst(b.user_convex_id, b.user_id, b.userId, ""));
  return {
    user_convex_id,
    user_name: pickFirst<string | null>(b.user_name, b.customer_name, b.name, null),
    user_email: pickFirst<string | null>(b.user_email, b.customer_email, b.email, null),
    user_image: pickFirst<string | null>(b.user_image, b.customer_image, b.image, b.image_url, null),
    balance: num(pickFirst(b.balance, b.credits, b.current_balance, 0), 0),
  };
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
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("user_credits_balance_view")
        .select("*")
        .order("balance", { ascending: false })
        .limit(2000),
    ]);

    if (ledgerRes.error) {
      console.error("[Credits] credits_admin_view error:", ledgerRes.error);
      toast.error(`Credits error: ${ledgerRes.error.message}`);
    }
    if (balRes.error) {
      console.error("[Credits] user_credits_balance_view error:", balRes.error);
      toast.error(`Balances error: ${balRes.error.message}`);
    }

    const ledger = ((ledgerRes.data as any[]) || []).map(mapLedgerRow);
    const bals = ((balRes.data as any[]) || []).map(mapBalanceRow);

    setRows(ledger);
    setBalances(bals);
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
    <div className="bg-slate-950 min-h-screen p-6 text-white">
      <div className="max-w-7xl mx-auto">
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
            <div className="text-xs text-white/50">Users: {balances.length}</div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {balances.slice(0, 9).map((b) => (
              <div
                key={b.user_convex_id}
                className="rounded-xl border border-white/10 bg-black/30 p-3"
              >
                <div className="text-sm font-medium">{b.user_name || "Unknown"}</div>
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
                        <div className="font-medium">{r.user_name || "Unknown"}</div>
                        <div className="text-xs text-white/60">
                          {r.user_email || r.user_convex_id}
                        </div>
                      </td>

                      <td className="px-4 py-3">{r.event_type || "-"}</td>

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
    </div>
  );
}