// src/pages/admin/Customers.tsx
import React, { useEffect, useMemo, useState } from "react";
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

  created_at: string | null; // ISO
  last_activity: string | null; // ISO
};

type ViewRowLoose = Record<string, any>;

type AppUserRow = {
  id: number;
  convex_id: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
  email_verification_time: number | string | null;
  creation_time: number | string | null;
  is_anonymous: number | boolean | null;
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

function safeToISO(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }

  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof v === "number") {
    // accept seconds or ms
    const n = v > 10_000_000_000 ? v : v * 1000;
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

function parseISOToDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: any, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sortByCreatedAtDesc(rows: CustomerRow[]) {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Primary source: customers_admin_view (existing, contains platform users + spending)
 * Add-on source: funnel_customers_admin_view (only funnel leads that were synced into customers)
 *
 * We merge by email (prefer primary if it exists).
 * IMPORTANT: we do NOT call .order() to avoid view column mismatches.
 */
async function loadFromCustomersAdminViewMerged(): Promise<CustomerRow[] | null> {
  // 1) primary view (your existing one)
  const primary = await supabase
    .from("customers_admin_view")
    .select(
      [
        "id",
        "name",
        "email",
        "image_url",
        "credits_used",
        "generations",
        "total_money_spent",
        "orders_count",
        "created_at",
        "last_activity",
      ].join(",")
    );

  if (primary.error) {
    const msg = (primary.error.message || "").toLowerCase();

    // fallback ONLY if view is missing
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found")) {
      return null;
    }

    console.error("[Customers] customers_admin_view error:", primary.error);
    toast.error(`Customers view error: ${primary.error.message || "Unknown error"}`);
    return [];
  }

  // 2) funnel addon view (optional; if not present/permission issues, we just ignore)
  const funnel = await supabase
    .from("funnel_customers_admin_view")
    .select(
      [
        "id",
        "name",
        "email",
        "image_url",
        "credits_used",
        "generations",
        "total_money_spent",
        "orders_count",
        "created_at",
        "last_activity",
      ].join(",")
    );

  if (funnel.error) {
    // don't block the page
    console.warn("[Customers] funnel_customers_admin_view error:", funnel.error);
  }

  const rowsA = (((primary.data as any[]) || []) as ViewRowLoose[]).map((r) => ({
    id: String(r.id ?? ""),
    name: (r.name ?? null) as string | null,
    email: (r.email ?? null) as string | null,
    image_url: (r.image_url ?? null) as string | null,
    credits_used: num(r.credits_used, 0),
    generations: num(r.generations, 0),
    total_money_spent: num(r.total_money_spent, 0),
    orders_count: num(r.orders_count, 0),
    created_at: safeToISO(r.created_at),
    last_activity: safeToISO(r.last_activity),
  })) as CustomerRow[];

  const rowsB = ((((funnel.data as any[]) || []) as ViewRowLoose[]) || []).map((r) => ({
    id: String(r.id ?? ""),
    name: (r.name ?? null) as string | null,
    email: (r.email ?? null) as string | null,
    image_url: (r.image_url ?? null) as string | null,
    credits_used: num(r.credits_used, 0),
    generations: num(r.generations, 0),
    total_money_spent: num(r.total_money_spent, 0),
    orders_count: num(r.orders_count, 0),
    created_at: safeToISO(r.created_at),
    last_activity: safeToISO(r.last_activity),
  })) as CustomerRow[];

  // Merge by email (fallback to id if email missing)
  const keyOf = (r: CustomerRow) => (r.email || r.id || "").toLowerCase().trim();

  const byKey = new Map<string, CustomerRow>();

  // add funnel first (so primary overrides with richer stats)
  for (const r of rowsB) {
    const k = keyOf(r);
    if (!k) continue;
    byKey.set(k, r);
  }

  // override with primary
  for (const r of rowsA) {
    const k = keyOf(r);
    if (!k) continue;
    byKey.set(k, r);
  }

  return sortByCreatedAtDesc(Array.from(byKey.values()));
}

/**
 * Fallback source: app_users (ONLY used if customers_admin_view missing)
 */
async function loadFromAppUsers(): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from("app_users")
    .select("id,convex_id,email,name,image,email_verification_time,creation_time,is_anonymous");

  if (error) {
    console.error("[Customers] app_users error:", error);
    toast.error(`Customers fallback error: ${error.message || "Unknown error"}`);
    return [];
  }

  const rows = (data as AppUserRow[]) || [];

  const mapped: CustomerRow[] = rows.map((u) => {
    const stableId = (u.convex_id && String(u.convex_id)) || `app_user:${String(u.id)}`;
    return {
      id: stableId,
      name: u.name ?? null,
      email: u.email ?? null,
      image_url: u.image ?? null,

      credits_used: 0,
      generations: 0,
      total_money_spent: 0,
      orders_count: 0,

      created_at: safeToISO(u.creation_time),
      last_activity: null,
    };
  });

  return sortByCreatedAtDesc(mapped);
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
    "created_at",
    "last_activity",
  ];

  const esc = (v: any) => {
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
        r.created_at ?? "",
        r.last_activity ?? "",
      ].map(esc).join(",")
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

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [source, setSource] = useState<"view" | "fallback">("view");

  const load = async () => {
    setLoading(true);

    // 1) primary view + funnel addon merge
    const fromMergedView = await loadFromCustomersAdminViewMerged();
    if (fromMergedView !== null) {
      setCustomers(fromMergedView);
      setSource("view");
      setLoading(false);
      return;
    }

    // 2) fallback only if primary view is missing
    const fromAppUsers = await loadFromAppUsers();
    setCustomers(fromAppUsers);
    setSource("fallback");
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await load();
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Customers] load failed:", e);
        toast.error(e?.message || "Failed to load customers");
        setCustomers([]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = (searchQuery || "").toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const id = (c.id || "").toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
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

      // Guard: avoid "1970" showing as active if a view gives epoch 0 or invalid date
      if (lastActivity && lastActivity.getTime() > 0 && lastActivity >= oneDayAgo) acc.active += 1;

      acc.totalRevenue += Number(c.total_money_spent || 0);
      return acc;
    }, base);
  }, [customers]);

  if (loading) {
    return (
      <div className="bg-slate-950 px-4 py-6 md:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-slate-400">Loading customers...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 px-4 py-6 md:px-8 min-h-screen text-slate-50">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
              Customers
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              View and manage all TheDigitalGifter customers, spending, and activity.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Data source:{" "}
              <span className="font-semibold">
                {source === "view"
                  ? "customers_admin_view (+ funnel_customers_admin_view)"
                  : "app_users (fallback)"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportCSV(filteredCustomers);
                toast.success("Exported CSV");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            <button
              type="button"
              onClick={() => toast.message("Campaigns coming soon")}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Send email campaign
            </button>

            <button
              type="button"
              onClick={async () => {
                await load();
                toast.success("Refreshed");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500 font-medium tracking-wide">
              Total customers
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.total.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-1">All accounts created on the platform.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500 font-medium tracking-wide">
              New this month
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.newThisMonth.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-1">Joined since the 1st of the month.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500 font-medium tracking-wide">
              Active (24h)
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {stats.active.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-1">Users active in the last 24 hours.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500 font-medium tracking-wide">
              Total Revenue
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <p className="text-2xl font-semibold text-slate-50">
                {moneyEUR(stats.totalRevenue)}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-1">Total money spent by users.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex flex-1 gap-3">
              <div className="relative max-w-md w-full">
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-slate-700 bg-slate-950 px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
                <span className="absolute right-3 inset-y-0 flex items-center text-slate-500 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-400">
              Showing {filteredCustomers.length} of {customers.length} customers
            </div>
          </div>

          <div className="rounded-md border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Credits Used</TableHead>
                  <TableHead className="text-slate-400">Generations</TableHead>
                  <TableHead className="text-slate-400">Total Spent</TableHead>
                  <TableHead className="text-slate-400">Orders</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                  <TableHead className="text-slate-400">Last Activity</TableHead>
                  <TableHead className="text-slate-400 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c) => {
                    const spent = Number(c.total_money_spent || 0);
                    const joined = parseISOToDate(c.created_at);
                    const last = parseISOToDate(c.last_activity);
                    const hasValidLast = !!last && last.getTime() > 0;

                    return (
                      <TableRow
                        key={`${c.id}:${c.email ?? ""}`}
                        className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-700">
                              <AvatarImage src={c.image_url || undefined} />
                              <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                                {initials(c.name, c.email)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex flex-col">
                              <span className="font-medium text-slate-200 text-sm">
                                {c.name || "Unknown"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {c.email || "—"}
                              </span>
                              <span className="text-[10px] text-slate-600">{c.id}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-300 font-medium">
                          {Number(c.credits_used || 0)}
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.generations || 0)}
                        </TableCell>

                        <TableCell className="text-slate-300">{moneyEUR(spent)}</TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.orders_count || 0)}
                        </TableCell>

                        <TableCell className="text-slate-400 text-xs">
                          {joined ? joined.toLocaleDateString() : "—"}
                        </TableCell>

                        <TableCell className="text-slate-400 text-xs">
                          {hasValidLast ? last!.toLocaleString() : "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              spent > 0
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                : "border-slate-700 text-slate-400 bg-slate-800/50"
                            }
                          >
                            {spent > 0 ? "Customer" : "User"}
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