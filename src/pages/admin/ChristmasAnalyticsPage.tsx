import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RangeDays = 1 | 7 | 30 | 0;
type Platform = "all" | "web" | "ios";

type EventRow = {
  id: string;
  event_name: string;
  funnel_session_id: string;
  product_key: string | null;
  package_key: string | null;
  order_id: string | null;
  locale: string | null;
  pathname: string | null;
  device_type: string | null;
  amount_cents: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  is_test: boolean;
  environment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  product_key: string;
  package_key: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  last_error: string | null;
  source_route: string | null;
  landing_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  paid_at: string | null;
  delivery_email_sent_at: string | null;
};

type EmailRow = {
  id: string;
  order_id: string;
  kind: string;
  status: string;
  last_error?: string | null;
  created_at: string;
  sent_at?: string | null;
};

const VIEW_EVENTS = new Set([
  "christmas_page_view",
  "christmas_home_view",
  "christmas_landing_view",
  "christmas_photo_page_view",
  "christmas_santa_page_view",
  "christmas_family_page_view",
  "christmas_couple_page_view",
  "christmas_pet_page_view",
]);

function eventPlatform(row: EventRow): "web" | "ios" {
  const platform = String(row.metadata?.platform || "").toLowerCase();
  const source = String(row.metadata?.source || "").toLowerCase();
  return platform === "ios" || source === "tdg_app" || row.pathname?.startsWith("tdg_app://") || row.device_type === "ios"
    ? "ios"
    : "web";
}

function orderPlatform(row: OrderRow): "web" | "ios" {
  const platform = String(row.metadata?.platform || "").toLowerCase();
  const source = String(row.metadata?.source || "").toLowerCase();
  return platform === "ios" || source === "tdg_app" || row.source_route?.startsWith("tdg_app://") || row.landing_path?.startsWith("tdg_app://")
    ? "ios"
    : "web";
}

function isTestOrder(row: OrderRow): boolean {
  return row.amount_cents === 0 || row.metadata?.is_test === true || row.metadata?.test === true;
}

function moneyByCurrency(rows: OrderRow[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = (row.currency || "usd").toUpperCase();
    totals.set(currency, (totals.get(currency) || 0) + row.amount_cents);
  }
  if (!totals.size) return "—";
  return [...totals.entries()]
    .map(([currency, cents]) => {
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
      } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
      }
    })
    .join(" + ");
}

