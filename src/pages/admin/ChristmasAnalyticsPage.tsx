import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Filter,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Timer,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  CHRISTMAS_FUNNELS,
  emailsCollectedInFunnel,
  eventMatchesFunnel,
  funnelById,
  funnelDropoff,
} from "./christmas/christmasFunnelDefs";
import {
  VIEW_EVENTS,
  eventPlatform,
  isTestOrder,
  moneyByCurrency,
  orderPlatform,
  pct,
  type Platform,
  type RangeDays,
} from "./christmas/christmasAdminTypes";
import { useChristmasAdminData } from "./christmas/useChristmasAdminData";

function Metric({
  label,
  value,
  hint,
  icon,
  highlighted = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`min-h-[158px] rounded-2xl border border-neutral-200 p-5 shadow-sm ${highlighted ? "bg-[#fffaf0]" : "bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
          {label}
        </p>
        {icon ? (
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${highlighted ? "bg-[#f6ead0] text-[#9a6b16]" : "bg-neutral-100 text-neutral-500"}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-neutral-900">
        {value}
      </p>
      <p className="mt-3 text-sm text-neutral-500">{hint}</p>
    </div>
  );
}

export default function ChristmasAnalyticsPage() {
  const [days, setDays] = useState<RangeDays>(7);
  const [platform, setPlatform] = useState<Platform>("all");
  const [funnelId, setFunnelId] = useState("all");
  const [includeTests, setIncludeTests] = useState(false);
  const [detailTab, setDetailTab] = useState<"pages" | "products" | "sources">(
    "pages",
  );
  const data = useChristmasAdminData(days);
  const selectedFunnel = funnelId === "all" ? null : funnelById(funnelId);

  const filteredEvents = useMemo(
    () =>
      data.events.filter((row) => {
        if (!includeTests && row.is_test) return false;
        if (platform !== "all" && eventPlatform(row) !== platform) return false;
        if (selectedFunnel && !eventMatchesFunnel(row, selectedFunnel))
          return false;
        return true;
      }),
    [data.events, includeTests, platform, selectedFunnel],
  );
  const filteredOrders = useMemo(
    () =>
      data.orders.filter((row) => {
        if (!includeTests && isTestOrder(row)) return false;
        if (platform !== "all" && orderPlatform(row) !== platform) return false;
        if (
          selectedFunnel &&
          !selectedFunnel.productKeys.includes(row.product_key)
        )
          return false;
        return true;
      }),
    [data.orders, includeTests, platform, selectedFunnel],
  );

  const sessionCount = new Set(
    filteredEvents.map((row) => row.funnel_session_id),
  ).size;
  const viewed = new Set(
    filteredEvents
      .filter(
        (row) =>
          VIEW_EVENTS.has(row.event_name) ||
          row.event_name.endsWith("page_view"),
      )
      .map((row) => row.funnel_session_id),
  ).size;
  const checkout = new Set(
    filteredEvents
      .filter((row) => row.event_name.includes("checkout"))
      .map((row) => row.funnel_session_id),
  ).size;
  const paid = filteredOrders.filter((row) => row.payment_status === "paid");
  const paidCommercial = paid.filter((row) => row.amount_cents > 0);
  const fulfillmentFailures = paid.filter(
    (row) => row.fulfillment_status === "failed" || Boolean(row.last_error),
  );
  const pending = filteredOrders.filter(
    (row) => row.payment_status === "pending",
  );
  const allEmails = [...data.emails, ...data.legacyEmails];
  const emailSent = allEmails.filter((row) => row.status === "sent").length;
  const emailFailed = allEmails.filter((row) => row.status === "failed").length;
  const latestEventAt = filteredEvents[0]?.created_at || null;
  const dropSteps = selectedFunnel
    ? funnelDropoff(filteredEvents, selectedFunnel.steps)
    : [];
  const emailsFromEvents = selectedFunnel
    ? selectedFunnel.id === "club"
      ? 0
      : emailsCollectedInFunnel(filteredEvents, selectedFunnel)
    : CHRISTMAS_FUNNELS.filter((funnel) => funnel.id !== "club").reduce(
        (sum, funnel) => {
          const rows = filteredEvents.filter((row) =>
            eventMatchesFunnel(row, funnel),
          );
          return sum + emailsCollectedInFunnel(rows, funnel);
        },
        0,
      );
  const clubEmails =
    !selectedFunnel || selectedFunnel.id === "club"
      ? data.clubSignups.length
      : 0;
  const emailsCollected = clubEmails + emailsFromEvents;

  const biggestDrop = dropSteps
    .filter((step) => step.dropped != null)
    .sort((a, b) => (b.dropped || 0) - (a.dropped || 0))[0];

  const pageViews = filteredEvents.filter(
    (row) =>
      VIEW_EVENTS.has(row.event_name) || row.event_name.endsWith("page_view"),
  ).length;
  const ctaClicks = filteredEvents.filter((row) =>
    /(preview|offer|cta|personal|checkout_started)/i.test(row.event_name),
  ).length;
  const conversionRate = pct(paidCommercial.length, viewed);
  const detailPageRows = useMemo(() => {
    const grouped = new Map<
      string,
      { views: number; sessions: Set<string>; cta: number; orders: number }
    >();
    for (const row of filteredEvents) {
      const path = row.pathname || "/";
      const current = grouped.get(path) || {
        views: 0,
        sessions: new Set<string>(),
        cta: 0,
        orders: 0,
      };
      if (
        VIEW_EVENTS.has(row.event_name) ||
        row.event_name.endsWith("page_view")
      )
        current.views += 1;
      current.sessions.add(row.funnel_session_id);
      if (/(preview|offer|cta|personal|checkout_started)/i.test(row.event_name))
        current.cta += 1;
      if (row.order_id) current.orders += 1;
      grouped.set(path, current);
    }
    return [...grouped.entries()]
      .map(([path, row]) => ({
        path,
        views: row.views,
        sessions: row.sessions.size,
        cta: row.cta,
        orders: row.orders,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);
  }, [filteredEvents]);

  const dailyTraffic = useMemo(() => {
    const count = Math.max(1, Math.min(days || 14, 14));
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.now() - (count - 1 - index) * 86400000)
        .toISOString()
        .slice(0, 10);
      const sessions = new Set(
        filteredEvents
          .filter((row) => row.created_at.slice(0, 10) === date)
          .map((row) => row.funnel_session_id),
      ).size;
      return { date, sessions };
    });
  }, [days, filteredEvents]);
  const maxDailyTraffic = Math.max(
    1,
    ...dailyTraffic.map((row) => row.sessions),
  );

  const funnelRows = selectedFunnel
    ? dropSteps.map((step) => ({
        label: step.label,
        value: step.sessions,
        drop: step.dropped == null ? null : step.fromPreviousPct,
      }))
    : [
        { label: "Vizite pagină", value: viewed, drop: null },
        {
          label: "Interes produs",
          value: ctaClicks,
          drop: pct(ctaClicks, viewed),
        },
        {
          label: "Checkout început",
          value: checkout,
          drop: pct(checkout, ctaClicks),
        },
        {
          label: "Comenzi plătite",
          value: paidCommercial.length,
          drop: pct(paidCommercial.length, checkout),
        },
      ];

  const productRows = useMemo(() => {
    const keys = [
      ...new Set(
        filteredOrders
          .map((row) => row.product_key)
          .concat(
            filteredEvents.map((row) => row.product_key || "").filter(Boolean),
          ),
      ),
    ].sort();
    return keys
      .map((key) => {
        const productEvents = filteredEvents.filter(
          (row) => row.product_key === key,
        );
        const productOrders = filteredOrders.filter(
          (row) => row.product_key === key,
        );
        const sessions = new Set(
          productEvents.map((row) => row.funnel_session_id),
        ).size;
        const checkouts = new Set(
          productEvents
            .filter((row) => row.event_name.includes("checkout"))
            .map((row) => row.funnel_session_id),
        ).size;
        const purchases = productOrders.filter(
          (row) => row.payment_status === "paid" && row.amount_cents > 0,
        );
        return {
          key,
          sessions,
          checkouts,
          purchases: purchases.length,
          revenue: moneyByCurrency(purchases),
        };
      })
      .filter((row) => row.sessions || row.checkouts || row.purchases);
  }, [filteredEvents, filteredOrders]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredEvents) {
      const key = [
        row.utm_source || "direct",
        row.utm_campaign || "(none)",
      ].join(" / ");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredEvents]);

  return (
    <div className="min-h-full bg-[#f7f7f5] px-4 py-5 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Colectare activă
            </div>
            <p className="mt-4 max-w-3xl text-base text-neutral-500">
              Tot ce trebuie să știi despre traficul, interesul pentru produse
              și punctele unde se pierd comenzile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void data.load()}
            disabled={data.loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold shadow-sm hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${data.loading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
        </header>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-sm shadow-sm lg:justify-end">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as RangeDays)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-medium text-neutral-700 outline-none focus:border-[#b98a2e]"
          >
            <option value={1}>Astăzi</option>
            <option value={7}>Ultimele 7 zile</option>
            <option value={30}>Ultimele 30 zile</option>
            <option value={0}>Tot timpul</option>
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-medium text-neutral-700 outline-none focus:border-[#b98a2e]"
          >
            <option value="all">Tot site-ul</option>
            <option value="web">Web only</option>
            <option value="ios">iOS only</option>
          </select>
          <select
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            className="max-w-xs rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-medium text-neutral-700 outline-none focus:border-[#b98a2e]"
          >
            <option value="all">All funnels</option>
            {CHRISTMAS_FUNNELS.map((funnel) => (
              <option key={funnel.id} value={funnel.id}>
                {funnel.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={includeTests}
              onChange={(e) => setIncludeTests(e.target.checked)}
            />
            Include test / zero-value
          </label>
        </div>

        {data.error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100"
          >
            {data.error}
          </div>
        ) : null}

        {data.softWarnings.length > 0 && (
          <p role="status" className="text-sm text-amber-700">
            Date auxiliare incomplete: {data.softWarnings.join(" ")}
          </p>
        )}
        <p className="text-sm text-neutral-500">
          Datele combină evenimentele de funnel cu plățile confirmate și sursele
          campaniilor.
        </p>
        {data.loading ? (
          <p role="status">Loading report…</p>
        ) : data.error ? (
          <p>
            Report unavailable. Retry or select a shorter period; no totals are
            shown.
          </p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="Vizitatori"
                value={sessionCount}
                hint={`${sessionCount} sesiuni`}
                icon={<Users className="h-5 w-5" />}
              />
              <Metric
                label="Vizualizări"
                value={pageViews}
                hint={`${viewed} sesiuni cu vizualizare`}
                icon={<Eye className="h-5 w-5" />}
              />
              <Metric
                label="Clickuri CTA"
                value={ctaClicks}
                hint={`${emailsCollected} emailuri colectate`}
                icon={<MousePointerClick className="h-5 w-5" />}
              />
              <Metric
                label="Timp activ"
                value="—"
                hint="Date de durată indisponibile"
                icon={<Timer className="h-5 w-5" />}
              />
              <Metric
                label="Conversie"
                value={conversionRate}
                hint={`${paidCommercial.length} comenzi plătite`}
                icon={<ShoppingCart className="h-5 w-5" />}
                highlighted
              />
              <Metric
                label="Venit urmărit"
                value={moneyByCurrency(paidCommercial).replace("US$", "USD ")}
                hint={`${pending.length} semnale de abandon`}
                icon={<CircleDollarSign className="h-5 w-5" />}
                highlighted
              />
            </section>

            <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      Trafic în timp
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Utilizatori unici pe zi pentru perioada selectată.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
                    <span className="h-3 w-3 rounded-full bg-[#c98f27]" />
                    Utilizatori
                  </span>
                </div>
                <div className="mt-6 h-[280px] w-full">
                  <svg
                    viewBox="0 0 800 280"
                    className="h-full w-full"
                    role="img"
                    aria-label="Trafic în timp"
                  >
                    {[0, 1, 2, 3, 4].map((line) => {
                      const y = 32 + line * 52;
                      return (
                        <line
                          key={line}
                          x1="42"
                          x2="780"
                          y1={y}
                          y2={y}
                          stroke="#e5e5e5"
                          strokeDasharray="4 5"
                        />
                      );
                    })}
                    <path
                      d={`M 42 240 ${dailyTraffic
                        .map((row, index) => {
                          const x =
                            42 +
                            (index / Math.max(1, dailyTraffic.length - 1)) *
                              738;
                          const y =
                            232 - (row.sessions / maxDailyTraffic) * 178;
                          return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
                        })
                        .join(" ")} L 780 240 Z`}
                      fill="#c98f27"
                      fillOpacity="0.16"
                    />
                    <path
                      d={dailyTraffic
                        .map((row, index) => {
                          const x =
                            42 +
                            (index / Math.max(1, dailyTraffic.length - 1)) *
                              738;
                          const y =
                            232 - (row.sessions / maxDailyTraffic) * 178;
                          return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#c98f27"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="4"
                    />
                    {dailyTraffic.map((row, index) => {
                      const x =
                        42 +
                        (index / Math.max(1, dailyTraffic.length - 1)) * 738;
                      const y = 232 - (row.sessions / maxDailyTraffic) * 178;
                      return (
                        <circle
                          key={row.date}
                          cx={x}
                          cy={y}
                          r="6"
                          fill="white"
                          stroke="#c98f27"
                          strokeWidth="4"
                        />
                      );
                    })}
                    <text x="42" y="267" fill="#a3a3a3" fontSize="12">
                      {dailyTraffic[0]?.date
                        ? new Date(
                            `${dailyTraffic[0].date}T12:00:00`,
                          ).toLocaleDateString("ro-RO", {
                            day: "2-digit",
                            month: "short",
                          })
                        : ""}
                    </text>
                    <text
                      x="780"
                      y="267"
                      textAnchor="end"
                      fill="#a3a3a3"
                      fontSize="12"
                    >
                      {dailyTraffic.at(-1)?.date
                        ? new Date(
                            `${dailyTraffic.at(-1)?.date}T12:00:00`,
                          ).toLocaleDateString("ro-RO", {
                            day: "2-digit",
                            month: "short",
                          })
                        : ""}
                    </text>
                  </svg>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      Funnel de conversie
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Vezi exact între ce pași se pierd vizitatorii.
                    </p>
                  </div>
                  <Filter className="h-6 w-6 text-[#b27d1f]" />
                </div>
                <div className="mt-7 space-y-6">
                  {funnelRows.map((row, index) => {
                    const width = `${Math.max(0, Math.min(100, (row.value / Math.max(1, funnelRows[0]?.value || 1)) * 100))}%`;
                    return (
                      <div key={`${row.label}-${index}`}>
                        <div className="flex items-center justify-between gap-3 text-base">
                          <span className="font-medium text-neutral-700">
                            {row.label}
                          </span>
                          <span className="font-semibold text-neutral-900">
                            {row.value}
                          </span>
                        </div>
                        {row.drop && index > 0 ? (
                          <div className="mt-1 text-right text-xs font-semibold text-rose-500">
                            {row.drop}
                          </div>
                        ) : null}
                        <div className="mt-2 h-3 rounded-full bg-neutral-100">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-[#b27d1f] to-[#ebca7a]"
                            style={{ width }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {selectedFunnel && biggestDrop ? (
              <p className="text-sm text-neutral-500">
                {selectedFunnel.label}: cea mai mare pierdere este la „
                {biggestDrop.label}” — {biggestDrop.dropped} sesiuni pierdute (
                {biggestDrop.fromPreviousPct} au continuat).
              </p>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-neutral-200 p-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Analiză detaliată
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Schimbă perspectiva fără să părăsești pagina.
                  </p>
                </div>
                <div className="flex flex-wrap gap-5 text-sm font-semibold text-neutral-400">
                  {(["pages", "products", "sources"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDetailTab(tab)}
                      className={`border-b-2 pb-2 transition ${detailTab === tab ? "border-[#c98f27] text-neutral-900" : "border-transparent hover:text-neutral-700"}`}
                    >
                      {tab === "pages"
                        ? "Pagini"
                        : tab === "products"
                          ? "Produse"
                          : "Surse & ieșiri"}
                    </button>
                  ))}
                </div>
              </div>
              {detailTab === "pages" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-neutral-400">
                      <tr>
                        <th className="p-5">Pagină</th>
                        <th className="p-5">Vizualizări</th>
                        <th className="p-5">Sesiuni</th>
                        <th className="p-5">CTA</th>
                        <th className="p-5">Comenzi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPageRows.length ? (
                        detailPageRows.map((row) => (
                          <tr
                            key={row.path}
                            className="border-t border-neutral-100"
                          >
                            <td className="p-5 font-medium text-neutral-800">
                              {row.path}
                            </td>
                            <td className="p-5">{row.views}</td>
                            <td className="p-5">{row.sessions}</td>
                            <td className="p-5">{row.cta}</td>
                            <td className="p-5 font-semibold">{row.orders}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-5 text-neutral-500" colSpan={5}>
                            Nu există date în perioada selectată.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {detailTab === "products" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-neutral-400">
                      <tr>
                        <th className="p-5">Produs</th>
                        <th className="p-5">Sesiuni</th>
                        <th className="p-5">Checkout</th>
                        <th className="p-5">Plătite</th>
                        <th className="p-5">Venit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length ? (
                        productRows.map((row) => (
                          <tr
                            key={row.key}
                            className="border-t border-neutral-100"
                          >
                            <td className="p-5 font-mono text-xs text-neutral-700">
                              {row.key}
                            </td>
                            <td className="p-5">{row.sessions}</td>
                            <td className="p-5">{row.checkouts}</td>
                            <td className="p-5">{row.purchases}</td>
                            <td className="p-5 font-semibold">{row.revenue}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-5 text-neutral-500" colSpan={5}>
                            Nu există produse în perioada selectată.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {detailTab === "sources" ? (
                <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_1fr]">
                  <div>
                    <h4 className="font-semibold text-neutral-900">
                      Proveniență trafic
                    </h4>
                    <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                      {sourceRows.length ? (
                        sourceRows.map(([label, count]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                          >
                            <span className="truncate text-neutral-600">
                              {label}
                            </span>
                            <span className="font-semibold text-neutral-900">
                              {count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="p-4 text-sm text-neutral-500">
                          Nu există evenimente în această perioadă.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-5 text-sm text-neutral-600">
                    <p className="font-semibold text-neutral-900">
                      Actualizare date
                    </p>
                    <p className="mt-3">
                      Ultimul eveniment:{" "}
                      {latestEventAt
                        ? new Date(latestEventAt).toLocaleString("ro-RO")
                        : "Nu există evenimente"}
                    </p>
                    <p className="mt-1">
                      Raport actualizat:{" "}
                      {data.loadedAt
                        ? data.loadedAt.toLocaleTimeString("ro-RO")
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-2xl font-semibold tracking-tight">
                Stare operațională
              </h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div
                  className={`rounded-xl border p-4 ${fulfillmentFailures.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
                >
                  <p className="flex items-center gap-2 font-medium">
                    {fulfillmentFailures.length ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}{" "}
                    Paid fulfillment
                  </p>
                  {fulfillmentFailures.slice(0, 6).map((row) => (
                    <p
                      key={row.id}
                      className="mt-2 break-words font-mono text-xs text-neutral-600"
                    >
                      {row.product_key} · {row.id.slice(0, 8)} ·{" "}
                      {row.last_error || row.fulfillment_status}
                    </p>
                  ))}
                  {!fulfillmentFailures.length ? (
                    <p className="mt-2 text-sm text-neutral-600">
                      No paid fulfillment failures in this view.
                    </p>
                  ) : null}
                </div>
                <div
                  className={`rounded-xl border p-4 ${emailFailed ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
                >
                  <p className="flex items-center gap-2 font-medium">
                    {emailFailed ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}{" "}
                    Delivery email
                  </p>
                  {allEmails
                    .filter((row) => row.status !== "sent")
                    .slice(0, 6)
                    .map((row) => (
                      <p
                        key={row.id}
                        className="mt-2 break-words font-mono text-xs text-neutral-600"
                      >
                        {row.kind} · {row.status} ·{" "}
                        {row.last_error || row.order_id.slice(0, 8)}
                      </p>
                    ))}
                  {!allEmails.length ? (
                    <p className="mt-2 text-sm text-amber-700">
                      No delivery-email ledger rows yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
