// src/pages/admin/Orders.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Search, RefreshCw, Download } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type OrderViewRow = {
  id: string | number;
  user_convex_id: string | null;
  amount: number | string | null;
  amount_eur: number | string | null;
  pack: string | null;
  status: string | null;
  stripe_session_id: string | null;
  created_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_image: string | null;
};

type OrderUI = {
  id: string;
  user_convex_id: string | null;
  amount_eur: number;
  pack: string | null;
  status: string | null;
  created_at_iso: string | null;
  user_name: string | null;
  user_email: string | null;
  user_image: string | null;
  credits_spent: number;
  categories: string[];
};

type LedgerItemUI = {
  id: string;
  template_id: string | null;
  template_title: string | null;
  category: string | null;
  credits: number;
  amount: number | null;
  currency: string | null;
  occurred_at: string | null;
};

function initials(name?: string | null, email?: string | null) {
  const base = (name || "").trim() || (email || "").trim() || "??";
  const parts = base.split(/[.\-_ ]+/).filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "?").toUpperCase();
  return (a + b).slice(0, 2);
}

function moneyEUR(n: number) {
  return `€${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function parseISOToDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function exportOrdersCSV(rows: OrderUI[]) {
  const header = [
    "id",
    "user_convex_id",
    "user_name",
    "user_email",
    "pack",
    "status",
    "amount_eur",
    "credits_spent",
    "categories",
    "created_at",
  ];

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.user_convex_id ?? "",
        r.user_name ?? "",
        r.user_email ?? "",
        r.pack ?? "",
        r.status ?? "",
        r.amount_eur,
        r.credits_spent,
        r.categories.join(" | "),
        r.created_at_iso ?? "",
      ]
        .map(esc)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [selected, setSelected] = useState<OrderUI | null>(null);
  const [selectedItems, setSelectedItems] = useState<LedgerItemUI[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  async function loadOrders(showToast = false) {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from("orders_admin_view")
        .select(
          `
          id,
          user_convex_id,
          amount,
          amount_eur,
          pack,
          status,
          stripe_session_id,
          created_at,
          user_name,
          user_email,
          user_image
          `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[OrdersPage] orders_admin_view load error:", error);
        toast.error(`Failed to load orders: ${error.message}`);
        setOrders([]);
        return;
      }

      const raw = (data as OrderViewRow[]) || [];

      const ui: OrderUI[] = raw.map((o) => ({
        id: String(o.id),
        user_convex_id: o.user_convex_id ?? null,
        amount_eur: num(o.amount_eur, num(o.amount, 0)),
        pack: o.pack ?? null,
        status: o.status ?? null,
        created_at_iso: o.created_at ?? null,
        user_name: o.user_name ?? null,
        user_email: o.user_email ?? null,
        user_image: o.user_image ?? null,
        credits_spent: 0,
        categories: [],
      }));

      setOrders(ui);

      if (showToast) {
        toast.success("Orders refreshed");
      }
    } catch (e: unknown) {
      console.error("[OrdersPage] unexpected load error:", e);
      const msg = e instanceof Error ? e.message : "Failed to load orders";
      toast.error(msg);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openOrderDetails(order: OrderUI) {
    setSelected(order);
    setSelectedItems([]);
    setItemsLoading(true);

    const { data, error } = await supabase
      .from("credits_admin_view")
      .select(
        "id,template_id,template_title,category,credits,amount,currency,occurred_at,direction,order_convex_id"
      )
      .eq("order_convex_id", order.id)
      .order("occurred_at", { ascending: true });

    if (error) {
      console.warn("[OrdersPage] credits_admin_view details error:", error);
      toast.error(`Failed to load order details: ${error.message}`);
      setSelectedItems([]);
      setItemsLoading(false);
      return;
    }

    const rows = ((data as any[]) || [])
      .filter((r) => String(r.direction || "").toLowerCase() === "out")
      .map((r) => ({
        id: String(r.id),
        template_id: r.template_id ?? null,
        template_title: r.template_title ?? null,
        category: r.category ?? null,
        credits: num(r.credits, 0),
        amount: r.amount === null || r.amount === undefined ? null : num(r.amount, 0),
        currency: r.currency ?? null,
        occurred_at: r.occurred_at ?? null,
      })) as LedgerItemUI[];

    setSelectedItems(rows);
    setItemsLoading(false);

    const creditsSpent = rows.reduce((acc, r) => acc + num(r.credits, 0), 0);
    const cats = uniq(rows.map((r) => r.category || "").filter(Boolean));

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              credits_spent: creditsSpent,
              categories: cats,
            }
          : o
      )
    );

    setSelected((prev) =>
      prev
        ? {
            ...prev,
            credits_spent: creditsSpent,
            categories: cats,
          }
        : prev
    );
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;

    return orders.filter((o) => {
      const email = (o.user_email || "").toLowerCase();
      const name = (o.user_name || "").toLowerCase();
      const id = (o.id || "").toLowerCase();
      const pack = (o.pack || "").toLowerCase();
      const status = (o.status || "").toLowerCase();
      const cats = (o.categories || []).join(" ").toLowerCase();

      return (
        email.includes(q) ||
        name.includes(q) ||
        id.includes(q) ||
        pack.includes(q) ||
        status.includes(q) ||
        cats.includes(q)
      );
    });
  }, [orders, searchQuery]);

  const stats = useMemo(() => {
    return filteredOrders.reduce(
      (acc, o) => {
        acc.totalOrders += 1;
        if ((o.status || "").toLowerCase() === "completed") acc.completed += 1;
        acc.revenue += Number(o.amount_eur || 0);
        acc.credits += Number(o.credits_spent || 0);
        return acc;
      },
      {
        totalOrders: 0,
        completed: 0,
        revenue: 0,
        credits: 0,
      }
    );
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-slate-400">Loading orders...</div>
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
              Orders
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              View orders, spending, credits usage, and what templates were purchased.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportOrdersCSV(filteredOrders);
                toast.success("Orders exported");
              }}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export orders
              </span>
            </button>

            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </span>
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total orders
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.totalOrders.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">All orders in database.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Completed
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.completed.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Orders with status = completed.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Revenue
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {moneyEUR(stats.revenue)}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Total money spent.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Credits spent
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.credits.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Credits computed from ledger per order.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-3">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search by customer, email, order id, pack, status, category..."
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
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-800">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Pack</TableHead>
                  <TableHead className="text-slate-400">Categories</TableHead>
                  <TableHead className="text-slate-400">Credits</TableHead>
                  <TableHead className="text-slate-400">Amount</TableHead>
                  <TableHead className="text-slate-400">Created</TableHead>
                  <TableHead className="text-right text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((o) => {
                    const created = parseISOToDate(o.created_at_iso);

                    return (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer border-slate-800 transition-colors hover:bg-slate-800/50"
                        onClick={() => void openOrderDetails(o)}
                        title="Click to view order details"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-700">
                              <AvatarImage
                                src={o.user_image || undefined}
                                alt={o.user_name || o.user_email || "User"}
                              />
                              <AvatarFallback className="bg-slate-800 text-xs text-slate-400">
                                {initials(o.user_name, o.user_email)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-200">
                                {o.user_name || "Unknown"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {o.user_email || "—"}
                              </span>
                              <span className="text-[10px] text-slate-600">{o.id}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-300">{o.pack || "—"}</TableCell>

                        <TableCell className="text-slate-400">
                          {o.categories.length ? (
                            <div className="flex flex-wrap gap-1">
                              {o.categories.slice(0, 3).map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-300"
                                >
                                  {c}
                                </span>
                              ))}
                              {o.categories.length > 3 ? (
                                <span className="text-[11px] text-slate-500">
                                  +{o.categories.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </TableCell>

                        <TableCell className="font-medium text-slate-300">
                          {Number(o.credits_spent || 0)}
                        </TableCell>

                        <TableCell className="text-slate-300">
                          {moneyEUR(Number(o.amount_eur || 0))}
                        </TableCell>

                        <TableCell className="text-xs text-slate-400">
                          {created ? created.toLocaleString() : "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              (o.status || "").toLowerCase() === "completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-slate-700 bg-slate-800/50 text-slate-400"
                            }
                          >
                            {o.status || "unknown"}
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

      <Dialog open={!!selected} onOpenChange={(v) => (!v ? setSelected(null) : null)}>
        <DialogContent className="max-w-3xl border border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-slate-50">Order details</DialogTitle>
            <DialogDescription className="text-slate-400">
              Exact templates and categories purchased in this order (from credits ledger).
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-700">
                      <AvatarImage src={selected.user_image || undefined} />
                      <AvatarFallback className="bg-slate-800 text-xs text-slate-400">
                        {initials(selected.user_name, selected.user_email)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="text-sm font-semibold text-slate-100">
                        {selected.user_name || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {selected.user_email || "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600">{selected.id}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-slate-300">{selected.pack || "—"}</div>
                    <div className="text-lg font-semibold text-slate-50">
                      {moneyEUR(selected.amount_eur)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Credits: {Number(selected.credits_spent || 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-100">
                    Templates in this order
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        (selected.status || "").toLowerCase() === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-700 bg-slate-800/50 text-slate-400"
                      }
                    >
                      {selected.status || "unknown"}
                    </Badge>
                  </div>
                </div>

                {itemsLoading ? (
                  <div className="text-sm text-slate-400">Loading order items...</div>
                ) : selectedItems.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No ledger items found for this order.
                    <div className="mt-1 text-xs text-slate-600">
                      If this order exists but ledger is empty, it means credits usage wasn’t
                      written to <code className="text-slate-400">credits_ledger</code> with{" "}
                      <code className="text-slate-400">order_convex_id</code>.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border border-slate-800">
                    <Table>
                      <TableHeader className="bg-slate-900/50">
                        <TableRow className="border-slate-800">
                          <TableHead className="text-slate-400">Template</TableHead>
                          <TableHead className="text-slate-400">Category</TableHead>
                          <TableHead className="text-slate-400">Credits</TableHead>
                          <TableHead className="text-right text-slate-400">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((it) => (
                          <TableRow key={it.id} className="border-slate-800">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-200">
                                  {it.template_title || it.template_id || "Unknown template"}
                                </span>
                                {it.template_id ? (
                                  <span className="text-[11px] text-slate-600">
                                    {it.template_id}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="text-slate-300">
                              {it.category ? (
                                <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-300">
                                  {it.category}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-600">—</span>
                              )}
                            </TableCell>

                            <TableCell className="font-medium text-slate-300">
                              {Number(it.credits || 0)}
                            </TableCell>

                            <TableCell className="text-right text-slate-300">
                              {it.amount !== null && it.amount !== undefined
                                ? moneyEUR(Number(it.amount || 0))
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}