import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsReport,
  Integration,
  Metric,
  AdminOrder,
} from "../../../../supabase/functions/_shared/christmas/santaAnalyticsModel";

type Tab =
  "overview" | "orders" | "calls" | "analytics" | "operations" | "settings";
const tabs: Array<[Tab, string]> = [
  ["overview", "Overview"],
  ["orders", "Orders"],
  ["calls", "Calls"],
  ["analytics", "Analytics"],
  ["operations", "Operations & Health"],
  ["settings", "Settings"],
];
const time = (v?: string | null) =>
  v
    ? new Intl.DateTimeFormat("ro-RO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Bucharest",
      }).format(new Date(v))
    : "Never received";
const short = (v?: string | null) => (v ? `${v.slice(0, 10)}…` : "—");
const money = (v: number, currency = "RON") =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency }).format(v);
const rangeLabel = (r: AnalyticsReport["range"]) =>
  `${r.start} → ${r.end} · Europe/Bucharest`;
const missingGa: Array<[string, string]> = [
  ["page_views", "Page views"],
  ["visitors", "Unique visitors"],
  ["sessions", "Sessions"],
  ["cta", "CTA clicks"],
  ["form_start", "Form started"],
  ["form_complete", "Form completed"],
  ["ga_checkout", "Checkout initiated (GA4)"],
];
function gaMetrics(source: Integration): Metric[] {
  return missingGa.map(
    ([id, label]) =>
      source.metrics.find((m) => m.id === id) || {
        id,
        label,
        value: null,
        unit: "count",
        source: source.source,
        definition: source.detail,
        unavailable: "No measurement for this interval",
        updatedAt: null,
      },
  );
}
const formatMetric = (m: Metric) =>
  m.value == null || !Number.isFinite(m.value)
    ? "Unavailable"
    : m.unit === "RON" || m.unit === "USD"
      ? money(m.value, m.unit)
      : m.unit === "percent"
        ? `${m.value.toFixed(1)}%`
        : new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(
            m.value,
          );