function pct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function ChristmasAnalyticsPage() {
  const [days, setDays] = useState<RangeDays>(7);
  const [platform, setPlatform] = useState<Platform>("all");
  const [product, setProduct] = useState("all");
  const [includeTests, setIncludeTests] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [legacyEmails, setLegacyEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

    let eventQuery = supabase
      .from("christmas_funnel_events")
      .select("id,event_name,funnel_session_id,product_key,package_key,order_id,locale,pathname,device_type,amount_cents,utm_source,utm_campaign,is_test,environment,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    let orderQuery = supabase
      .from("christmas_orders")
      .select("id,product_key,package_key,amount_cents,currency,payment_status,fulfillment_status,last_error,source_route,landing_path,metadata,created_at,paid_at,delivery_email_sent_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    let emailQuery = supabase
      .from("christmas_email_deliveries")
      .select("id,order_id,kind,status,last_error,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    let legacyEmailQuery = supabase
      .from("christmas_v2_email_deliveries")
      .select("id,order_id,kind,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (since) {
      eventQuery = eventQuery.gte("created_at", since);
      orderQuery = orderQuery.gte("created_at", since);
      emailQuery = emailQuery.gte("created_at", since);
      legacyEmailQuery = legacyEmailQuery.gte("created_at", since);
    }

    const [eventResult, orderResult, emailResult, legacyResult] = await Promise.all([
      eventQuery,
      orderQuery,
      emailQuery,
      legacyEmailQuery,
    ]);
    const critical = eventResult.error || orderResult.error;
    if (critical) {
      setError(critical.message);
    } else {
      setEvents((eventResult.data || []) as EventRow[]);
      setOrders((orderResult.data || []) as OrderRow[]);
      setEmails(emailResult.error ? [] : ((emailResult.data || []) as EmailRow[]));
      setLegacyEmails(legacyResult.error ? [] : ((legacyResult.data || []) as EmailRow[]));
      setLoadedAt(new Date());
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const products = useMemo(
    () => [...new Set([...events.map((row) => row.product_key), ...orders.map((row) => row.product_key)].filter(Boolean) as string[])].sort(),
    [events, orders],
  );

  const filteredEvents = useMemo(
    () => events.filter((row) =>
      (includeTests || !row.is_test) &&
      (platform === "all" || eventPlatform(row) === platform) &&
      (product === "all" || row.product_key === product),
    ),
    [events, includeTests, platform, product],
  );
  const filteredOrders = useMemo(
    () => orders.filter((row) =>
      (includeTests || !isTestOrder(row)) &&
      (platform === "all" || orderPlatform(row) === platform) &&
      (product === "all" || row.product_key === product),
    ),
    [orders, includeTests, platform, product],
  );

  const sessionCount = new Set(filteredEvents.map((row) => row.funnel_session_id)).size;
  const viewed = new Set(filteredEvents.filter((row) => VIEW_EVENTS.has(row.event_name) || row.event_name.endsWith("page_view")).map((row) => row.funnel_session_id)).size;
  const checkout = new Set(filteredEvents.filter((row) => row.event_name.includes("checkout")).map((row) => row.funnel_session_id)).size;
  const paid = filteredOrders.filter((row) => row.payment_status === "paid");
  const paidCommercial = paid.filter((row) => row.amount_cents > 0);
  const fulfillmentFailures = paid.filter((row) => row.fulfillment_status === "failed" || Boolean(row.last_error));
  const pending = filteredOrders.filter((row) => row.payment_status === "pending");
  const allEmails = [...emails, ...legacyEmails];
  const emailSent = allEmails.filter((row) => row.status === "sent").length;
  const emailFailed = allEmails.filter((row) => row.status === "failed").length;
  const latestEventAt = filteredEvents[0]?.created_at || null;

  const productRows = useMemo(() => {
    const keys = product === "all" ? products : [product];
    return keys.map((key) => {
      const productEvents = filteredEvents.filter((row) => row.product_key === key);
      const productOrders = filteredOrders.filter((row) => row.product_key === key);
      const sessions = new Set(productEvents.map((row) => row.funnel_session_id)).size;
      const checkouts = new Set(productEvents.filter((row) => row.event_name.includes("checkout")).map((row) => row.funnel_session_id)).size;
      const purchases = productOrders.filter((row) => row.payment_status === "paid" && row.amount_cents > 0);
      return { key, sessions, checkouts, purchases: purchases.length, revenue: moneyByCurrency(purchases) };
    }).filter((row) => row.sessions || row.checkouts || row.purchases);
  }, [filteredEvents, filteredOrders, product, products]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredEvents) {
      const key = [row.utm_source || "direct", row.utm_campaign || "(none)"].join(" / ");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredEvents]);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin · Christmas control center</p>
            <h1 className="mt-1 text-3xl font-semibold">Christmas Analytics & Health</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Web + iOS funnel, Stripe-confirmed orders, fulfillment failures and delivery-email health. Test/zero-value traffic is excluded by default.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as RangeDays)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={0}>All time</option>
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="all">Web + iOS</option><option value="web">Web only</option><option value="ios">iOS only</option>
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)} className="max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <option value="all">All Christmas products</option>{products.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2"><input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} /> Include test / zero-value</label>
        </div>

        {error ? <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tracked sessions" value={sessionCount} hint={`${viewed} reached a Christmas page`} />
          <Metric label="Checkout sessions" value={checkout} hint={`${pct(checkout, viewed)} from viewed`} />
          <Metric label="Paid orders" value={paidCommercial.length} hint={`${pct(paidCommercial.length, checkout)} from checkout sessions`} />
          <Metric label="Verified revenue" value={moneyByCurrency(paidCommercial)} hint="Stripe-paid, amount > 0" />
          <Metric label="Pending orders" value={pending.length} hint="Open or abandoned checkout" />
          <Metric label="Fulfillment failures" value={fulfillmentFailures.length} hint="Paid orders needing recovery" />
          <Metric label="Emails sent" value={emailSent} hint={`${emailFailed} failed · ${allEmails.length} ledger rows`} />
          <Metric label="Tracking freshness" value={latestEventAt ? new Date(latestEventAt).toLocaleString() : "No events"} hint={loadedAt ? `Refreshed ${loadedAt.toLocaleTimeString()}` : undefined} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-4"><h2 className="font-semibold">Funnel by product</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Product</th><th className="p-3">Sessions</th><th className="p-3">Checkout</th><th className="p-3">Paid</th><th className="p-3">Revenue</th></tr></thead><tbody>{productRows.map((row) => <tr key={row.key} className="border-t border-slate-800"><td className="p-3 font-mono text-xs">{row.key}</td><td className="p-3">{row.sessions}</td><td className="p-3">{row.checkouts}</td><td className="p-3">{row.purchases}</td><td className="p-3">{row.revenue}</td></tr>)}</tbody></table></div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="font-semibold">Source / campaign</h2>
            <div className="mt-4 space-y-2 text-sm">{sourceRows.length ? sourceRows.map(([label, count]) => <div key={label} className="flex justify-between gap-4"><span className="truncate text-slate-400">{label}</span><span>{count}</span></div>) : <p className="text-slate-500">No events in this view.</p>}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">Operational health</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className={`rounded-xl border p-3 ${fulfillmentFailures.length ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
              <p className="flex items-center gap-2 font-medium">{fulfillmentFailures.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Paid fulfillment</p>
              {fulfillmentFailures.slice(0, 6).map((row) => <p key={row.id} className="mt-2 break-words font-mono text-xs text-slate-300">{row.product_key} · {row.id.slice(0, 8)} · {row.last_error || row.fulfillment_status}</p>)}
              {!fulfillmentFailures.length ? <p className="mt-2 text-sm text-slate-400">No paid fulfillment failures in this view.</p> : null}
            </div>
            <div className={`rounded-xl border p-3 ${emailFailed ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
              <p className="flex items-center gap-2 font-medium">{emailFailed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Delivery email</p>
              {allEmails.filter((row) => row.status !== "sent").slice(0, 6).map((row) => <p key={row.id} className="mt-2 break-words font-mono text-xs text-slate-300">{row.kind} · {row.status} · {row.last_error || row.order_id.slice(0, 8)}</p>)}
              {!allEmails.length ? <p className="mt-2 text-sm text-amber-200">No delivery-email ledger rows yet; complete a controlled generation smoke test before launch.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
