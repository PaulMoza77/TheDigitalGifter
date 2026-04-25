// FILE: src/pages/admin/AdminDashboard.tsx
import React from "react";
import { CalendarDays, RefreshCcw } from "lucide-react";

import { useAdminOverview } from "@/hooks/useAdminOverview";
import {
  ListCard,
  MoneyMiniCard,
  SectionCard,
  StatCard,
} from "@/components/admin/overview/AdminOverviewCards";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return `€${value.toFixed(2)}`;
}

function getDefaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function getDefaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [from, setFrom] = React.useState(getDefaultFrom);
  const [to, setTo] = React.useState(getDefaultTo);

  const range = React.useMemo(() => ({ from, to }), [from, to]);

  const {
    loading,
    error,
    totals,
    subscriptions,
    bundleOffers,
    creditsBought,
    topRegions,
    topCategories,
    topTemplates,
    customerBehaviour,
    refresh,
  } = useAdminOverview(range);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Admin Panel
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">
              Overview
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Business overview for customers, orders, generations, subscriptions,
              bundles, credits and template performance.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />

              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="bg-transparent text-sm text-slate-100 outline-none"
              />

              <span className="text-slate-600">—</span>

              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="bg-transparent text-sm text-slate-100 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total generated" value={loading ? "..." : formatNumber(totals.totalGenerated)} helper="Generated results" />
          <StatCard label="Customers" value={loading ? "..." : formatNumber(totals.customers)} helper="Total customer records" />
          <StatCard label="Orders" value={loading ? "..." : formatNumber(totals.orders)} helper={loading ? "..." : formatMoney(totals.totalRevenue)} />
          <StatCard label="Generations" value={loading ? "..." : formatNumber(totals.generations)} helper="All generations" />
          <StatCard label="Credits in circulation" value={loading ? "..." : formatNumber(totals.creditsInCirculation)} helper="Available customer credits" />
          <StatCard label="Credits used" value={loading ? "..." : formatNumber(totals.creditsUsed)} helper="Spent credits" />
          <StatCard label="Revenue" value={loading ? "..." : formatMoney(totals.totalRevenue)} helper="Selected period" />
          <StatCard
            label="Average order value"
            value={
              loading
                ? "..."
                : totals.orders > 0
                  ? formatMoney(totals.totalRevenue / totals.orders)
                  : "€0.00"
            }
            helper="Revenue / orders"
          />
        </section>

        <div className="mb-6 grid gap-5 xl:grid-cols-2">
          <SectionCard title="Subscriptions" subtitle="Starter, Pro and Elite subscription revenue.">
            <div className="grid gap-3 sm:grid-cols-3">
              {subscriptions.map((item) => (
                <MoneyMiniCard key={item.label} label={item.label} count={item.value} revenue={item.revenue} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Bundle offers" subtitle="One-time bundle purchases.">
            <div className="grid gap-3 sm:grid-cols-2">
              {bundleOffers.map((item) => (
                <MoneyMiniCard key={item.label} label={item.label} count={item.value} revenue={item.revenue} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Credits bought separately" subtitle="Revenue from direct credit purchases.">
            <div className="grid gap-3 sm:grid-cols-2">
              {creditsBought.map((item) => (
                <MoneyMiniCard key={item.label} label={item.label} count={item.value} revenue={item.revenue} />
              ))}
            </div>
          </SectionCard>

          <ListCard title="Customer behaviour" subtitle="New, returning and credits usage." items={customerBehaviour} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ListCard title="Top regions by revenue" subtitle="Requires country/region tracking for real segmentation." items={topRegions} />
          <ListCard title="Top performing categories" subtitle="Calculated from generation occasion_slug." items={topCategories} />
          <ListCard title="Most purchased templates" subtitle="Calculated from generation title/template title." items={topTemplates} />
        </div>
      </div>
    </div>
  );
}