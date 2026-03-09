// FILE: src/pages/admin/Customers.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  image_url: string | null;
  credits_used: number;
  generations: number;
  total_money_spent: number;
  orders_count: number;
  created_at: string | null;
  last_activity: string | null;
  promo_code: string | null;
  promo_sent_at: string | null;
  has_purchased: boolean;
};

function initials(name?: string | null, email?: string | null) {
  const base = (name || "").trim() || (email || "").trim() || "??";
  const parts = base.split(/[.\-_ ]+/).filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "?").toUpperCase();
  return (a + b).slice(0, 2);
}

function moneyEUR(n: number) {
  const x = Number(n);
  return `€${Number.isFinite(x) ? x.toFixed(2) : "0.00"}`;
}

function parseISOToDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function exportCSV(rows: CustomerRow[]) {
  const header = [
    "id",
    "name",
    "email",
    "credits_used",
    "generations",
    "total_money_spent",
    "orders_count",
    "has_purchased",
    "promo_code",
    "promo_sent_at",
    "created_at",
    "last_activity",
  ];

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    const needs = /[",\n]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.name ?? "",
        r.email ?? "",
        r.credits_used ?? 0,
        r.generations ?? 0,
        r.total_money_spent ?? 0,
        r.orders_count ?? 0,
        r.has_purchased ? 1 : 0,
        r.promo_code ?? "",
        r.promo_sent_at ?? "",
        r.created_at ?? "",
        r.last_activity ?? "",
      ]
        .map(esc)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadCustomers(): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from("customers_admin_view_unified")
    .select(
      `
      id,
      name,
      email,
      image_url,
      credits_used,
      generations,
      total_money_spent,
      orders_count,
      created_at,
      last_activity,
      promo_code,
      promo_sent_at,
      has_purchased
      `
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[Customers] load error:", error);
    throw new Error(error.message || "Failed to load customers");
  }

  return ((data ?? []) as CustomerRow[]).map((row) => ({
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null,
    image_url: row.image_url ?? null,
    credits_used: Number(row.credits_used || 0),
    generations: Number(row.generations || 0),
    total_money_spent: Number(row.total_money_spent || 0),
    orders_count: Number(row.orders_count || 0),
    created_at: row.created_at ?? null,
    last_activity: row.last_activity ?? null,
    promo_code: row.promo_code ?? null,
    promo_sent_at: row.promo_sent_at ?? null,
    has_purchased: Boolean(row.has_purchased),
  }));
}

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const load = useCallback(async () => {
    const rows = await loadCustomers();
    setCustomers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const rows = await loadCustomers();
        if (cancelled) return;
        setCustomers(rows);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load customers";
        console.error("[Customers] initial load failed:", e);
        toast.error(msg);
        setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const id = (c.id || "").toLowerCase();
      const promo = (c.promo_code || "").toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        id.includes(q) ||
        promo.includes(q)
      );
    });
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const base = { total: 0, newThisMonth: 0, active: 0, totalRevenue: 0 };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return customers.reduce((acc, c) => {
      acc.total += 1;

      const createdAt = parseISOToDate(c.created_at);
      const lastActivity = parseISOToDate(c.last_activity);

      if (createdAt && createdAt >= startOfMonth) acc.newThisMonth += 1;
      if (lastActivity && lastActivity >= oneDayAgo) acc.active += 1;

      acc.totalRevenue += Number(c.total_money_spent || 0);
      return acc;
    }, base);
  }, [customers]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
      toast.success("Customers refreshed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Refresh failed";
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-slate-400">Loading customers...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
              Customers
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              View and manage all TheDigitalGifter customers, spending, promo, and activity.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Data source: <span className="font-semibold">customers_admin_view_unified</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportCSV(filteredCustomers);
                toast.success("Exported CSV");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            <button
              type="button"
              onClick={() => toast.message("Campaigns coming soon")}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Send email campaign
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total customers
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.total.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">All accounts loaded in admin view.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              New this month
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.newThisMonth.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Joined since the 1st of the month.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Active (24h)
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.active.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Users active in the last 24 hours.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Revenue
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {moneyEUR(stats.totalRevenue)}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Total money spent by matched users.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-3">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search by name, email, ID, promo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-slate-700 bg-slate-950 px-4 py-2.5 pr-10 text-sm text-slate-200 outline-none transition-all placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                  <Search className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-400">
              Showing {filteredCustomers.length} of {customers.length} customers
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-800">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Promo</TableHead>
                  <TableHead className="text-slate-400">Credits Used</TableHead>
                  <TableHead className="text-slate-400">Generations</TableHead>
                  <TableHead className="text-slate-400">Total Spent</TableHead>
                  <TableHead className="text-slate-400">Orders</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                  <TableHead className="text-slate-400">Last Activity</TableHead>
                  <TableHead className="text-right text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c) => {
                    const spent = Number(c.total_money_spent || 0);
                    const joined = parseISOToDate(c.created_at);
                    const last = parseISOToDate(c.last_activity);
                    const promoSent = parseISOToDate(c.promo_sent_at);

                    const statusLabel =
                      c.has_purchased || spent > 0 ? "Purchased" : "Lead";

                    const statusClass =
                      c.has_purchased || spent > 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 bg-slate-800/50 text-slate-400";

                    return (
                      <TableRow
                        key={`${c.id}:${c.email ?? ""}`}
                        className="border-slate-800 transition-colors hover:bg-slate-800/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-700">
                              <AvatarImage
                                src={c.image_url || undefined}
                                alt={c.name || c.email || "User"}
                              />
                              <AvatarFallback className="bg-slate-800 text-xs text-slate-400">
                                {initials(c.name, c.email)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-200">
                                {c.name || "Unknown"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {c.email || "—"}
                              </span>
                              <span className="text-[10px] text-slate-600">{c.id}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-300">
                          {c.promo_code ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                                >
                                  {c.promo_code}
                                </Badge>

                                {promoSent ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  >
                                    Sent
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  >
                                    Not sent
                                  </Badge>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500">
                                {promoSent ? promoSent.toLocaleString() : "—"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </TableCell>

                        <TableCell className="font-medium text-slate-300">
                          {Number(c.credits_used || 0)}
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.generations || 0)}
                        </TableCell>

                        <TableCell className="text-slate-300">{moneyEUR(spent)}</TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.orders_count || 0)}
                        </TableCell>

                        <TableCell className="text-xs text-slate-400">
                          {joined ? joined.toLocaleDateString() : "—"}
                        </TableCell>

                        <TableCell className="text-xs text-slate-400">
                          {last ? last.toLocaleString() : "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Badge variant="outline" className={statusClass}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}