export default function SantaCallAdminPage() {
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() =>
      new URLSearchParams(window.location.search).get("tab") === "analytics"
        ? "analytics"
        : "overview",
    ),
    [preset, setPreset] = useState("7");
  const [custom, setCustom] = useState({ start: "", end: "" }),
    [applied, setApplied] = useState({ start: "", end: "" });
  const [refresh, setRefresh] = useState(0),
    [orderPage, setOrderPage] = useState(1),
    [callPage, setCallPage] = useState(1);
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<AdminOrder | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (preset === "custom" && (!applied.start || !applied.end)) {
      setLoading(false);
      setError(null);
      setData(null);
      return () => controller.abort();
    }
    setLoading(true);
    setError(null);
    setData(null);
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) throw new Error("Admin sign-in required");
        const response = await fetch(
          `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, "")}/functions/v1/christmas-santa-call`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || ""),
              Authorization: `Bearer ${auth.session.access_token}`,
            },
            body: JSON.stringify({
              action: "admin_dashboard",
              preset,
              ...applied,
              orderPage,
              callPage,
            }),
          },
        );
        const report = await response.json();
        if (!response.ok || report.ok !== true)
          throw new Error(report.error || `HTTP ${response.status}`);
        if (!controller.signal.aborted) setData(report);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Report unavailable");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [preset, applied, orderPage, callPage, refresh]);
  const allMetrics = useMemo(
    () => (data ? [...gaMetrics(data.integrations.ga4), ...data.metrics] : []),
    [data],
  );
  const byId = (id: string) => allMetrics.find((m) => m.id === id)!;
  const orders =
    data?.orders.filter(
      (o) =>
        !query ||
        [o.id, o.payment_status, o.product_key].some((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
    ) || [];
  const changeRange = (value: string) => {
    setOrderPage(1);
    setCallPage(1);
    setQuery("");
    setPreset(value);
  };
  return (
    <div className="min-h-full bg-[#f7f7f5] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-700">
              The Digital Gifter · Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Santa Call Romania
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Commercial RON reporting. No names, emails or personalization
              data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Reporting period"
              value={preset}
              onChange={(e) => changeRange(e.target.value)}
              className="h-10 rounded-lg border bg-white px-3 text-sm"
            >
              {[
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["7", "7 days"],
                ["30", "30 days"],
                ["90", "90 days"],
                ["custom", "Custom dates"],
              ].map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              onClick={() => setRefresh((n) => n + 1)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <nav
          aria-label="Santa admin sections"
          className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === id ? "bg-[#6f1521] text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {preset === "custom" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setOrderPage(1);
              setCallPage(1);
              setApplied({ ...custom });
            }}
            className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
          >
            <label className="text-xs">
              From
              <input
                required
                type="date"
                value={custom.start}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, start: e.target.value }))
                }
                className="mt-1 block rounded border p-2 text-sm"
              />
            </label>
            <label className="text-xs">
              Through
              <input
                required
                type="date"
                value={custom.end}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, end: e.target.value }))
                }
                className="mt-1 block rounded border p-2 text-sm"
              />
            </label>
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">
              Apply dates
            </button>
            <p className="text-xs text-neutral-500">
              Maximum 90 days. Today is a partial business day.
            </p>
          </form>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            Secure report unavailable: {error}. No partial totals are shown.
          </div>
        )}
        {loading && (
          <div
            role="status"
            className="py-12 text-center text-sm text-neutral-500"
          >
            Loading verified reporting sources…
          </div>
        )}
        {data && (
          <>
            <div className="mb-5 flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
              <span>{rangeLabel(data.range)}</span>
              <span>
                Server read {time(data.generatedAt)} · external sources have
                separate timestamps
              </span>
            </div>
            {tab === "overview" && (
              <>
                <Metrics
                  metrics={[
                    "revenue",
                    "purchases",
                    "calls_completed",
                    "calls_started",
                    "calls_failed",
                    "conversion",
                  ].map(byId)}
                  range={data.range}
                />
                <Trend data={data} />
              </>
            )}
            {tab === "analytics" && (
              <div className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-3">
                  {Object.entries(data.integrations).map(([id, s]) => (
                    <SourceCard key={id} integration={s} />
                  ))}
                </div>
                <div>
                  <h2 className="mb-3 text-lg font-semibold">
                    Acquisition & conversion
                  </h2>
                  <Metrics
                    metrics={allMetrics.filter(
                      (m) => !m.id.startsWith("calls_"),
                    )}
                    range={data.range}
                  />
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Funnel metrics={allMetrics} range={data.range} />
                  <Panel title="Checkout outcomes">
                    <p className="mt-2 text-sm text-neutral-500">
                      Same initial checkout cohort, created in this period.
                      Outcomes observed at {time(data.generatedAt)}.
                    </p>
                    <Bars
                      rows={[
                        { label: "Confirmed paid", value: data.dropoff.paid },
                        {
                          label: "Unpaid / pending",
                          value: data.dropoff.unpaid,
                        },
                      ]}
                    />
                    <p className="mt-4 text-xs text-neutral-500">
                      {data.dropoff.created} initial sessions. Pending is not
                      final abandonment. An unpaid session may still convert.
                    </p>
                  </Panel>
                </div>
                <Trend data={data} />
                <Traffic integration={data.integrations.ga4} />
                <div className="grid gap-5 lg:grid-cols-2">
                  <Panel title="Devices · GA4 sessions">
                    {data.integrations.ga4.devices ? (
                      <Bars
                        rows={data.integrations.ga4.devices.map((d) => ({
                          label: d.device,
                          value: d.sessions,
                        }))}
                      />
                    ) : (
                      <Empty text="Device data unavailable for this interval." />
                    )}
                    <p className="mt-3 text-xs text-neutral-500">
                      Source: GA4 · {rangeLabel(data.range)}
                    </p>
                  </Panel>
                  <Panel title="Call outcomes">
                    <Metrics
                      metrics={[
                        "calls_started",
                        "calls_completed",
                        "calls_failed",
                      ].map(byId)}
                      range={data.range}
                      compact
                    />
                    <p className="mt-3 text-xs text-neutral-500">
                      Operational sessions, not unique visitors. See Calls for
                      paginated error and interruption logs.
                    </p>
                  </Panel>
                </div>
                <Panel title="Meta Ads performance">
                  <p className="mb-4 mt-2 text-sm text-neutral-500">
                    Campaign 120255274308780066 · account act_1877103439548293.
                    Attributed purchases belong to Meta; payment revenue belongs
                    to the ledger. No campaign controls.
                  </p>
                  {data.integrations.meta.metrics.length ? (
                    <Metrics
                      metrics={data.integrations.meta.metrics}
                      range={data.range}
                    />
                  ) : (
                    <Empty
                      text={
                        data.integrations.meta.detail +
                        " Spend, impressions, reach, link clicks, landing views, CTR, CPC, attributed purchases, cost per purchase and ROAS remain unavailable."
                      }
                    />
                  )}
                </Panel>
              </div>
            )}
            {tab === "orders" && (
              <Panel title="Orders · created in selected period">
                <label className="my-3 flex max-w-sm items-center gap-2 rounded-lg border px-3">
                  <Search className="h-4 w-4 text-neutral-400" />
                  <input
                    aria-label="Filter current order page"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter this page by ID or status"
                    className="h-10 min-w-0 flex-1 text-sm outline-none"
                  />
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                      <tr>
                        {[
                          "Order",
                          "Date (Bucharest)",
                          "Product",
                          "Amount",
                          "Payment",
                          "",
                        ].map((h, i) => (
                          <th key={i} className="p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="p-3 font-mono text-xs">
                            {short(o.id)}
                          </td>
                          <td className="p-3">{time(o.created_at)}</td>
                          <td className="p-3">
                            {o.product_key.endsWith("extension")
                              ? "Extension +5m"
                              : "Initial 3m"}
                          </td>
                          <td className="p-3">{money(o.amount_cents / 100)}</td>
                          <td className="p-3">{o.payment_status}</td>
                          <td className="p-3">
                            <button
                              className="font-semibold text-[#6f1521]"
                              onClick={() => setSelected(o)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!orders.length && (
                  <Empty text="No matching commercial orders on this page." />
                )}
                <Pagination
                  page={orderPage}
                  total={data.pagination.orderTotal}
                  size={25}
                  change={setOrderPage}
                />
              </Panel>
            )}
            {tab === "calls" && (
              <Panel title="Call sessions · commercial RON orders">
                <div className="overflow-x-auto">
                  <table className="mt-4 w-full min-w-[740px] text-left text-sm">
                    <thead className="bg-neutral-50 text-xs text-neutral-500">
                      <tr>
                        {[
                          "Date",
                          "Session",
                          "Status",
                          "Seconds",
                          "Termination reason",
                          "Error code",
                        ].map((h) => (
                          <th key={h} className="p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.calls.map((c) => (
                        <tr key={c.id}>
                          <td className="p-3">{time(c.created_at)}</td>
                          <td className="p-3 font-mono text-xs">
                            {short(c.id)}
                          </td>
                          <td className="p-3">{c.status}</td>
                          <td className="p-3">{c.seconds_used ?? "—"}</td>
                          <td className="p-3">{c.end_reason || "—"}</td>
                          <td className="p-3">{c.error_code || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.calls.length && (
                  <Empty text="No commercial call sessions in this period." />
                )}
                <Pagination
                  page={callPage}
                  total={data.pagination.callTotal}
                  size={25}
                  change={setCallPage}
                />
              </Panel>
            )}
            {tab === "operations" && (
              <div className="space-y-5">
                <Panel title="Reporting health">
                  <p className="mt-3 text-sm">
                    Authenticated ledger read succeeded at{" "}
                    {time(data.generatedAt)}.
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    This is data-source health, not a synthetic payment or voice
                    probe. Queries are bounded; limits and database errors fail
                    closed instead of showing incomplete totals.
                  </p>
                  <p className="mt-3 text-sm">
                    Excluded records in selected activity window:{" "}
                    {data.exclusions.nonCommercialOrOtherCurrency} test,
                    noncommercial or non-RON orders. Unverified paid LIVE RON
                    rows: {data.exclusions.unverifiedPaid}.
                  </p>
                  <p className="mt-3 text-sm">
                    Selected commercial cohort:{" "}
                    {data.health.pendingEntitlements} pending entitlements ·{" "}
                    {data.health.staleSessions} stale sessions ·{" "}
                    {data.health.providerFailures} provider errors.
                  </p>
                </Panel>
                <div className="grid gap-3 lg:grid-cols-3">
                  {Object.entries(data.integrations).map(([id, s]) => (
                    <SourceCard key={id} integration={s} />
                  ))}
                </div>
              </div>
            )}
            {tab === "settings" && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Commercial reporting scope">
                  <p className="mt-3 text-sm">
                    Initial offer 59 RON / 180 seconds · extension 49 RON / +300
                    seconds.
                  </p>
                  <p className="mt-3 text-sm text-neutral-500">
                    Only LIVE RON Santa orders. GA4 property 550164226 ·
                    measurement G-YF2GRM2TL4. Meta account act_1877103439548293
                    · Pixel 1673980440653322. Clarity y3y98n4wks.
                  </p>
                </Panel>
                <Panel title="Definitions & privacy">
                  <p className="mt-3 text-sm text-neutral-500">
                    Bucharest calendar days, inclusive date labels and exclusive
                    next-midnight boundaries. Payment ledger is the revenue
                    authority. No children’s data, email, private access tokens
                    or call transcripts are included. External data refresh is
                    separately identified; no first-party visitor tracking store
                    was added.
                  </p>
                </Panel>
              </div>
            )}
          </>
        )}
      </main>
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/25"
          onClick={() => setSelected(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-auto bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              onClick={() => setSelected(null)}
              className="float-right rounded border px-3 py-1 text-sm"
            >
              Close
            </button>
            <h2 className="text-lg font-bold">Order details</h2>
            <dl className="mt-6 space-y-4 text-sm">
              {[
                ["Order", selected.id],
                ["Payment", selected.payment_status],
                ["Checkout", short(selected.stripe_checkout_session_id)],
                ["PaymentIntent", short(selected.stripe_payment_intent_id)],
                ["Entitlement", selected.entitlement?.status || "Not created"],
                [
                  "Remaining duration",
                  selected.entitlement
                    ? `${selected.entitlement.remaining_seconds} seconds`
                    : "—",
                ],
                [
                  "Access expiry",
                  selected.entitlement
                    ? time(selected.entitlement.expires_at)
                    : "—",
                ],
                [
                  "Call status",
                  selected.session?.status || "No session in range",
                ],
                ["Termination", selected.session?.end_reason || "—"],
                [
                  "Paid at",
                  selected.paid_at ? time(selected.paid_at) : "Not paid",
                ],
                [
                  "Amount actually charged",
                  selected.charged_amount_cents == null
                    ? "Unavailable"
                    : money(selected.charged_amount_cents / 100),
                ],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-neutral-500">{l}</dt>
                  <dd className="mt-1 break-all font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-8 text-sm leading-6 text-neutral-500">{text}</p>;
}
function Metrics({
  metrics,
  range,
  compact = false,
}: {
  metrics: Metric[];
  range: AnalyticsReport["range"];
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 ${compact ? "mt-3 sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}
    >
      {metrics.map((m) => (
        <article
          key={m.id}
          className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm text-neutral-600">{m.label}</p>
          <p
            className={`my-3 font-bold ${m.value == null ? "text-base text-neutral-400" : "text-2xl"}`}
          >
            {formatMetric(m)}
          </p>
          <p className="text-[11px] text-neutral-500">{m.source}</p>
          <details className="mt-2 text-xs leading-5 text-neutral-500">
            <summary className="cursor-pointer">Definition & freshness</summary>
            <p className="mt-2">{m.definition}</p>
            {m.unavailable && <p className="text-amber-800">{m.unavailable}</p>}
            <p>{rangeLabel(range)}</p>
            <p>Updated: {time(m.updatedAt)}</p>
          </details>
        </article>
      ))}
    </div>
  );
}
function SourceCard({ integration: s }: { integration: Integration }) {
  const stale = Boolean(
    s.updatedAt && Date.now() - Date.parse(s.updatedAt) > 86400000,
  );
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{s.source}</h3>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${s.status === "connected" && !stale ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
        >
          {stale ? "STALE" : s.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">{s.detail}</p>
      <p className="mt-2 text-[11px] text-neutral-400">
        Updated: {time(s.updatedAt)}
      </p>
    </div>
  );
}
function Pagination({
  page,
  total,
  size,
  change,
}: {
  page: number;
  total: number;
  size: number;
  change: (p: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-neutral-500">
      <span>
        {total} records · page {page} / {Math.max(1, Math.ceil(total / size))}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => change(page - 1)}
          className="rounded border px-3 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={page * size >= total}
          onClick={() => change(page + 1)}
          className="rounded border px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
function Bars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mt-4 space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <b>{r.value}</b>
          </div>
          <div className="mt-1 h-2 rounded bg-neutral-100">
            <div
              className="h-2 rounded bg-[#6f1521]"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {!rows.length && <Empty text="No rows received." />}
    </div>
  );
}
function Funnel({
  metrics,
  range,
}: {
  metrics: Metric[];
  range: AnalyticsReport["range"];
}) {
  const ids = [
    "page_views",
    "cta",
    "form_start",
    "form_complete",
    "ga_checkout",
    "purchases",
    "calls_started",
    "calls_completed",
  ];
  const [active, setActive] = useState("page_views");
  const selected = metrics.find((m) => m.id === active);
  return (
    <Panel title="Conversion funnel · distinct sources">
      <p className="mt-2 text-xs leading-5 text-neutral-500">
        These stages are not a linked user cohort. No step-to-step conversion
        percentages are inferred.
      </p>
      <div className="mt-4 space-y-1">
        {ids.map((id, i) => {
          const m = metrics.find((m) => m.id === id)!;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left ${active === id ? "bg-[#6f1521] text-white" : "bg-neutral-50"}`}
            >
              <span>
                <span className="mr-2 opacity-50">{i + 1}</span>
                <span className="text-sm">{m.label}</span>
                <small className="ml-5 block text-[10px] opacity-70">
                  {m.source}
                </small>
              </span>
              <strong className="text-sm">{formatMetric(m)}</strong>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-neutral-500">
        {selected?.definition} {rangeLabel(range)}
      </p>
    </Panel>
  );
}
function Trend({ data }: { data: AnalyticsReport }) {
  const [series, setSeries] = useState("checkouts");
  const rows =
    series === "views"
      ? data.integrations.ga4.daily?.map((d) => ({
          date: d.date,
          value: d.value,
        }))
      : data.daily.map((d) => ({
          date: d.date,
          value: d[series as "checkouts" | "purchases" | "revenue"],
        }));
  const max = Math.max(1, ...(rows || []).map((d) => Number(d.value) || 0));
  return (
    <Panel title="Daily trend">
      <div className="my-3 flex flex-wrap gap-2">
        {[
          ["checkouts", "Stripe sessions"],
          ["purchases", "Paid initial orders"],
          ["revenue", "Gross RON"],
          ["views", "GA4 page views"],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-pressed={series === v}
            onClick={() => setSeries(v)}
            className={`rounded-lg border px-3 py-2 text-xs ${series === v ? "bg-neutral-900 text-white" : "text-neutral-600"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {rows?.length ? (
        <>
          <p className="text-xs text-neutral-400">
            {series === "revenue" ? "RON" : "Count"} · scale 0–{max}
          </p>
          <div
            className="mt-2 flex h-44 items-end gap-1 border-b border-neutral-200"
            aria-label={`Daily ${series} chart`}
          >
            {rows.map((r) => (
              <div
                key={r.date}
                className="group relative flex h-full min-w-0 flex-1 items-end"
              >
                <div
                  tabIndex={0}
                  aria-label={`${r.date}: ${r.value ?? "unavailable"}`}
                  title={`${r.date}: ${r.value ?? "unavailable"}`}
                  className="w-full rounded-t bg-amber-400 focus:bg-[#6f1521]"
                  style={{ height: `${(Number(r.value || 0) / max) * 100}%` }}
                />
                <span className="pointer-events-none absolute bottom-4 left-0 z-10 hidden whitespace-nowrap rounded bg-neutral-900 p-2 text-xs text-white group-hover:block group-focus-within:block">
                  {r.date}: {r.value ?? "unavailable"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
            <span>{data.range.start}</span>
            <span>Date · Europe/Bucharest</span>
            <span>{data.range.end}</span>
          </div>
          <details className="mt-3 text-xs text-neutral-500">
            <summary className="cursor-pointer">Exact daily values</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-3">
              {rows.map((r) => (
                <li key={r.date}>
                  {r.date}: {r.value ?? "Unavailable"}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <Empty text="This source has no daily series for the selected period." />
      )}
      <p className="mt-3 text-xs text-neutral-400">
        {series === "views" ? "GA4" : "Payment ledger · LIVE RON"} ·{" "}
        {series === "views"
          ? time(data.integrations.ga4.updatedAt)
          : time(data.generatedAt)}
      </p>
    </Panel>
  );
}
function Traffic({ integration }: { integration: Integration }) {
  const [group, setGroup] = useState("All");
  const rows = integration.traffic?.filter(
    (r) => group === "All" || r.group === group,
  );
  return (
    <Panel title="Traffic sources & campaign attribution">
      <p className="mb-3 mt-2 text-xs leading-5 text-neutral-500">
        GA4 session dimensions; query parameters excluded from the landing path.
        Campaign values remain separate. Visitors and session breakdowns may
        overlap or use GA4 estimation and must not be summed into the headline
        total. Purchases here are GA4-attributed events.
      </p>
      <label className="text-xs">
        Traffic group{" "}
        <select
          aria-label="Traffic group"
          className="ml-2 rounded border p-2"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          {[
            "All",
            "Facebook / Instagram",
            "Google organic",
            "Direct",
            "Other / referral",
          ].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      {rows ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  {[
                    "Source / medium",
                    "Campaign",
                    "Visitors",
                    "Sessions",
                    "Checkouts",
                    "GA4 purchases",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="p-3">
                      {r.source} / {r.medium}
                      <small className="block text-neutral-400">
                        {r.group}
                      </small>
                    </td>
                    <td className="max-w-xs break-all p-3">{r.campaign}</td>
                    <td className="p-3">{r.visitors}</td>
                    <td className="p-3">{r.sessions}</td>
                    <td className="p-3">{r.checkouts}</td>
                    <td className="p-3">{r.purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <Empty text="No received rows for this traffic group." />
          )}
        </>
      ) : (
        <Empty text="Attribution data unavailable for this interval. No server revenue is assigned to a traffic source without a verified link." />
      )}
    </Panel>
  );
}
