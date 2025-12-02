import React, { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const customers = useQuery(api.users.listAdmin);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchQuery) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.userId.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!customers)
      return { total: 0, newThisMonth: 0, active: 0, totalRevenue: 0 };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return customers.reduce(
      (acc, curr) => {
        acc.total++;
        if (curr.createdAt && curr.createdAt >= startOfMonth.getTime()) {
          acc.newThisMonth++;
        }
        if (curr.lastActivity && curr.lastActivity >= oneDayAgo.getTime()) {
          acc.active++;
        }
        acc.totalRevenue += curr.totalMoneySpent || 0;
        return acc;
      },
      { total: 0, newThisMonth: 0, active: 0, totalRevenue: 0 }
    );
  }, [customers]);

  if (customers === undefined) {
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
              View and manage all TheDigitalGifter customers, spending, and
              activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
              Export customers
            </button>
            <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
              Send email campaign
            </button>
          </div>
        </header>

        <section className="grid gap-4 grid-cols-1  sm:grid-cols-2 xl:grid-cols-4">
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
                €{stats.totalRevenue.toFixed(2)}
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
                  <TableHead className="text-slate-400">
                    Last Activity
                  </TableHead>
                  <TableHead className="text-slate-400 text-right">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-slate-500"
                    >
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer._id}
                      className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-slate-700">
                            <AvatarImage src={customer.image} />
                            <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                              {customer.name?.substring(0, 2).toUpperCase() ||
                                "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200 text-sm">
                              {customer.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {customer.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 font-medium">
                        {customer.creditsUsed}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {customer.generations}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        €{(customer.totalMoneySpent || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {customer.ordersCount}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {customer.createdAt
                          ? new Date(customer.createdAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs">
                        {customer.lastActivity
                          ? new Date(customer.lastActivity).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={`
                            ${
                              customer.totalMoneySpent > 0
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                : "border-slate-700 text-slate-400 bg-slate-800/50"
                            }
                          `}
                        >
                          {customer.totalMoneySpent > 0 ? "Customer" : "User"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
