import { useMemo, useState } from "react";
import { Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChristmasDatePreset } from "@/features/christmas-countdown/dateRange";
import { CHRISTMAS_COUNTDOWN_DEFAULTS } from "@/features/christmas-countdown/defaults";
import {
  buildCountdownFunnel,
  conversionRate,
  formatCount,
  formatPct,
  returningLabel,
  userStatusLabel,
} from "@/features/christmas-countdown/metrics";
import {
  exportChristmasSignupsCsv,
  useChristmasCountdownAdmin,
  useChristmasCountdownSettings,
  useChristmasSignups,
} from "@/hooks/useChristmasCountdownAdmin";

const PRESETS: Array<{ id: ChristmasDatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

function BreakdownList({
  rows,
  empty,
}: {
  rows: Array<{ key: string; users: number; views?: number }>;
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.users));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs text-slate-300">
            <span className="truncate">{row.key}</span>
            <span className="shrink-0 font-mono text-slate-400">
              {formatCount(row.users)} users
              {row.views != null ? ` · ${formatCount(row.views)} views` : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-indigo-400/80" style={{ width: `${Math.max(4, (row.users / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ daily }: { daily: Array<{ date: string; views: number; users: number }> }) {
  const max = Math.max(1, ...daily.map((row) => Math.max(row.views, row.users)));
  if (!daily.length) return <p className="text-sm text-slate-500">No traffic in this range.</p>;
  return (
    <div className="space-y-2">
      {daily.map((row) => (
        <div key={row.date} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-xs text-slate-300">
          <span className="font-mono text-slate-500">{row.date.slice(5)}</span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.max(row.views ? 4 : 0, (row.views / max) * 100)}%` }} />
          </div>
          <span className="font-mono text-slate-400">
            {formatCount(row.views)} / {formatCount(row.users)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ChristmasCountdownPage() {
  const [preset, setPreset] = useState<ChristmasDatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const custom = preset === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : undefined;
  const { loading, error, ga4, firstParty, firstPartyError, instrumentationNote, refresh, range } =
    useChristmasCountdownAdmin(preset, custom);
  const signups = useChristmasSignups(range, { search, method, source, campaign, page });
  const settings = useChristmasCountdownSettings();

  const visitors = ga4?.report?.totals.totalUsers ?? null;
  const pageViews = ga4?.report?.totals.pageViews ?? null;
  const signupsTotal = firstParty?.signups_total ?? null;
  const conversion = conversionRate(firstParty ? signupsTotal : null, visitors);
  const funnel = useMemo(
    () =>
      buildCountdownFunnel({
        visitors,
        joinStarted: firstParty ? firstParty.join_started_sessions ?? 0 : null,
        joined: firstParty ? firstParty.signups_total ?? 0 : null,
        returned: firstParty ? firstParty.return_visit_sessions || firstParty.signups_returning || 0 : null,
      }),
    [visitors, firstParty],
  );
  const maxFunnel = Math.max(1, ...funnel.map((step) => step.count ?? 0));
  const pages = Math.max(1, Math.ceil(signups.total / signups.pageSize));

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportChristmasSignupsCsv({
        from: range.from,
        to: range.to,
        search,
        method,
        source,
        campaign,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || "christmas-countdown-signups.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Christmas Countdown</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Analytics and controls for <span className="font-mono text-slate-300">/christmas</span>. GA4 is scoped to that
            path. Signups come from the TDG database, not Google Analytics.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPreset(item.id);
              setPage(1);
            }}
            className={[
              "rounded-2xl border px-3 py-2 text-sm font-medium transition",
              preset === item.id
                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
        {preset === "custom" ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
        ) : null}
      </div>

      {instrumentationNote ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs leading-5 text-slate-400">
          {instrumentationNote}
        </p>
      ) : null}

      {ga4 && !ga4.configured ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Analytics temporarily unavailable — GA4 Data API credentials are not configured
          {ga4.missing?.length ? ` (${ga4.missing.join(", ")})` : ""}. Signup data below is still live.
        </div>
      ) : ga4?.error ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Analytics temporarily unavailable. {ga4.error}
        </div>
      ) : null}

      {firstPartyError ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Signup metrics could not be loaded.
          {/forbidden/i.test(firstPartyError) ? "" : ` ${firstPartyError}`}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">Loading countdown analytics…</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Page Views" value={ga4?.report ? formatCount(pageViews) : "—"} helper="GA4 screenPageViews on /christmas" />
        <StatCard label="Users" value={ga4?.report ? formatCount(visitors) : "—"} helper="GA4 totalUsers — unique users, not sessions" />
        <StatCard label="Signups" value={firstParty ? formatCount(signupsTotal) : "—"} helper="Completed countdown registrations" />
        <StatCard label="Conversion Rate" value={formatPct(conversion)} helper="signups / unique users" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Email Signups" value={firstParty ? formatCount(firstParty.signups_email) : "—"} />
        <StatCard label="Google Signups" value={firstParty ? formatCount(firstParty.signups_google) : "—"} />
        <StatCard
          label="Returning Visitors"
          value={
            ga4?.report?.totals.returningUsers != null
              ? formatCount(ga4.report.totals.returningUsers)
              : firstParty
                ? formatCount(firstParty.return_visit_sessions || firstParty.signups_returning)
                : "—"
          }
          helper={
            ga4?.report?.totals.returningUsers != null
              ? "GA4 new vs returning users on /christmas"
              : "First-party return visits / returning signups"
          }
        />
        <StatCard
          label="Active now"
          value={ga4?.realtime ? formatCount(ga4.realtime.activeUsers) : "—"}
          helper={
            ga4?.realtimeError
              ? "Realtime unavailable"
              : ga4?.realtime?.viewsLast30m != null
                ? `${formatCount(ga4.realtime.viewsLast30m)} views in last 30 min`
                : "christmas_page_view in last 30 minutes"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Traffic over time" subtitle="Views / users by day for /christmas">
          <DailyChart daily={ga4?.report?.daily ?? []} />
        </SectionCard>
        <SectionCard title="Funnel" subtitle="Visitor → Join started → Joined → Returned">
          <div className="space-y-3">
            {funnel.map((step, index) => (
              <div key={step.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-200">{step.label}</span>
                  <span className="font-mono text-slate-300">
                    {formatCount(step.count)}
                    {index > 0 ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {formatPct(step.fromPreviousPct)}
                        {index === 2 ? " of started" : index === 3 ? " of joined" : ""}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-rose-400/80"
                    style={{ width: `${Math.max(step.count ? 4 : 0, ((step.count ?? 0) / maxFunnel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Sources / campaigns" subtitle="session source, source/medium, campaign">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Source</p>
              <BreakdownList rows={ga4?.report?.sources ?? []} empty="No source data." />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Campaign</p>
              <BreakdownList rows={ga4?.report?.campaigns ?? []} empty="No campaign data." />
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Source / medium</p>
            <BreakdownList rows={ga4?.report?.sourceMedium ?? []} empty="No source/medium data." />
          </div>
        </SectionCard>
        <SectionCard title="Referrers" subtitle="pageReferrer where GA4 provides it">
          <BreakdownList rows={ga4?.report?.referrers ?? []} empty="No referrer data." />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Countries">
          <BreakdownList rows={ga4?.report?.countries ?? []} empty="No country data." />
        </SectionCard>
        <SectionCard title="Cities">
          <BreakdownList rows={ga4?.report?.cities ?? []} empty="No city data." />
        </SectionCard>
        <SectionCard title="Devices" subtitle="mobile / desktop / tablet">
          <BreakdownList rows={ga4?.report?.devices ?? []} empty="No device data." />
        </SectionCard>
      </div>

      {ga4?.report?.totals.engagedSessions != null || ga4?.report?.totals.engagementRate != null ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Engaged sessions" value={formatCount(ga4.report.totals.engagedSessions)} />
          <StatCard label="Engagement rate" value={formatPct(ga4.report.totals.engagementRate)} />
          <StatCard
            label="Avg. engagement time"
            value={
              ga4.report.totals.averageEngagementTimeSec == null
                ? "—"
                : `${Math.round(ga4.report.totals.averageEngagementTimeSec)}s`
            }
          />
        </div>
      ) : null}

      <SectionCard title="Signups" subtitle="First-party countdown registrations. Newest first.">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search email"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">All methods</option>
              <option value="email">Email</option>
              <option value="google">Google</option>
            </select>
            <input
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              placeholder="Filter source"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={campaign}
              onChange={(e) => {
                setCampaign(e.target.value);
                setPage(1);
              }}
              placeholder="Filter campaign"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        {signups.error ? <p className="mb-3 text-sm text-amber-200">{signups.error}</p> : null}
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-400">Email</TableHead>
              <TableHead className="text-slate-400">Method</TableHead>
              <TableHead className="text-slate-400">Joined at</TableHead>
              <TableHead className="text-slate-400">Source</TableHead>
              <TableHead className="text-slate-400">Medium</TableHead>
              <TableHead className="text-slate-400">Campaign</TableHead>
              <TableHead className="text-slate-400">Referrer</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Returning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signups.rows.map((row) => (
              <TableRow key={row.id} className="border-slate-800">
                <TableCell className="font-medium text-slate-100">{row.email}</TableCell>
                <TableCell className="capitalize text-slate-300">{row.signup_method}</TableCell>
                <TableCell className="text-slate-400">{new Date(row.created_at).toLocaleString("en-US")}</TableCell>
                <TableCell className="text-slate-400">{row.source || "—"}</TableCell>
                <TableCell className="text-slate-400">{row.medium || "—"}</TableCell>
                <TableCell className="text-slate-400">{row.campaign || "—"}</TableCell>
                <TableCell className="text-slate-400">{row.referrer || "—"}</TableCell>
                <TableCell className="text-slate-400">{userStatusLabel(row)}</TableCell>
                <TableCell className="text-slate-400">{returningLabel(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!signups.loading && signups.rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No signups in this range.</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <span>
            {signups.total} total · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-800 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-800 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Countdown settings" subtitle="These values drive the public /christmas page. Failures fall back to defaults.">
        {settings.error ? <p className="mb-3 text-sm text-amber-200">{settings.error}</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Countdown target</span>
            <input
              type="datetime-local"
              value={settings.settings.countdownTargetAt.replace(/Z$/, "").slice(0, 16)}
              onChange={(e) =>
                settings.setSettings({
                  ...settings.settings,
                  countdownTargetAt: e.target.value
                    ? new Date(`${e.target.value}:00.000Z`).toISOString()
                    : CHRISTMAS_COUNTDOWN_DEFAULTS.countdownTargetAt,
                })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
          <div className="flex items-center gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Switch
                checked={settings.settings.pageActive}
                onCheckedChange={(checked) => settings.setSettings({ ...settings.settings, pageActive: checked })}
              />
              Page active
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Switch
                checked={settings.settings.signupActive}
                onCheckedChange={(checked) => settings.setSettings({ ...settings.settings, signupActive: checked })}
              />
              Signup active
            </label>
          </div>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-slate-400">Headline</span>
            <input
              value={settings.settings.headline}
              onChange={(e) => settings.setSettings({ ...settings.settings, headline: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-slate-400">Supporting copy</span>
            <textarea
              value={settings.settings.supportingCopy}
              onChange={(e) => settings.setSettings({ ...settings.settings, supportingCopy: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">CTA text</span>
            <input
              value={settings.settings.ctaText}
              onChange={(e) => settings.setSettings({ ...settings.settings, ctaText: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Success message</span>
            <input
              value={settings.settings.successMessage}
              onChange={(e) => settings.setSettings({ ...settings.settings, successMessage: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-slate-400">Christmas reached state</span>
            <input
              value={settings.settings.reachedMessage}
              onChange={(e) => settings.setSettings({ ...settings.settings, reachedMessage: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={settings.saving}
          onClick={() => {
            void settings.save(settings.settings).then(
              () => toast.success("Countdown settings saved"),
              (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
            );
          }}
          className="mt-4 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          {settings.saving ? "Saving…" : "Save settings"}
        </button>
      </SectionCard>
    </div>
  );
}
