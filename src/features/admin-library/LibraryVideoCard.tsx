import React from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { formatDurationSeconds } from "./formatDuration";
import {
  getCachedLibraryVideoFile,
  isIosLikeDevice,
  isIpadLikeDevice,
  isShareGestureLost,
  isUserShareCancel,
  openLibraryVideoInNewTab,
  rememberLibraryVideoFile,
  fetchLibraryVideoFile,
  shareLibraryVideoFile,
  triggerBlobDownload,
} from "./saveLibraryVideo";
import { librarySrcPath, type LibraryVideo } from "./catalog";

type Props = {
  video: LibraryVideo;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
};

function formatFetchProgress(loaded: number, total: number | null): string {
  const mb = (value: number) => `${Math.max(0.1, value / (1024 * 1024)).toFixed(1)} MB`;
  if (total && total > 0) return `${mb(loaded)} / ${mb(total)}`;
  return `Downloading ${mb(loaded)}`;
}

export default function LibraryVideoCard({ video, playing, onPlayingChange }: Props) {
  const href = librarySrcPath(video.src);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const cardRef = React.useRef<HTMLElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [duration, setDuration] = React.useState(video.durationSeconds ?? null);
  const [saving, setSaving] = React.useState(false);
  const [progressLabel, setProgressLabel] = React.useState<string | null>(null);
  const [ios] = React.useState(() =>
    isIosLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform),
  );
  const [ipad] = React.useState(() =>
    isIpadLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform),
  );
  const [capturedPoster, setCapturedPoster] = React.useState<string | null>(null);
  const saveLockRef = React.useRef(false);

  React.useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!playing) {
      el.pause();
      return;
    }
    const play = el.play();
    if (play && typeof play.catch === "function") play.catch(() => onPlayingChange(false));
  }, [playing, onPlayingChange]);

  function capturePosterFrame() {
    const el = videoRef.current;
    if (!el || el.videoWidth < 2 || el.videoHeight < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(el, 0, 0);
      setCapturedPoster(canvas.toDataURL("image/jpeg", 0.72));
    } catch {
      /* tainted canvas if the file is cross-origin */
    }
  }

  function paintFirstFrame() {
    const el = videoRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
    if (el.currentTime === 0 && Number.isFinite(el.duration) && el.duration > 0) {
      try {
        el.currentTime = Math.min(0.12, el.duration * 0.08);
      } catch {
        /* iOS may reject seeks until more data arrives */
      }
    }
  }

  const stillSrc = capturedPoster || video.poster;

  async function onSave() {
    if (saveLockRef.current) return;

    // iPad: do this in the tap itself. Fetch + navigator.share opens an empty AirDrop card.
    if (ipad) {
      videoRef.current?.pause();
      onPlayingChange(false);
      openLibraryVideoInNewTab(href, video.filename);
      toast.message("Clip opened. Tap Share, then Save Video to add it to Photos.");
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    setProgressLabel(null);
    try {
      videoRef.current?.pause();
      onPlayingChange(false);

      let file = getCachedLibraryVideoFile(href);
      if (!file) {
        file = await fetchLibraryVideoFile(href, video.filename, (loaded, total) => {
          setProgressLabel(formatFetchProgress(loaded, total));
        });
        rememberLibraryVideoFile(href, file);
      }

      if (!ios) {
        triggerBlobDownload(file, video.filename);
        toast.success(`Downloading ${video.filename}`);
        return;
      }

      // Stop the spinner before the share sheet so a hung Files UI cannot trap the button.
      setSaving(false);
      setProgressLabel(null);
      saveLockRef.current = false;
      try {
        await shareLibraryVideoFile(file);
        toast.success("Choose Save Video to add it to Photos.");
      } catch (error) {
        if (isUserShareCancel(error)) return;
        if (isShareGestureLost(error)) {
          toast.message("Video is ready. Tap Save to Photos again, then choose Save Video.");
          return;
        }
        throw error;
      }
    } catch (error) {
      if (isUserShareCancel(error)) return;
      toast.error(error instanceof Error ? error.message : "Could not save this video.");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
      setProgressLabel(null);
    }
  }

  const durationLabel = formatDurationSeconds(duration);

  return (
    <article
      ref={cardRef}
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
    >
      <div className="relative aspect-[9/16] w-full bg-slate-950 sm:aspect-video">
        {visible ? (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (!el) return;
              el.setAttribute("playsinline", "true");
              el.setAttribute("webkit-playsinline", "true");
              el.playsInline = true;
              el.muted = true;
            }}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            src={href}
            poster={video.poster}
            playsInline
            muted
            preload="metadata"
            controls={false}
            onLoadedMetadata={paintFirstFrame}
            onLoadedData={paintFirstFrame}
            onSeeked={capturePosterFrame}
            onDurationChange={() => {
              const el = videoRef.current;
              if (el && Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
            }}
            onEnded={() => onPlayingChange(false)}
          />
        ) : null}
        {stillSrc && !playing ? (
          <img
            src={stillSrc}
            alt=""
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover"
          />
        ) : null}

        <button
          type="button"
          onClick={() => {
            const el = videoRef.current;
            if (el && !playing) el.muted = false;
            onPlayingChange(!playing);
          }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/15 text-white transition hover:bg-black/25"
          aria-label={playing ? `Pause ${video.title}` : `Play ${video.title}`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            {playing ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
          </span>
        </button>

        {durationLabel ? (
          <p className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {durationLabel}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">{video.title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{video.description}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            {video.filename}
            {durationLabel ? ` · ${durationLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {saving
            ? progressLabel || "Preparing video…"
            : ios
              ? "Save to Photos"
              : "Download"}
        </button>
        {ipad ? (
          <p className="text-[11px] leading-4 text-slate-500">
            Opens the clip in a new tab. Tap the Share icon, then Save Video — that is the Photos option.
          </p>
        ) : ios ? (
          <p className="text-[11px] leading-4 text-slate-500">
            Stays on this page. When the share sheet opens, tap Save Video — that is the Photos option.
            Ignore Save to Files.
          </p>
        ) : null}
      </div>
    </article>
  );
}
