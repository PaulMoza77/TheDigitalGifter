import React from "react";
import { toast } from "sonner";

import { socialPublisherApi, type SocialPublicationRow } from "@/features/social-publisher/api";
import LiveSessionsPanel from "@/features/youtube-live/LiveSessionsPanel";
import { PLATFORM_CONSTRAINTS, type SocialPlatform } from "@/features/social-publisher/platforms";
import { queueState } from "@/features/social-publisher/meta";
import { formatZonedDateTime } from "@/features/social-publisher/timezone";

const TABS = ["Calendar", "Upcoming", "Published", "Failed"] as const;
type Tab = (typeof TABS)[number];

const SHORT: Record<string, string> = {
  instagram_reels: "IG",
  instagram_photo: "IG photo",
  instagram_video: "IG video",
  facebook_reels: "FB",
  facebook_photo: "FB photo",
  facebook_video: "FB video",
  tiktok: "TT",
  youtube_shorts: "YT",
};

function targetLabel(platform: string, status: string) {
  if (platform.startsWith("instagram_") || platform.startsWith("facebook_")) {
    const state = queueState(status);
    return state === "other" ? status : state;
  }
  return status;
}

export default function AdminPublishingPage() {
  const [tab, setTab] = React.useState<Tab>("Calendar");
  const [items, setItems] = React.useState<SocialPublicationRow[]>([]);
  const [selected, setSelected] = React.useState<SocialPublicationRow | null>(null);
  const [timezone, setTimezone] = React.useState("UTC");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const boot = await socialPublisherApi.bootstrap();
      setTimezone(boot.timezone);
      const apiTab = tab === "Calendar" ? "calendar" : tab.toLowerCase();
      const data = await socialPublisherApi.listPublications(apiTab as "calendar" | "upcoming" | "published" | "failed");
      setItems(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load publishing.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function retry(targetId: string) {
    try {
      await socialPublisherApi.retryTarget(targetId);
      toast.success("Retry queued for the failed target only.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
    }
  }

  async function cancel(id: string) {
    try {
      await socialPublisherApi.cancel(id);
      toast.success("Cancelled.");
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Publishing</h1>
        <p className="mt-2 text-sm text-slate-400">Scheduled Reels across Instagram, Facebook, TikTok, and YouTube.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={[
                "rounded-2xl border px-4 py-2 text-sm",
                tab === item
                  ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
                  : "border-slate-800 bg-slate-900 text-slate-300",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? <p className="mt-8 text-sm text-slate-400">Loading…</p> : null}

        <div className="mt-6 grid gap-3">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-10 text-center text-sm text-slate-400">
              Nothing in this tab yet.
            </div>
          ) : null}
          {items.map((item) => {
            const local = formatZonedDateTime(Date.parse(item.scheduled_at), item.timezone || timezone);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    {item.asset_src ? (
                      <img
                        src={item.asset_src.replace(/\.mp4$/i, "") && item.asset_src}
                        alt=""
                        className="hidden h-16 w-10 rounded-lg bg-slate-800 object-cover sm:block"
                      />
                    ) : null}
                    <div>
                      <p className="text-sm font-semibold text-slate-50">{item.asset_title || item.library_asset_id}</p>
                      <p className="text-xs text-slate-400">
                        {local.date} {local.time} · {item.timezone} · {item.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.targets.map((target) => (
                      <span
                        key={target.id}
                        className={
                          target.status === "published"
                            ? "text-emerald-300"
                            : target.status === "failed"
                              ? "text-rose-300"
                              : "text-slate-400"
                        }
                      >
                        {SHORT[target.platform] || target.platform} {targetLabel(target.platform, target.status)}
                      </span>
                    ))}
                  </div>
                </div>
                {tab === "Failed"
                  ? item.targets
                      .filter((t) => t.status === "failed")
                      .map((target) => (
                        <div key={target.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <p className="text-rose-200">
                            {PLATFORM_CONSTRAINTS[target.platform as SocialPlatform]?.label || target.platform}:{" "}
                            {target.last_error} · attempts {target.attempts}
                          </p>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void retry(target.id);
                            }}
                            className="rounded-lg border border-rose-400/40 px-2 py-1 text-rose-100"
                          >
                            Retry
                          </span>
                        </div>
                      ))
                  : null}
              </button>
            );
          })}
        </div>
        <LiveSessionsPanel />
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold">{selected.asset_title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {selected.status} · {selected.timezone}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {selected.targets.map((target) => (
                <li key={target.id} className="rounded-xl border border-slate-800 px-3 py-2">
                  <p>
                    {SHORT[target.platform]} · {target.status}
                    {target.remote_url ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={target.remote_url} className="text-indigo-300 underline" target="_blank" rel="noreferrer">
                          remote post
                        </a>
                      </>
                    ) : null}
                  </p>
                  {target.last_error ? <p className="text-xs text-rose-300">{target.last_error}</p> : null}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              {selected.status === "scheduled" || selected.status === "partial" || selected.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => void cancel(selected.id)}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              ) : null}
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
