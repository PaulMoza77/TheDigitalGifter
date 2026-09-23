import React from "react";
import { toast } from "sonner";

import { publisherApi } from "@/features/publisher/api";
import { bulkTimes, CONTENT_TYPE_LABELS, DESTINATION_LABELS, WEEKDAY_LABELS } from "@/features/publisher/destinations";
import { monthGrid } from "@/features/publisher/slotGeneration";
import { DEFAULT_PUBLISHER_TIMEZONE, type PublisherDestination } from "@/features/publisher/types";
import { addDaysIso, formatZonedDateTime, zonedWallTimeToUtcMs } from "@/features/social-publisher/timezone";

type Tab = "Overview" | "Calendar" | "Queue" | "Schedule Rules";
type CalView = "week" | "day" | "month";

type PublicationRow = {
  id: string;
  slot_id: string | null;
  library_asset_id: string | null;
  caption: string;
  status: string;
  scheduled_at: string;
  timezone: string;
  approved: boolean;
  locked: boolean;
  destinations: string[];
  assignment_source: string;
  asset_title?: string | null;
  asset_src?: string | null;
  asset_poster?: string | null;
  jobs: Array<{ id: string; destination: string; status: string; remote_url?: string | null; last_error?: string | null }>;
};

type RuleRow = {
  id: string;
  name: string;
  timezone: string;
  weekdays: number[];
  times: string[];
  contentType: string;
  destinations: string[];
  autoAssign: boolean;
  reuseCooldownDays: number;
  approvalRequired: boolean;
  active: boolean;
  libraryCategory: string | null;
};

type AssetRow = {
  id: string;
  title: string;
  src: string;
  poster?: string | null;
  contentType: string;
  excluded: boolean;
};

const DESTINATIONS = Object.keys(DESTINATION_LABELS) as PublisherDestination[];

function statusClass(status: string) {
  if (status === "completed") return "text-emerald-300";
  if (status === "failed") return "text-rose-300";
  if (status === "needs_approval") return "text-amber-300";
  if (status === "needs_content") return "text-sky-300";
  return "text-slate-300";
}

