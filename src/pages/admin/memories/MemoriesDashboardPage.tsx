import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatCard, SectionCard } from "@/components/admin/overview/AdminOverviewCards";
import { MEMORIES_PLANS } from "@/features/memories/config";

type FunnelEvent = {
  event_name: string;
  funnel_session_id: string;
  amount_cents: number | null;
  product: string | null;
  utm_campaign: string | null;
  is_test: boolean | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  email: string;
  plan_key: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_status: string;
  commercial_mode: string;
  is_test: boolean;
  is_live_charge: boolean;
  paid_at: string | null;
  refunded_at: string | null;
  canceled_at: string | null;
  utm_campaign: string | null;
  created_at: string;
};

type SubRow = {
  id: string;
  status: string;
  amount_cents: number;
  is_test: boolean;
  is_live_charge: boolean;
  cancel_at_period_end: boolean;
};

type Milestone = {
  milestone_key: string;
  verified_at: string;
  order_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  plan_key: string | null;
};

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default function MemoriesDashboardPage() {
  const [days, setDays] = useState(30);
  const [includeTests, setIncludeTests] = useState(false);
  const [campaign, setCampaign] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const [ev, ord, sub, mile] = await Promise.all([
        supabase
          .from("memories_funnel_events")
          .select(
            "event_name,funnel_session_id,amount_cents,product,utm_campaign,is_test,created_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("memories_orders")
          .select(
            "id,email,plan_key,amount_cents,currency,status,payment_status,commercial_mode,is_test,is_live_charge,paid_at,refunded_at,canceled_at,utm_campaign,created_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("memories_subscriptions")
          .select("id,status,amount_cents,is_test,is_live_charge,cancel_at_period_end")
          .limit(2000),
        supabase
          .from("memories_milestones")
          .select("milestone_key,verified_at,order_id,amount_cents,currency,plan_key")
          .eq("milestone_key", "MEMORIES_FIRST_SALE_VERIFIED")
          .maybeSingle(),
      ]);
      if (ev.error) throw ev.error;
      if (ord.error) throw ord.error;
      if (sub.error) throw sub.error;
      setEvents((ev.data || []) as FunnelEvent[]);
      setOrders((ord.data || []) as OrderRow[]);
      setSubs((sub.data || []) as SubRow[]);
      setMilestone((mile.data as Milestone | null) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Memories admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    for (const row of events) if (row.utm_campaign) set.add(row.utm_campaign);
    for (const row of orders) if (row.utm_campaign) set.add(row.utm_campaign);
    return ["all", ...Array.from(set).sort()];
  }, [events, orders]);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (row) =>
          (includeTests || !row.is_test) &&
          (campaign === "all" || row.utm_campaign === campaign),
      ),
    [events, includeTests, campaign],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (row) =>
          (includeTests || (!row.is_test && row.is_live_charge)) &&
          (campaign === "all" || row.utm_campaign === campaign),
      ),
    [orders, includeTests, campaign],
  );

  const countEvent = (name: string) =>
    new Set(filteredEvents.filter((e) => e.event_name === name).map((e) => e.funnel_session_id))
      .size;

  const landing = countEvent("memories_page_view");
  const cta = countEvent("memories_hero_cta");
  const uploadStart = countEvent("memories_upload_started");
  const uploadDone = countEvent("memories_upload_completed");
  const emails = countEvent("memories_email_submitted");
  const planViews = countEvent("memories_plan_viewed");
  const planSelect = countEvent("memories_plan_selected");
  const checkoutStarts = countEvent("memories_checkout_started");
  const paidVerified = countEvent("memories_payment_verified");
  const cancellations = countEvent("memories_subscription_cancelled");

  const paidOrders = filteredOrders.filter(
    (o) => o.payment_status === "paid" && o.paid_at && o.amount_cents > 0,
  );
  const revenue = paidOrders.reduce((sum, o) => sum + o.amount_cents, 0);
  const refunds = filteredOrders.filter((o) => o.payment_status === "refunded" || o.refunded_at);
  const failed = filteredOrders.filter((o) => o.payment_status === "failed" || o.status === "failed");

  const eligibleSubs = subs.filter(
    (s) =>
      s.status === "active" &&
      s.amount_cents > 0 &&
      (includeTests || (s.is_live_charge && !s.is_test)),
  );
  const mrr = eligibleSubs.reduce((sum, s) => sum + s.amount_cents, 0);

  function exportCsv() {
    const header = [
      "id",
      "email",
      "plan_key",
      "amount_cents",
      "status",
      "payment_status",
      "is_live_charge",
      "utm_campaign",
      "created_at",
    ];
    const lines = [
      header.join(","),
      ...filteredOrders.map((o) =>
        [
          o.id,
          o.email,
          o.plan_key,
          o.amount_cents,
          o.status,
          o.payment_status,
          o.is_live_charge,
          o.utm_campaign || "",
          o.created_at,
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memories-orders-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
        <select
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {campaigns.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All campaigns" : c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeTests}
            onChange={(e) => setIncludeTests(e.target.checked)}
          />
          Include test
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Export orders CSV
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {milestone ? (
        <SectionCard title="First verified sale">
          <p className="text-sm text-emerald-700">
            MEMORIES_FIRST_SALE_VERIFIED at {new Date(milestone.verified_at).toLocaleString()} ·{" "}
            {milestone.plan_key} ·{" "}
            {money(milestone.amount_cents || 0, milestone.currency || "usd")} · order{" "}
            {milestone.order_id}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Milestone triggers founder review only — do not auto-start AI product development.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title="First verified sale">
          <p className="text-sm text-slate-500">No live verified sale yet.</p>
        </SectionCard>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Landing visitors" value={String(landing)} />
        <StatCard label="CTA clicks" value={String(cta)} helper={pct(cta, landing)} />
        <StatCard label="Upload starts" value={String(uploadStart)} />
        <StatCard label="Upload completions" value={String(uploadDone)} helper={pct(uploadDone, uploadStart)} />
        <StatCard label="Email captures" value={String(emails)} />
        <StatCard label="Plan views" value={String(planViews)} />
        <StatCard label="Plan selections" value={String(planSelect)} />
        <StatCard label="Checkout starts" value={String(checkoutStarts)} />
        <StatCard label="Paid subscriptions" value={String(paidOrders.length)} helper={`events ${paidVerified}`} />
        <StatCard label="Revenue collected" value={money(revenue)} helper="Live paid only unless tests included" />
        <StatCard label="MRR (active paid)" value={money(mrr)} helper="Active live subscriptions" />
        <StatCard label="Cancellations" value={String(cancellations)} />
        <StatCard label="Failed payments" value={String(failed.length)} />
        <StatCard label="Refunds" value={String(refunds.length)} />
        <StatCard
          label="Landing → paid"
          value={pct(paidOrders.length, landing)}
        />
        <StatCard label="Plans" value={String(Object.keys(MEMORIES_PLANS).length)} helper="Centralized config" />
      </div>

      <SectionCard title="Customers / orders">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Payment</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Campaign</th>
                <th className="px-2 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 50).map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{o.email}</td>
                  <td className="px-2 py-2">{o.plan_key}</td>
                  <td className="px-2 py-2">{o.status}</td>
                  <td className="px-2 py-2">{o.payment_status}</td>
                  <td className="px-2 py-2">{money(o.amount_cents, o.currency)}</td>
                  <td className="px-2 py-2">{o.utm_campaign || "—"}</td>
                  <td className="px-2 py-2">{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!filteredOrders.length ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-slate-500">
                    No orders in range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Funnel event timeline (latest 40)">
        <ul className="space-y-2 text-sm">
          {filteredEvents.slice(0, 40).map((e, idx) => (
            <li key={`${e.funnel_session_id}-${e.event_name}-${idx}`} className="flex flex-wrap gap-2">
              <span className="font-mono text-xs text-slate-500">
                {new Date(e.created_at).toLocaleString()}
              </span>
              <span className="font-medium">{e.event_name}</span>
              <span className="text-slate-500">{e.product || ""}</span>
            </li>
          ))}
          {!filteredEvents.length ? <li className="text-slate-500">No events yet.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
