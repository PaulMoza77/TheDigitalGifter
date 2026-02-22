// src/pages/admin/Customers.tsx
import React, { useMemo, useState } from "react";
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
import { Search } from "lucide-react";
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

  // already ISO-ish
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // epoch ms / seconds
  if (typeof v === "number") {
    const n = v > 10_000_000_000 ? v : v * 1000; // handle seconds
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

async function loadFromCustomersAdminView(): Promise<CustomerRow[] | null> {
  // ✅ FIX: NU MAI FOLOSIM .order("created_at") (poate da 400 / mismatch)
  const { data, error } = await supabase
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

  if (error) {
    const msg = error.message || "Unknown error";
    // fallback ONLY if view missing
    if (String(msg).toLowerCase().includes("does not exist")) return null;

    console.error("[Customers] customers_admin_view error:", error);
    toast.error(`Customers view error: ${msg}`);
    // do NOT fallback on permission/column errors; show empty so you see issue
    return [];
  }

  const rows = ((data as any[]) || []) as ViewRowLoose[];

  const mapped = rows.map((r) => {
    const image = (r.image_url ?? null) as string | null;

    return {
      id: String(r.id ?? ""),
      name: (r.name ?? null) as string | null,
      email: (r.email ?? null) as string | null,
      image_url: image,

      credits_used: num(r.credits_used, 0),
      generations: num(r.generations, 0),
      total_money_spent: num(r.total_money_spent, 0),
      orders_count: num(r.orders_count, 0),

      created_at: safeToISO(r.created_at),
      last_activity: safeToISO(r.last_activity),
    } satisfies CustomerRow;
  });

  return sortByCreatedAtDesc(mapped);
}

async function loadFromAppUsers(): Promise<CustomerRow[]> {
  // fallback
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id,convex_id,email,name,image,email_verification_time,creation_time,is_anonymous"
    );

  if (error) {
    console.error("[Customers] app_users error:", error);
    toast.error(`Customers fallback error: ${error.message}`);
    return [];
  }

  const rows = (data as AppUserRow[]) || [];

  const mapped = rows.map((u) => {
    const stableId =
      (u.convex_id && String(u.convex_id)) || `app_user:${String(u.id)}`;

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
    } satisfies CustomerRow;
  });

  return sortByCreatedAtDesc(mapped);
}

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [source, setSource] = useState<"view" | "fallback">("view");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1) Use view (primary)
      const fromView = await loadFromCustomersAdminView();
      if (cancelled) return;

      if (fromView !== null) {
        setCustomers(fromView);
        setSource("view");
        setLoading(false);
        return;
      }

      // 2) Fallback only if view is missing
      const fromAppUsers = await loadFromAppUsers();
      if (cancelled) return;

      setCustomers(fromAppUsers);
      setSource("fallback");
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase().trim();
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
      if (lastActivity && lastActivity >= oneDayAgo) acc.active += 1;

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
                  ? "customers_admin_view"
                  : "app_users (fallback)"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toast.message("Export coming soon")}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Export customers
            </button>
            <button
              type="button"
              onClick={() => toast.message("Campaigns coming soon")}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Send email campaign
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
            <p className="text-xs text-slate-500 mt-1">
              All accounts created on the platform.
            </p>
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
            <p className="text-xs text-slate-500 mt-1">
              Joined since the 1st of the month.
            </p>
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
            <p className="text-xs text-slate-500 mt-1">
              Users active in the last 24 hours.
            </p>
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
            <p className="text-xs text-slate-500 mt-1">
              Total money spent by users.
            </p>
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

                    return (
                      <TableRow
                        key={c.id}
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
                              <span className="text-[10px] text-slate-600">
                                {c.id}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-slate-300 font-medium">
                          {Number(c.credits_used || 0)}
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.generations || 0)}
                        </TableCell>

                        <TableCell className="text-slate-300">
                          {moneyEUR(spent)}
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {Number(c.orders_count || 0)}
                        </TableCell>

                        <TableCell className="text-slate-400 text-xs">
                          {joined ? joined.toLocaleDateString() : "—"}
                        </TableCell>

                        <TableCell className="text-slate-400 text-xs">
                          {last ? last.toLocaleString() : "—"}
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