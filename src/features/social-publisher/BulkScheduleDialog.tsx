import React from "react";
import { toast } from "sonner";

import { socialPublisherApi } from "./api";
import { previewBulkSchedule } from "./bulkSchedule";
import { PLATFORM_CONSTRAINTS, PLATFORM_ORDER } from "./platforms";
import { snapshotFromCatalog, validateLibraryAssetForPlatforms } from "./validateMedia";
import type { LibraryVideo } from "@/features/admin-library/catalog";
import type { SocialPlatform } from "./types";

type Props = {
  videos: LibraryVideo[];
  timezone: string;
  onClose: () => void;
  onScheduled?: () => void;
};

export default function BulkScheduleDialog({ videos, timezone, onClose, onScheduled }: Props) {
  const [platforms, setPlatforms] = React.useState<SocialPlatform[]>([...PLATFORM_ORDER]);
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [postsPerDay, setPostsPerDay] = React.useState(3);
  const [times, setTimes] = React.useState(["10:00", "15:00", "20:00"]);
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setTimes((current) => {
      const next = current.slice(0, postsPerDay);
      while (next.length < postsPerDay) next.push("12:00");
      return next;
    });
  }, [postsPerDay]);

  const preview = previewBulkSchedule({
    assetIds: videos.map((v) => v.id),
    platforms,
    startDate,
    times,
    postsPerDay,
    timezone,
  });

  const mediaIssues = videos.flatMap((video) =>
    validateLibraryAssetForPlatforms(snapshotFromCatalog(video), platforms).issues.map((issue) => ({
      title: video.title,
      ...issue,
    })),
  );

  async function confirm() {
    if (!preview.ok) {
      toast.error(preview.error);
      return;
    }
    if (mediaIssues.length) {
      toast.error(mediaIssues[0]?.message || "One or more Reels cannot be scheduled.");
      return;
    }
    setBusy(true);
    try {
      await socialPublisherApi.bulkSchedule({
        assets: videos.map((video) => snapshotFromCatalog(video)),
        platforms,
        start_date: startDate,
        times,
        posts_per_day: postsPerDay,
        timezone,
        caption,
        hashtags,
      });
      toast.success(`Scheduled ${videos.length} Reels. Nothing was published immediately.`);
      onScheduled?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk schedule failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <h2 className="text-xl font-semibold text-slate-50">Schedule batch</h2>
        <p className="mt-1 text-sm text-slate-400">
          {videos.length} Reels will be distributed across upcoming slots. This never publishes immediately.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Start
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Posts per day
            <input
              type="number"
              min={1}
              max={8}
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-200">Platforms</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATFORM_ORDER.map((platform) => {
            const on = platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() =>
                  setPlatforms((current) =>
                    on ? current.filter((item) => item !== platform) : [...current, platform],
                  )
                }
                className={[
                  "rounded-full border px-3 py-1.5 text-sm",
                  on ? "border-indigo-400/40 bg-indigo-500/20" : "border-slate-800 bg-slate-900",
                ].join(" ")}
              >
                {on ? "✓ " : ""}
                {PLATFORM_CONSTRAINTS[platform].label}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium text-slate-200">Times</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {times.map((time, index) => (
            <input
              key={index}
              type="time"
              value={time}
              onChange={(e) =>
                setTimes((current) => current.map((item, i) => (i === index ? e.target.value : item)))
              }
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            />
          ))}
        </div>

        <label className="mt-4 block text-sm text-slate-300">
          Caption
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-3 block text-sm text-slate-300">
          Hashtags
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-sm font-medium text-slate-200">Preview</p>
          {!preview.ok ? (
            <p className="mt-2 text-sm text-amber-200">{preview.error}</p>
          ) : (
            <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm text-slate-300">
              {preview.slots.map((slot) => {
                const video = videos.find((item) => item.id === slot.assetId);
                return (
                  <li key={`${slot.assetId}-${slot.scheduledAtIso}`}>
                    {slot.localDate} {slot.localTime} · {video?.title || slot.assetId}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {mediaIssues.length ? (
          <div className="mt-3 text-sm text-amber-200">
            {mediaIssues.slice(0, 5).map((issue) => (
              <p key={`${issue.title}-${issue.code}`}>
                {issue.title}: {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !preview.ok || mediaIssues.length > 0}
            onClick={() => void confirm()}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm schedule
          </button>
        </div>
      </div>
    </div>
  );
}
