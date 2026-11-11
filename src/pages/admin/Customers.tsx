import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { readAdminRows } from "@/domains/admin/data/readAdminRows";
import {
  mergeCustomers,
  formatCustomerMoney,
  csvCell,
  type Customer,
  type CustomerIdentity,
  type CustomerOrder,
} from "@/domains/admin/data/customers";

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [updated, setUpdated] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sources = [
      ["Accounts", "customers_admin_view_unified", "id,name,email,created_at"],
      [
        "Christmas",
        "christmas_orders",
        "id,email,user_id,created_at,currency,amount_cents,charged_amount_cents,payment_status,metadata,stripe_checkout_session_id",
      ],
      [
        "Pet",
        "pet_orders",
        "id,email,created_at,currency,amount_cents,charged_amount_cents,status,paid_at,stripe_checkout_session_id",
      ],
      [
        "Credits",
        "orders",
        "id,email,user_id,created_at,currency,amount,amount_total_cents,status",
      ],
    ];
    void Promise.allSettled(
      sources.map(([label, table, columns]) =>
        readAdminRows<CustomerIdentity & CustomerOrder>(
          () =>
            supabase
              .from(table)
              .select(columns, { count: "exact" })
              .order("id"),
          label,
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const errors = results.flatMap((r, i) =>
        r.status === "rejected"
          ? [
              `${sources[i][0]} unavailable: ${String(r.reason?.message || r.reason)}`,
            ]
          : [],
      );
      const identities =
        results[0].status === "fulfilled" ? results[0].value : [];
      const groups = results
        .slice(1)
        .flatMap((r, i) =>
          r.status === "fulfilled"
            ? [{ source: sources[i + 1][0], rows: r.value }]
            : [],
        );
      setRows(mergeCustomers(identities, groups));
      setWarnings(errors);
      setUpdated(new Date().toLocaleString());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          `${r.name} ${r.email} ${r.id}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (filter === "all" ||
            (filter === "paid" ? r.paidOrders > 0 : r.paidOrders === 0)),
      ),
    [rows, search, filter],
  );
  function exportRows() {
    const text = [
      [
        "id",
        "name",
        "email",
        "registered",
        "orders",
        "paid_orders",
        "paid_amounts_by_currency",
        "products",
      ],
      ...filtered.map((r) => [
        r.id,
        r.name,
        r.email,
        r.registered,
        r.orders,
        r.paidOrders,
        formatCustomerMoney(r.totals),
        r.products.join("; "),
      ]),
    ]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="p-4 text-slate-100 sm:p-8">
      <h1 className="text-2xl font-bold">Customers</h1>
      <p className="my-3 text-sm text-slate-400">
        Accounts and guest buyers, merged by email. Paid amounts are separated
        by currency; no assumed EUR conversion. Test checkouts are excluded
        where identifiable.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <input
          aria-label="Search customers"
          className="rounded border border-slate-700 bg-slate-900 p-2"
          placeholder="Name, email or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Customer status"
          className="rounded bg-slate-900 p-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All customers</option>
          <option value="paid">Paid customers</option>
          <option value="lead">No confirmed payment</option>
        </select>
        <button disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
        <button disabled={loading || warnings.length > 0} onClick={exportRows}>
          Export CSV
        </button>
      </div>
      {warnings.length > 0 && (
        <div
          role="alert"
          className="my-4 rounded border border-amber-600 p-4 text-amber-200"
        >
          <strong>
            Incomplete customer data. Counts below cover available sources only;
            export is disabled.
          </strong>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      {loading ? (
        <p role="status">Loading customers…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-400">
            {filtered.length} customers ·{" "}
            {rows.filter((r) => r.paidOrders > 0).length} with confirmed payment
            · Checked {updated}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Customer",
                    "Type",
                    "Orders / paid",
                    "Paid amounts",
                    "Products",
                    "Last activity",
                  ].map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.email || r.id}
                    className="border-t border-slate-800"
                  >
                    <td className="p-3">
                      <div>{r.name || r.email || r.id}</div>
                      <div className="text-slate-400">
                        {r.name ? r.email : ""}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.registered ? "Account" : "Guest"}
                    </td>
                    <td className="p-3">
                      {r.orders} / {r.paidOrders}
                    </td>
                    <td className="p-3">{formatCustomerMoney(r.totals)}</td>
                    <td className="p-3">
                      {r.products.map((p) => (
                        <Link
                          className="mr-3 underline"
                          key={p}
                          to={
                            p === "Christmas"
                              ? "/admin/christmas/orders"
                              : p === "Pet"
                                ? "/admin/pet-orders"
                                : "/admin/orders"
                          }
                        >
                          {p}
                        </Link>
                      ))}
                    </td>
                    <td className="p-3">
                      {r.lastActivity
                        ? new Date(r.lastActivity).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="p-6">
                      {warnings.length
                        ? "No customers in the available data. Resolve source errors before drawing conclusions."
                        : "No matching customers."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
