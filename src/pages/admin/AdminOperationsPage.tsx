import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const checks = [
  {
    label: "Open support tickets",
    table: "support_tickets",
    path: "/admin/support-tickets",
    filter: (q: any) => q.neq("status", "closed"),
  },
  {
    label: "Christmas orders awaiting fulfillment",
    table: "christmas_orders",
    path: "/admin/christmas/orders",
    filter: (q: any) =>
      q.eq("payment_status", "paid").neq("fulfillment_status", "completed"),
  },
  {
    label: "Failed support emails",
    table: "support_admin_alerts",
    path: "/admin/support-tickets",
    filter: (q: any) => q.eq("status", "failed"),
  },
] as const;
export default function AdminOperationsPage() {
  const [results, setResults] = useState<
    Array<{ count: number | null; error: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await Promise.all(
        checks.map(async (check) => {
          try {
            const { count, error } = await check.filter(
              supabase
                .from(check.table)
                .select("id", { count: "exact", head: true }),
            );
            return {
              count: error ? null : count,
              error: error?.message || null,
            };
          } catch (e) {
            return {
              count: null,
              error: e instanceof Error ? e.message : "Source unavailable",
            };
          }
        }),
      );
      if (!cancelled) {
        setResults(data);
        setLoading(false);
        setUpdated(new Date().toLocaleString());
      }
    }
    setLoading(true);
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh]);
  return (
    <div className="p-4 text-slate-100 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Operations</h1>
        <button disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
      </div>
      <p className="my-3 text-slate-400">
        Start with sales, delivery and customer support. Unavailable sources are
        shown explicitly, never as zero.
      </p>
      <p className="text-xs text-slate-400">
        {loading
          ? "Checking sources…"
          : `Checked ${updated} · refreshes every 30 seconds`}
      </p>
      <div className="my-6 grid gap-4 md:grid-cols-3">
        {checks.map((c, i) => (
          <Link
            key={c.table}
            to={c.path}
            className="rounded-xl border border-slate-700 p-5"
          >
            <h2>{c.label}</h2>
            <p className="my-2 text-3xl">
              {loading ? "…" : (results[i]?.count ?? "Unavailable")}
            </p>
            {results[i]?.error && (
              <p role="alert" className="text-sm text-amber-200">
                {results[i].error}
              </p>
            )}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            "Santa Call funnel & health",
            "/admin/christmas/santa-call",
            "GA4 traffic and funnel events, confirmed payments, calls and integration status. Commercial Romania reporting.",
          ],
          [
            "Customers",
            "/admin/customers",
            "Registered accounts and guest buyers across Christmas, Pet and credit orders. Amounts separated by currency.",
          ],
          [
            "Support inbox",
            "/admin/support-tickets",
            "Client conversations, replies, ticket status and admin email delivery failures.",
          ],
          [
            "Christmas orders & delivery",
            "/admin/christmas/orders",
            "Payment status, fulfillment failures and delivery actions.",
          ],
          [
            "Pet funnel",
            "/admin/pet-funnel-analytics",
            "Dedicated Pet traffic and conversion reporting.",
          ],
          [
            "Pet orders",
            "/admin/pet-orders",
            "Generation jobs, quality checks and delivery.",
          ],
        ].map(([title, path, text]) => (
          <Link
            key={path}
            to={path}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
          >
            <h2 className="font-semibold">{title} →</h2>
            <p className="mt-2 text-sm text-slate-400">{text}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-400">
        Historical credit-pack reporting remains available under{" "}
        <Link to="/admin/legacy-overview" className="underline">
          Legacy credit overview
        </Link>
        . It does not include Christmas or Pet sales.
      </p>
    </div>
  );
}
