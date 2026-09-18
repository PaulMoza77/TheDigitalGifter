import React from "react";
import { Share2, X } from "lucide-react";
import { toast } from "sonner";

import { socialPublisherApi } from "./api";
import { PLATFORM_ORDER, PLATFORM_CONSTRAINTS } from "./platforms";
import { snapshotFromCatalog, validateLibraryAssetForPlatforms } from "./validateMedia";
import { zonedWallTimeToUtcMs } from "./timezone";
import type { LibraryVideo } from "@/features/admin-library/catalog";
import type { SocialPlatform } from "./types";

type Props = {
  video: LibraryVideo | null;
  timezone: string;
  onClose: () => void;
  onScheduled?: () => void;
};

export default function PublishReelDrawer({ video, timezone, onClose, onScheduled }: Props) {
  const [platforms, setPlatforms] = React.useState<SocialPlatform[]>([...PLATFORM_ORDER]);
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [youtubeTitle, setYoutubeTitle] = React.useState("");
  const [overridesOpen, setOverridesOpen] = React.useState(false);
  const [platformCaptions, setPlatformCaptions] = React.useState<Record<string, string>>({});
  const [mode, setMode] = React.useState<"now" | "schedule">("schedule");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = React.useState("19:00");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!video) return;
    setCaption("");
    setHashtags("");
    setYoutubeTitle(video.title.slice(0, 90));
    setPlatforms([...PLATFORM_ORDER]);
    setMode("schedule");
  }, [video?.id]);

  if (!video) return null;

  const asset = snapshotFromCatalog(video);
  const validation = validateLibraryAssetForPlatforms(asset, platforms);

  function toggle(platform: SocialPlatform) {
    setPlatforms((current) =>
      current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform],
    );
  }

  async function submit() {
    if (!validation.ok) {
      toast.error(validation.issues[0]?.message || "This Reel cannot be published yet.");
      return;
    }
    if (!platforms.length) {
      toast.error("Select at least one platform.");
      return;
    }
    setBusy(true);
    try {
      const scheduledAt =
        mode === "now"
          ? new Date().toISOString()
          : new Date(zonedWallTimeToUtcMs(date, time, timezone)).toISOString();
      await socialPublisherApi.createPublication({
        asset,
        platforms,
        caption,
        hashtags,
        youtube_title: youtubeTitle,
        platform_captions: platformCaptions,
        mode,
        scheduled_at: scheduledAt,
        timezone,
      });
      toast.success(
        mode === "now"
          ? `Queued to ${platforms.length} platform${platforms.length === 1 ? "" : "s"}`
          : `Scheduled to ${platforms.length} platform${platforms.length === 1 ? "" : "s"}`,
      );
      onScheduled?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule this Reel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <button type="button" className="h-full flex-1" aria-label="Close publisher" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Publish Reel</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">{video.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <video
          src={video.src}
          poster={video.poster}
          className="mb-5 aspect-[9/16] w-full rounded-2xl bg-black object-cover"
          muted
          playsInline
          controls
        />

        <p className="mb-2 text-sm font-medium text-slate-200">Publish to</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PLATFORM_ORDER.map((platform) => {
            const spec = PLATFORM_CONSTRAINTS[platform];
            const on = platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => toggle(platform)}
                className={[
                  "rounded-2xl border px-3 py-2 text-left text-sm transition",
                  on
                    ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-50"
                    : "border-slate-800 bg-slate-900 text-slate-300",
                ].join(" ")}
              >
                <span className="mr-2">{on ? "✓" : "○"}</span>
                {spec.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="mb-4 text-left text-xs text-slate-500 underline-offset-2 hover:underline"
          onClick={() => setPlatforms([...PLATFORM_ORDER])}
        >
          Select all
        </button>

        <label className="mb-3 block text-sm text-slate-300">
          Caption
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
          />
        </label>
        <label className="mb-3 block text-sm text-slate-300">
          Hashtags
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#christmas #thedigitalgifter"
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
          />
        </label>
        {platforms.includes("youtube_shorts") ? (
          <label className="mb-3 block text-sm text-slate-300">
            YouTube title
            <input
              value={youtubeTitle}
              onChange={(e) => setYoutubeTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => setOverridesOpen((v) => !v)}
          className="mb-3 text-left text-xs text-slate-500"
        >
          {overridesOpen ? "Hide" : "Optional"} platform-specific caption override
        </button>
        {overridesOpen
          ? platforms.map((platform) => (
              <label key={platform} className="mb-2 block text-xs text-slate-400">
                {PLATFORM_CONSTRAINTS[platform].label}
                <input
                  value={platformCaptions[platform] || ""}
                  onChange={(e) =>
                    setPlatformCaptions((current) => ({ ...current, [platform]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            ))
          : null}

        <div className="mb-4 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} />
            Publish now
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} />
            Schedule
          </label>
          {mode === "schedule" ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              />
              <span className="self-center text-xs text-slate-500">{timezone}</span>
            </div>
          ) : null}
        </div>

        {!validation.ok ? (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {validation.issues.map((issue) => (
              <p key={`${issue.code}-${issue.platform}`}>{issue.message}</p>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy || !validation.ok}
          onClick={() => void submit()}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {mode === "now"
            ? `Publish to ${platforms.length} platform${platforms.length === 1 ? "" : "s"}`
            : `Schedule to ${platforms.length} platform${platforms.length === 1 ? "" : "s"}`}
        </button>
      </aside>
    </div>
  );
}