export default function AdminPublisherPage() {
  const [tab, setTab] = React.useState<Tab>("Overview");
  const [calView, setCalView] = React.useState<CalView>("week");
  const [loading, setLoading] = React.useState(true);
  const [overview, setOverview] = React.useState<Record<string, number>>({});
  const [publications, setPublications] = React.useState<PublicationRow[]>([]);
  const [rules, setRules] = React.useState<RuleRow[]>([]);
  const [assets, setAssets] = React.useState<AssetRow[]>([]);
  const [connections, setConnections] = React.useState<Array<{ provider: string; status: string }>>([]);
  const [timezone, setTimezone] = React.useState(DEFAULT_PUBLISHER_TIMEZONE);
  const [selected, setSelected] = React.useState<PublicationRow | null>(null);
  const [anchor, setAnchor] = React.useState(() => formatZonedDateTime(Date.now(), DEFAULT_PUBLISHER_TIMEZONE).date);
  const [ruleForm, setRuleForm] = React.useState({
    id: "",
    name: "Daily Reels",
    timezone: DEFAULT_PUBLISHER_TIMEZONE,
    weekdays: [1, 2, 3, 4, 5],
    times: ["10:00", "18:00"],
    contentType: "video",
    destinations: ["instagram_reel_post", "tiktok"] as string[],
    autoAssign: true,
    reuseCooldownDays: 14,
    approvalRequired: true,
    active: true,
    libraryCategory: "",
  });
  const [preview, setPreview] = React.useState<Array<{ scheduledAt: string }>>([]);
  const [manual, setManual] = React.useState({
    libraryAssetId: "",
    destinations: ["instagram_reel_post"] as string[],
    caption: "",
    date: formatZonedDateTime(Date.now() + 86400000, DEFAULT_PUBLISHER_TIMEZONE).date,
    time: "12:00",
    approve: false,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = (await publisherApi.bootstrap()) as {
        overview: Record<string, number>;
        publications: PublicationRow[];
        rules: RuleRow[];
        assets: AssetRow[];
        connections: Array<{ provider: string; status: string }>;
        timezone: string;
      };
      setOverview(data.overview || {});
      setPublications(data.publications || []);
      setRules(data.rules || []);
      setAssets(data.assets || []);
      setConnections(data.connections || []);
      setTimezone(data.timezone || DEFAULT_PUBLISHER_TIMEZONE);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Publisher.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (work: () => Promise<unknown>, ok = "Saved") => {
    try {
      await work();
      toast.success(ok);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    }
  };

  const days = React.useMemo(() => {
    if (calView === "day") return [anchor];
    if (calView === "month") return monthGrid(anchor);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(anchor, i));
  }, [anchor, calView]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, PublicationRow[]>();
    for (const row of publications) {
      const key = formatZonedDateTime(Date.parse(row.scheduled_at), row.timezone || timezone).date;
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [publications, timezone]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Publisher</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Library assets, rolling seven-day schedules, approval, and dry-run publishing. Live social APIs are not connected.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["Overview", "Calendar", "Queue", "Schedule Rules"] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={[
                "rounded-2xl border px-4 py-2 text-sm",
                tab === item ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100" : "border-slate-800 bg-slate-900 text-slate-300",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? <p className="mt-8 text-sm text-slate-400">Loading…</p> : null}

        {tab === "Overview" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Needs content", overview.needs_content],
              ["Needs approval", overview.needs_approval],
              ["Scheduled", overview.scheduled],
              ["Dry-run completed", overview.dry_run_completed],
              ["Failed", overview.failed],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{count || 0}</p>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-sm font-medium">Connections</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {connections.map((item) => (
                  <span key={item.provider} className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                    {item.provider}: {item.status.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Calendar" ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {(["week", "day", "month"] as CalView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCalView(view)}
                  className={calView === view ? "rounded-xl bg-slate-800 px-3 py-1 text-sm" : "rounded-xl px-3 py-1 text-sm text-slate-400"}
                >
                  {view}
                </button>
              ))}
              <input
                type="date"
                value={anchor}
                onChange={(event) => setAnchor(event.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-sm"
              />
            </div>
            <div className={calView === "month" ? "mt-4 grid grid-cols-7 gap-2" : "mt-4 grid gap-3"}>
              {days.map((day) => (
                <div key={day} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                  <p className="text-xs text-slate-500">{day}</p>
                  <div className="mt-2 space-y-2">
                    {(byDay.get(day) || []).map((row) => {
                      const local = formatZonedDateTime(Date.parse(row.scheduled_at), row.timezone || timezone);
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelected(row)}
                          className="flex w-full items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-left"
                        >
                          {row.asset_poster || row.asset_src ? (
                            <img src={row.asset_poster || row.asset_src || ""} alt="" className="h-10 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-8 rounded bg-slate-800" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm">{local.time} · {row.asset_title || "Needs content"}</p>
                            <p className={`text-xs ${statusClass(row.status)}`}>
                              {row.status} · {row.destinations.join(", ")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "Queue" ? (
          <div className="mt-6 space-y-3">
            {publications
              .filter((row) => row.status !== "cancelled")
              .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
              .map((row) => {
                const local = formatZonedDateTime(Date.parse(row.scheduled_at), row.timezone || timezone);
                return (
                  <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" className="flex gap-3 text-left" onClick={() => setSelected(row)}>
                        {row.asset_poster || row.asset_src ? (
                          <img src={row.asset_poster || row.asset_src || ""} alt="" className="h-16 w-12 rounded-lg object-cover" />
                        ) : null}
                        <div>
                          <p className="font-medium">{row.asset_title || "Needs content"}</p>
                          <p className="text-xs text-slate-400">
                            {local.date} {local.time} · {row.timezone} · Library {row.library_asset_id || "—"}
                          </p>
                          <p className={`text-xs ${statusClass(row.status)}`}>{row.status} · {row.destinations.join(", ")}</p>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => void run(() => publisherApi.approve(row.id), "Approved")}>Approve</button>
                        <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => setSelected(row)}>Replace</button>
                        <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => setSelected(row)}>Reschedule</button>
                        <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => void run(() => publisherApi.lock(row.id), "Locked")}>Lock</button>
                        <button type="button" className="rounded-lg border border-rose-400/40 px-2 py-1 text-rose-100" onClick={() => void run(() => publisherApi.cancel(row.id), "Cancelled")}>Cancel</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            <div className="rounded-2xl border border-dashed border-slate-800 p-4">
              <p className="text-sm font-medium">Create publication manually</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  value={manual.libraryAssetId}
                  onChange={(event) => setManual({ ...manual, libraryAssetId: event.target.value })}
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="">Select Library asset</option>
                  {assets.filter((asset) => !asset.excluded).slice(0, 200).map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.title}</option>
                  ))}
                </select>
                <input type="text" value={manual.caption} placeholder="Caption" onChange={(event) => setManual({ ...manual, caption: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                <input type="date" value={manual.date} onChange={(event) => setManual({ ...manual, date: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
                <input type="time" value={manual.time} onChange={(event) => setManual({ ...manual, time: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {DESTINATIONS.map((destination) => (
                  <label key={destination} className="text-xs text-slate-300">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={manual.destinations.includes(destination)}
                      onChange={(event) =>
                        setManual({
                          ...manual,
                          destinations: event.target.checked
                            ? [...manual.destinations, destination]
                            : manual.destinations.filter((item) => item !== destination),
                        })
                      }
                    />
                    {DESTINATION_LABELS[destination]}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
                  onClick={() =>
                    void run(async () => {
                      const scheduledAt = new Date(zonedWallTimeToUtcMs(manual.date, manual.time, timezone)).toISOString();
                      await publisherApi.createManual({
                        library_asset_id: manual.libraryAssetId,
                        destinations: manual.destinations,
                        caption: manual.caption,
                        scheduled_at: scheduledAt,
                        timezone,
                        approve: false,
                      });
                    }, "Saved for approval")
                  }
                >
                  Save as needs approval
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-indigo-500/20 px-3 py-2 text-sm text-indigo-100"
                  onClick={() =>
                    void run(async () => {
                      const scheduledAt = new Date(zonedWallTimeToUtcMs(manual.date, manual.time, timezone)).toISOString();
                      await publisherApi.createManual({
                        library_asset_id: manual.libraryAssetId,
                        destinations: manual.destinations,
                        caption: manual.caption,
                        scheduled_at: scheduledAt,
                        timezone,
                        approve: true,
                      });
                    }, "Approved")
                  }
                >
                  Save and approve
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Schedule Rules" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form
              className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => publisherApi.saveRule(ruleForm), "Rule saved");
              }}
            >
              <input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Name" />
              <input value={ruleForm.timezone} onChange={(event) => setRuleForm({ ...ruleForm, timezone: event.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, index) => {
                  const day = index + 1;
                  const on = ruleForm.weekdays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setRuleForm({
                          ...ruleForm,
                          weekdays: on ? ruleForm.weekdays.filter((item) => item !== day) : [...ruleForm.weekdays, day],
                        })
                      }
                      className={on ? "rounded-lg bg-indigo-500/20 px-2 py-1 text-xs" : "rounded-lg border border-slate-800 px-2 py-1 text-xs"}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                value={ruleForm.times.join(", ")}
                onChange={(event) => setRuleForm({ ...ruleForm, times: event.target.value.split(/[,\s]+/) })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Times HH:MM"
              />
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs" onClick={() => setRuleForm({ ...ruleForm, times: bulkTimes(30) })}>Every 30 min</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2 py-1 text-xs" onClick={() => setRuleForm({ ...ruleForm, times: bulkTimes(60) })}>Every 60 min</button>
              </div>
              <select value={ruleForm.contentType} onChange={(event) => setRuleForm({ ...ruleForm, contentType: event.target.value })} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                <option value="video">{CONTENT_TYPE_LABELS.video}</option>
                <option value="image">{CONTENT_TYPE_LABELS.image}</option>
              </select>
              <div className="flex flex-wrap gap-2">
                {DESTINATIONS.map((destination) => (
                  <label key={destination} className="text-xs">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={ruleForm.destinations.includes(destination)}
                      onChange={(event) =>
                        setRuleForm({
                          ...ruleForm,
                          destinations: event.target.checked
                            ? [...ruleForm.destinations, destination]
                            : ruleForm.destinations.filter((item) => item !== destination),
                        })
                      }
                    />
                    {DESTINATION_LABELS[destination]}
                  </label>
                ))}
              </div>
              <label className="block text-xs text-slate-400">
                Library category
                <input value={ruleForm.libraryCategory} onChange={(event) => setRuleForm({ ...ruleForm, libraryCategory: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="optional, e.g. christmas_reels" />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.autoAssign} onChange={(event) => setRuleForm({ ...ruleForm, autoAssign: event.target.checked })} /> Automatic Library assignment</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.approvalRequired} onChange={(event) => setRuleForm({ ...ruleForm, approvalRequired: event.target.checked })} /> Approval required</label>
              <label className="flex items-center gap-2 text-sm">Reuse cooldown (days) <input type="number" min={0} value={ruleForm.reuseCooldownDays} onChange={(event) => setRuleForm({ ...ruleForm, reuseCooldownDays: Number(event.target.value) })} className="w-20 rounded border border-slate-800 bg-slate-950 px-2 py-1" /></label>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl border border-slate-700 px-3 py-2 text-sm" onClick={() => void publisherApi.previewRule(ruleForm).then((result) => setPreview(result.slots))}>Preview next 7 days</button>
                <button type="submit" className="rounded-xl bg-indigo-500/30 px-3 py-2 text-sm">Save rule</button>
              </div>
              {preview.length ? (
                <ul className="max-h-40 overflow-auto text-xs text-slate-400">
                  {preview.map((slot) => (
                    <li key={slot.scheduledAt}>{new Date(slot.scheduledAt).toISOString()}</li>
                  ))}
                </ul>
              ) : null}
            </form>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-slate-800 p-4">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-slate-400">{rule.timezone} · {rule.times.join(", ")} · {rule.active ? "active" : "paused"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => setRuleForm({
                      id: rule.id,
                      name: rule.name,
                      timezone: rule.timezone,
                      weekdays: rule.weekdays,
                      times: rule.times,
                      contentType: rule.contentType,
                      destinations: rule.destinations,
                      autoAssign: rule.autoAssign,
                      reuseCooldownDays: rule.reuseCooldownDays,
                      approvalRequired: rule.approvalRequired,
                      active: rule.active,
                      libraryCategory: rule.libraryCategory || "",
                    })}>Edit</button>
                    {rule.active ? (
                      <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => void run(() => publisherApi.pauseRule(rule.id), "Paused")}>Pause</button>
                    ) : (
                      <button type="button" className="rounded-lg border border-slate-700 px-2 py-1" onClick={() => void run(() => publisherApi.resumeRule(rule.id), "Resumed")}>Resume</button>
                    )}
                    <button type="button" className="rounded-lg border border-rose-400/40 px-2 py-1 text-rose-100" onClick={() => void run(() => publisherApi.deleteRule(rule.id), "Deleted")}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold">{selected.asset_title || "Slot"}</h2>
            <p className="text-sm text-slate-400">{selected.status} · {selected.scheduled_at}</p>
            {selected.asset_src ? <video src={selected.asset_src} controls className="mt-3 max-h-56 w-full rounded-xl bg-black" /> : null}
            <ul className="mt-3 space-y-1 text-sm">
              {selected.jobs.map((job) => (
                <li key={job.id}>{job.destination}: {job.status}{job.remote_url ? ` · ${job.remote_url}` : ""}{job.last_error ? ` · ${job.last_error}` : ""}</li>
              ))}
            </ul>
            <select
              className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              defaultValue=""
              onChange={(event) => {
                const assetId = event.target.value;
                if (assetId) void run(() => publisherApi.replaceContent(selected.id, assetId, false), "Content replaced");
              }}
            >
              <option value="">Replace with Library asset</option>
              {assets.filter((asset) => !asset.excluded).slice(0, 200).map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.title}</option>
              ))}
            </select>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button type="button" className="rounded-xl border border-slate-700 px-3 py-2" onClick={() => void run(() => publisherApi.returnToPool(selected.id), "Returned")}>Return to pool</button>
              {selected.library_asset_id ? (
                <button type="button" className="rounded-xl border border-slate-700 px-3 py-2" onClick={() => void run(() => publisherApi.excludeAsset(selected.library_asset_id!), "Excluded")}>Exclude asset</button>
              ) : null}
              <input
                type="datetime-local"
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  const iso = new Date(value).toISOString();
                  void run(() => publisherApi.reschedule(selected.id, iso), "Rescheduled");
                }}
              />
            </div>
            <button type="button" className="mt-4 text-sm text-slate-400" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
