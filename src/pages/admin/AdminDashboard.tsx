import React from "react";

const AdminDashboard: React.FC = () => {
  return (
    <div className="bg-slate-950 px-8 py-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Admin Panel
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Full funnel overview: visitors, customers, categories, templates
              and regions.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
              Last 30 days
            </button>
            <button className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
              Filters
            </button>
            <button className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-400">
              Export report
            </button>
          </div>
        </header>

        {/* KPI row */}
        <section className="grid gap-4 md:grid-cols-4 mb-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
            <p className="text-xs text-slate-400">Total visitors</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">18,420</p>
            <p className="mt-1 text-xs text-emerald-400">+32% vs last month</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
            <p className="text-xs text-slate-400">Unique visitors</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">14,980</p>
            <p className="mt-1 text-xs text-slate-400">81% of all sessions</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
            <p className="text-xs text-slate-400">Paying customers</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">1,245</p>
            <p className="mt-1 text-xs text-slate-400">
              7.2% visitor → customer
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
            <p className="text-xs text-slate-400">Total revenue</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">€6,980</p>
            <p className="mt-1 text-xs text-slate-400">
              Avg. order value €13.40
            </p>
          </div>
        </section>

        {/* Funnel & behaviour */}
        <section className="grid gap-4 md:grid-cols-3 mb-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              Visitor → Purchase funnel
            </h2>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center justify-between">
                <span>Visited site</span>
                <span>18,420</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Generated at least 1 template</span>
                <span>6,120 (33%)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Added credits to cart</span>
                <span>1,980 (11%)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Completed purchase</span>
                <span>1,245 (7.2%)</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              Top performing categories
            </h2>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-emerald-400">
              #1 Most purchased: Christmas
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>Christmas</span>
                <span>41% of all orders</span>
              </li>
              <li className="flex justify-between">
                <span>Birthdays</span>
                <span>27%</span>
              </li>
              <li className="flex justify-between">
                <span>Couples & Anniversary</span>
                <span>14%</span>
              </li>
              <li className="flex justify-between">
                <span>Other categories</span>
                <span>18%</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              Most purchased templates
            </h2>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-emerald-400">
              #1 Template: "Family Snow Globe"
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>Family Snow Globe (Christmas)</span>
                <span>1,320 orders</span>
              </li>
              <li className="flex justify-between">
                <span>Neon Party Frame (Birthday)</span>
                <span>890 orders</span>
              </li>
              <li className="flex justify-between">
                <span>Cozy Fireplace Portrait (Christmas)</span>
                <span>640 orders</span>
              </li>
              <li className="flex justify-between">
                <span>Other templates</span>
                <span>2,170 orders</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Regions & customers */}
        <section className="grid gap-4 md:grid-cols-2 mb-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              Top regions by revenue
            </h2>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>United States</span>
                <span>€2,250 · 32%</span>
              </li>
              <li className="flex justify-between">
                <span>United Kingdom</span>
                <span>€1,220 · 18%</span>
              </li>
              <li className="flex justify-between">
                <span>Germany</span>
                <span>€840 · 12%</span>
              </li>
              <li className="flex justify-between">
                <span>Romania</span>
                <span>€630 · 9%</span>
              </li>
              <li className="flex justify-between">
                <span>Other countries</span>
                <span>€2,040 · 29%</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              Customer behaviour
            </h2>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>New vs returning customers</span>
                <span>62% new · 38% returning</span>
              </li>
              <li className="flex justify-between">
                <span>Average templates generated per customer</span>
                <span>7.4</span>
              </li>
              <li className="flex justify-between">
                <span>Average credits used per order</span>
                <span>46</span>
              </li>
              <li className="flex justify-between">
                <span>Customers with 3+ orders</span>
                <span>184 (15%)</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Quick highlights */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Best day of the week
            </h2>
            <p className="text-xs text-slate-400 mb-1">By revenue</p>
            <p className="text-base font-semibold text-slate-50">Sunday</p>
            <p className="text-xs text-slate-400">
              19% of weekly sales happen on Sunday.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Device split
            </h2>
            <ul className="mt-1 space-y-1 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>Mobile</span>
                <span>72%</span>
              </li>
              <li className="flex justify-between">
                <span>Desktop</span>
                <span>23%</span>
              </li>
              <li className="flex justify-between">
                <span>Tablet</span>
                <span>5%</span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Email capture performance
            </h2>
            <ul className="mt-1 space-y-1 text-xs text-slate-300">
              <li className="flex justify-between">
                <span>Popup views</span>
                <span>8,540</span>
              </li>
              <li className="flex justify-between">
                <span>Emails collected</span>
                <span>1,430 (16.7%)</span>
              </li>
              <li className="flex justify-between">
                <span>Revenue from email campaigns</span>
                <span>€1,120</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
