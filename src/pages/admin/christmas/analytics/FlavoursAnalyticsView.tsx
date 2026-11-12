// UI ported from Flavours Bistro src/admin/AdminAnalytics.tsx (production source, 2026-11-12).
// Presentation only: TDG supplies its own read-only report; no Flavours demo data or credentials.
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  MousePointerClick,
  PackageSearch,
  RefreshCw,
  Route,
  ShoppingCart,
  Sparkles,
  Timer,
  UsersRound,
} from "lucide-react";
import type { SiteAnalytics } from "./analyticsReport";
const PERIODS = [7, 30, 90] as const;
const panel =
  "rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]";
function number(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ro-RO").format(Number(value || 0));
}

function money(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function duration(value: number | null) {
  if (value == null) return "—";
  const seconds = Math.max(0, Math.round(value || 0));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortDay(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function longDay(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`${panel} p-4 sm:p-5 ${accent ? "border-[#EDE4D3] bg-gradient-to-br from-white to-[#FBF6EC]/70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? "bg-[#F5EAD3] text-[#8C6118]" : "bg-neutral-100 text-neutral-500"}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">{hint}</p>
    </div>
  );
}

function EmptyAnalytics() {
  return (
    <div className={`${panel} overflow-hidden`}>
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-7 sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Fără date în interval
          </span>
          <h2 className="mt-5 max-w-xl text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
            Panoul este pregătit. Primele date vor apărea automat.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
            Selectează alt interval sau verifică sursa de date. Aici apar doar
            evenimentele și comenzile disponibile pentru selecția curentă.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Vizite și pagini populare",
              "Produse și clickuri",
              "Funnel și abandon",
              "Surse și venit",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2.5 text-sm font-medium text-neutral-700"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FBF6EC] text-[#8C6118]">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-64 items-end justify-center bg-neutral-950 p-8 text-white">
          <div className="w-full max-w-sm">
            <div className="flex h-32 items-end gap-2">
              {[28, 44, 37, 66, 54, 82, 74].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-[#A87824] to-[#E3C57F]"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/60">
              <span>Date reale, nu estimări</span>
              <Sparkles className="h-4 w-4 text-[#E3C57F]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Funnel({ rows }: { rows: SiteAnalytics["funnel"] }) {
  const max = Math.max(rows[0]?.sessions || 0, 1);
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            Funnel de conversie
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Vezi exact între ce pași se pierd vizitatorii.
          </p>
        </div>
        <Route className="h-5 w-5 text-[#A87824]" />
      </div>
      <div className="mt-6 space-y-4">
        {rows.map((row, index) => {
          const previous = rows[index - 1]?.sessions || row.sessions;
          const loss =
            previous > 0
              ? Math.max(0, Math.round((1 - row.sessions / previous) * 100))
              : 0;
          return (
            <div key={row.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-neutral-700">
                  {row.label}
                </span>
                <span className="flex items-center gap-2">
                  {index > 0 && loss > 0 ? (
                    <span className="text-xs font-medium text-rose-600">
                      −{loss}%
                    </span>
                  ) : null}
                  <strong className="min-w-8 text-right text-neutral-950">
                    {number(row.sessions)}
                  </strong>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#A87824] to-[#E3C57F]"
                  style={{
                    width: `${Math.max(row.sessions ? 4 : 0, (row.sessions / max) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Trend({ rows }: { rows: SiteAnalytics["trend"] }) {
  const hasVisitors = rows.every((row) => row.visitors != null);
  const seriesLabel = hasVisitors ? "utilizatori" : "sesiuni";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 760;
  const height = 240;
  const padding = { top: 24, right: 18, bottom: 38, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = rows.map((row) => row.visitors ?? row.sessions);
  const rawMax = Math.max(...values, 1);
  const yMax = rawMax <= 5 ? 5 : Math.ceil(rawMax / 5) * 5;
  const points = rows.map((row, index) => ({
    row,
    value: values[index],
    x:
      rows.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / Math.max(rows.length - 1, 1)) * plotWidth,
    y: padding.top + plotHeight - (values[index] / yMax) * plotHeight,
  }));
  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const middle = (previous.x + point.x) / 2;
      return `C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`
    : "";
  const selectedIndex = activeIndex ?? (rows.length === 1 ? 0 : null);
  const selected = selectedIndex === null ? null : points[selectedIndex];
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));

  if (!rows.length) return null;

  return (
    <section className={`${panel} min-w-0 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">
            Trafic în timp
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {hasVisitors
              ? "Utilizatori unici pe zi pentru selecția curentă."
              : "Sesiuni urmărite pe zi pentru selecția curentă."}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <span className="h-2 w-2 rounded-full bg-[#C08A2D]" />
          {hasVisitors ? "Utilizatori" : "Sesiuni"}
        </span>
      </div>
      <div
        className="relative mt-5 h-[250px] w-full"
        onPointerLeave={() => setActiveIndex(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setActiveIndex(null);
        }}
      >
        <svg
          role="group"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-label="Evoluția zilnică a utilizatorilor"
        >
          <defs>
            <linearGradient
              id="analytics-users-area"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#c9912d" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#c9912d" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="#e5e5e5"
                  strokeDasharray="3 5"
                />
                <text
                  x={padding.left - 9}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#a3a3a3"
                >
                  {Math.round(yMax * ratio)}
                </text>
              </g>
            );
          })}
          {areaPath ? (
            <path d={areaPath} fill="url(#analytics-users-area)" />
          ) : null}
          <path
            d={linePath}
            fill="none"
            stroke="#c9912d"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {selected ? (
            <line
              x1={selected.x}
              x2={selected.x}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="#c9912d"
              strokeOpacity="0.35"
              strokeDasharray="4 5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {points.map((point, index) => {
            const showLabel =
              index % labelEvery === 0 || index === points.length - 1;
            const active = index === selectedIndex;
            return (
              <g
                key={point.row.day}
                role="button"
                tabIndex={0}
                aria-label={`${longDay(point.row.day)}: ${point.value} ${seriesLabel}`}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerMove={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveIndex(index);
                  }
                }}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(index)}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={
                    point.x -
                    Math.max(8, plotWidth / Math.max(points.length, 1) / 2)
                  }
                  y={padding.top}
                  width={Math.max(16, plotWidth / Math.max(points.length, 1))}
                  height={plotHeight}
                  fill="transparent"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 7 : 4.5}
                  fill="white"
                  stroke="#c9912d"
                  strokeWidth={active ? 4 : 3}
                  vectorEffect="non-scaling-stroke"
                />
                {showLabel ? (
                  <text
                    x={point.x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#a3a3a3"
                  >
                    {shortDay(point.row.day)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {selected ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-[170px] rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-xl"
            style={{
              left: `${(selected.x / width) * 100}%`,
              top: `${(selected.y / height) * 100}%`,
              transform: `translate(${selected.x < 130 ? "0" : selected.x > width - 130 ? "-100%" : "-50%"}, calc(-100% - 14px))`,
            }}
          >
            <p className="text-[11px] font-medium capitalize text-neutral-400">
              {longDay(selected.row.day)}
            </p>
            <p className="mt-1 text-lg font-bold text-neutral-950">
              {number(selected.value)} {seriesLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {number(selected.row.sessions)} sesiuni ·{" "}
              {number(selected.row.views)} vizualizări
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PagesTable({ rows }: { rows: SiteAnalytics["pages"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-[0.08em] text-neutral-400">
            <th className="px-5 py-3 font-semibold">Pagină</th>
            <th className="px-4 py-3 text-right font-semibold">Vizualizări</th>
            <th className="px-4 py-3 text-right font-semibold">Sesiuni</th>
            <th className="px-4 py-3 text-right font-semibold">Timp mediu</th>
            <th className="px-4 py-3 text-right font-semibold">CTA</th>
            <th className="px-5 py-3 text-right font-semibold">Comenzi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.path}
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80"
            >
              <td className="px-5 py-4 font-semibold text-neutral-800">
                {row.path}
              </td>
              <td className="px-4 py-4 text-right text-neutral-600">
                {number(row.views)}
              </td>
              <td className="px-4 py-4 text-right text-neutral-600">
                {number(row.sessions)}
              </td>
              <td className="px-4 py-4 text-right text-neutral-600">
                {duration(row.avgEngagementSeconds)}
              </td>
              <td className="px-4 py-4 text-right text-neutral-600">
                {number(row.ctaClicks)}
              </td>
              <td className="px-5 py-4 text-right font-semibold text-neutral-900">
                {number(row.purchases)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTable({ rows }: { rows: SiteAnalytics["products"] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {rows.length ? (
        rows.map((row, index) => (
          <div
            key={row.id}
            className="grid grid-cols-[auto_1fr] gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_repeat(4,minmax(70px,auto))] sm:items-center"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-500">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {row.name || row.id}
              </p>
              <p className="truncate text-xs text-neutral-400">{row.id}</p>
            </div>
            {[
              ["Vizualizări", row.views],
              ["Selectări", row.selections],
              ["Personalizări", row.adds],
              ["Venit", row.revenueLabel],
            ].map(([label, value]) => (
              <div key={String(label)} className="hidden text-right sm:block">
                <p className="text-[10px] uppercase tracking-wider text-neutral-400">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-800">
                  {value}
                </p>
              </div>
            ))}
          </div>
        ))
      ) : (
        <p className="px-5 py-10 text-center text-sm text-neutral-500">
          Încă nu există interacțiuni cu produse în interval.
        </p>
      )}
    </div>
  );
}

function SourcesAndExits({ data }: { data: SiteAnalytics }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="divide-y divide-neutral-100">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            Surse de trafic
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            UTM, referral sau acces direct.
          </p>
        </div>
        {data.sources.map((row) => (
          <div key={row.source} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800">
                {row.source}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                {row.purchases} comenzi • {row.revenueLabel}
              </p>
            </div>
            <strong className="text-sm text-neutral-900">
              {number(row.sessions)}
            </strong>
          </div>
        ))}
      </div>
      <div className="divide-y divide-neutral-100 border-t border-neutral-100 lg:border-l lg:border-t-0">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            Ultima pagină observată
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Sesiuni fără plată asociată; nu confirmă abandonul.
          </p>
        </div>
        {data.exits.map((row) => (
          <div key={row.path} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800">
                {row.path}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-rose-300"
                  style={{ width: `${Math.min(100, row.share)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <strong className="text-sm text-neutral-900">
                {number(row.sessions)}
              </strong>
              <p className="text-[11px] text-neutral-400">{row.share}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlavoursAnalyticsView({
  data,
  days,
  page,
  allPages,
  loading,
  error,
  warnings,
  onDaysChange,
  onPageChange,
  onRefresh,
}: {
  data: SiteAnalytics | null;
  days: 7 | 30 | 90;
  page: string;
  allPages: { path: string }[];
  loading: boolean;
  error: string | null;
  warnings: string[];
  onDaysChange: (days: 7 | 30 | 90) => void;
  onPageChange: (page: string) => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"pages" | "products" | "sources">("pages");
  const totals = data?.totals;
  const avgPages = totals?.sessions ? totals.pageViews / totals.sessions : 0;
  const issueCount = data?.issues.reduce((sum, row) => sum + row.count, 0) || 0;
  const hasData = Boolean(
    totals?.pageViews || totals?.events || totals?.purchases,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {loading
                ? "Se actualizează"
                : error
                  ? "Date indisponibile"
                  : hasData
                    ? "Date colectate"
                    : "Fără date în interval"}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Tot ce trebuie să știi despre trafic, interesul pentru produse și
            punctele unde se pierd comenzile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <select
              aria-label="Selectează pagina analizată"
              value={page}
              onChange={(event) => onPageChange(event.target.value)}
              className="h-10 max-w-[240px] appearance-none rounded-xl border border-neutral-200 bg-white pl-9 pr-9 text-sm font-medium text-neutral-700 outline-none focus:border-[#D5A845]"
            >
              <option value="">Tot site-ul</option>
              {allPages.map((row) => (
                <option key={row.path} value={row.path}>
                  {row.path}
                </option>
              ))}
            </select>
          </label>
          <div className="flex h-10 items-center rounded-xl border border-neutral-200 bg-white p-1">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => onDaysChange(period)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${days === period ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
              >
                {period} zile
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
            aria-label="Reîmprospătează"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}
      {loading && !data ? (
        <div className={`${panel} grid min-h-80 place-items-center`}>
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Se încarcă datele…
          </div>
        </div>
      ) : null}
      {!loading && data && !hasData ? <EmptyAnalytics /> : null}

      {data && hasData ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard
              label="Vizitatori"
              value={number(totals?.visitors)}
              hint={`${number(totals?.sessions || 0)} sesiuni`}
              icon={UsersRound}
            />
            <StatCard
              label="Vizualizări"
              value={number(totals?.pageViews || 0)}
              hint={`${avgPages.toFixed(1)} pagini / sesiune`}
              icon={Eye}
            />
            <StatCard
              label="Clickuri CTA"
              value={number(totals?.ctaClicks || 0)}
              hint={`${number(totals?.addToCart || 0)} personalizări începute`}
              icon={MousePointerClick}
            />
            <StatCard
              label="Timp activ"
              value={duration(
                totals?.engagementSeconds == null
                  ? null
                  : totals.engagementSeconds / Math.max(totals.pageViews, 1),
              )}
              hint="mediu / vizualizare"
              icon={Timer}
            />
            <StatCard
              label="Conversie"
              value={
                totals?.conversionRate == null
                  ? "—"
                  : `${totals.conversionRate.toFixed(1)}%`
              }
              hint={`${number(totals?.purchases || 0)} comenzi plătite`}
              icon={ShoppingCart}
              accent
            />
            <StatCard
              label="Venit urmărit"
              value={totals?.revenueLabel || "0 RON"}
              hint={`${issueCount} erori sau anulări înregistrate`}
              icon={CircleDollarSign}
              accent
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <Trend key={`${days}:${page}`} rows={data.trend} />
            <Funnel rows={data.funnel} />
          </div>

          <section className={`${panel} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 pt-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-950">
                  Analiză detaliată
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Schimbă perspectiva fără să părăsești pagina.
                </p>
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {(
                  [
                    ["pages", "Pagini", BarChart3],
                    ["products", "Produse", PackageSearch],
                    ["sources", "Surse & ieșiri", ArrowDownRight],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${tab === key ? "border-[#C08A2D] text-neutral-950" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {tab === "pages" ? <PagesTable rows={data.pages} /> : null}
            {tab === "products" ? <ProductsTable rows={data.products} /> : null}
            {tab === "sources" ? <SourcesAndExits data={data} /> : null}
          </section>

          {warnings.length > 0 ? (
            <details className="text-xs text-neutral-500">
              <summary>Disponibilitatea datelor</summary>
              <p className="mt-2">{warnings.join(" ")}</p>
            </details>
          ) : null}
          <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
              <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  Cum folosești datele pentru conversie
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Începe cu cel mai mare drop-off din funnel, apoi verifică
                  paginile de ieșire și produsele văzute mult dar cu puține
                  personalizări. Vizitatorii unici și timpul activ apar doar
                  dacă sunt măsurate; sesiunile nu sunt vizitatori unici.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Google Analytics <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://clarity.microsoft.com/projects/view/y3y98n4wks/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Înregistrări Clarity <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
