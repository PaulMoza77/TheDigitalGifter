import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clapperboard, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  CHRISTMAS_FACTORY_200_SHORTS,
  CF200_PRODUCTION_ID,
} from "@/features/admin-library/christmasFactory200Catalog";
import {
  appendLibraryQueryParam,
  librarySrcPath,
  type LibraryVideo,
} from "@/features/admin-library/catalog";
import {
  getCachedLibraryVideoFile,
  isIosLikeDevice,
  isShareGestureLost,
  isUserShareCancel,
  rememberLibraryVideoFile,
  fetchLibraryVideoFile,
  shareLibraryVideoFile,
  triggerBlobDownload,
} from "@/features/admin-library/saveLibraryVideo";

const CATEGORIES = ["ALL", "JOY", "NOSTALGIA", "SANTA", "NYC", "EUROPE", "COZY", "WOW", "ELEGANT"] as const;
const CATEGORY_SECTIONS = CATEGORIES.filter((item) => item !== "ALL");
const BUCKET_TO_LABEL: Record<string, string> = {
  joy: "JOY",
  nostalgia: "NOSTALGIA",
  santa: "SANTA",
  nyc: "NYC",
  europe: "EUROPE",
  cozy: "COZY",
  wow: "WOW",
  moody: "ELEGANT",
};

type SortMode = "number" | "category" | "title";

function categoryOf(video: LibraryVideo): string {
  const tag = (video.tags || []).find((item) => item in BUCKET_TO_LABEL);
  return tag ? BUCKET_TO_LABEL[tag] : "JOY";
}

function factoryNumber(video: LibraryVideo): number {
  const fromId = /cf200-(\d+)/i.exec(video.id);
  if (fromId) return Number(fromId[1]);
  const fromFile = /cf200_(\d+)/i.exec(video.filename);
  if (fromFile) return Number(fromFile[1]);
  return Number.MAX_SAFE_INTEGER;
}

function compareFactoryVideos(a: LibraryVideo, b: LibraryVideo, sort: SortMode): number {
  if (sort === "title") {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
  }
  if (sort === "category") {
    const byCategory =
      CATEGORY_SECTIONS.indexOf(categoryOf(a) as (typeof CATEGORY_SECTIONS)[number]) -
      CATEGORY_SECTIONS.indexOf(categoryOf(b) as (typeof CATEGORY_SECTIONS)[number]);
    if (byCategory !== 0) return byCategory;
  }
  const byNumber = factoryNumber(a) - factoryNumber(b);
  if (byNumber !== 0) return byNumber;
  return a.id.localeCompare(b.id);
}

function matchesQuery(video: LibraryVideo, needle: string): boolean {
  if (!needle) return true;
  return [video.title, video.description, video.filename, video.id, categoryOf(video), ...(video.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function FactoryCard({
  video,
  playing,
  onToggle,
}: {
  video: LibraryVideo;
  playing: boolean;
  onToggle: () => void;
}) {
  const category = categoryOf(video);
  const href = librarySrcPath(video.src);
  const [saving, setSaving] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  const saveLockRef = React.useRef(false);

  React.useEffect(() => {
    setIos(isIosLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform));
  }, []);

  async function onDownload(event: React.MouseEvent) {
    event.stopPropagation();
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      let file = getCachedLibraryVideoFile(href);
      if (!file) {
        file = await fetchLibraryVideoFile(href, video.filename);
        rememberLibraryVideoFile(href, file);
      }
      if (!ios) {
        triggerBlobDownload(file, video.filename);
        toast.success(`Downloading ${video.filename}`);
        return;
      }
      setSaving(false);
      saveLockRef.current = false;
      try {
        await shareLibraryVideoFile(file);
        toast.success("Share sheet opened — tap Save Video");
      } catch (error) {
        if (isUserShareCancel(error)) return;
        if (isShareGestureLost(error)) {
          const downloadHref = appendLibraryQueryParam(
            appendLibraryQueryParam(href, "download", "1"),
            "filename",
            video.filename,
          );
          window.open(downloadHref, "_blank", "noopener,noreferrer");
          toast.message("Opened the file — use Share → Save Video");
          return;
        }
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="relative aspect-[9/16] bg-black">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={video.src}
          poster={video.poster}
          muted
          playsInline
          loop
          preload="metadata"
          controls={playing}
          autoPlay={playing}
        />
        {!playing ? (
          <button
            type="button"
            onClick={onToggle}
            className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"
            aria-label={`Preview ${video.id}`}
          >
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold tracking-wide">▶ 5s</span>
          </button>
        ) : null}
        <p className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
          {category}
        </p>
        <p className="absolute right-2 top-2 rounded-full bg-emerald-500/80 px-2 py-0.5 text-[11px] font-semibold text-white">
          #{String(factoryNumber(video)).padStart(3, "0")}
        </p>
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="truncate font-mono text-[11px] text-slate-400">{video.id.replace(/^short-/, "")}</p>
        <p className="line-clamp-2 text-sm font-medium text-slate-100">{video.title.replace(/^Factory · /, "")}</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">5s · silent · RAW master</p>
        <button
          type="button"
          onClick={(event) => void onDownload(event)}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {saving ? "Preparing…" : ios ? "Save to Photos" : "Download"}
        </button>
      </div>
    </article>
  );
}

export default function ChristmasFactoryReviewPage() {
  const [filter, setFilter] = React.useState<(typeof CATEGORIES)[number]>("ALL");
  const [sort, setSort] = React.useState<SortMode>("category");
  const [query, setQuery] = React.useState("");
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: CHRISTMAS_FACTORY_200_SHORTS.length };
    for (const label of CATEGORY_SECTIONS) counts[label] = 0;
    for (const video of CHRISTMAS_FACTORY_200_SHORTS) {
      const label = categoryOf(video);
      counts[label] = (counts[label] || 0) + 1;
    }
    return counts;
  }, []);

  const videos = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = CHRISTMAS_FACTORY_200_SHORTS.filter((video) => {
      if (filter !== "ALL" && categoryOf(video) !== filter) return false;
      return matchesQuery(video, needle);
    });
    return [...filtered].sort((a, b) => compareFactoryVideos(a, b, sort));
  }, [filter, query, sort]);

  const grouped = React.useMemo(() => {
    if (filter !== "ALL" || sort !== "category") return null;
    const groups: Array<{ label: string; items: LibraryVideo[] }> = [];
    for (const label of CATEGORY_SECTIONS) {
      const items = videos.filter((video) => categoryOf(video) === label);
      if (items.length) groups.push({ label, items });
    }
    return groups;
  }, [filter, sort, videos]);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/admin/library" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-3.5 w-3.5" />
              Library
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <Clapperboard className="h-7 w-7 text-amber-200" />
              Christmas Factory RAW
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              {CHRISTMAS_FACTORY_200_SHORTS.length} completed 5-second Kling masters. Preview, search by title/id,
              and download any RAW master. Production {CF200_PRODUCTION_ID}.
            </p>
          </div>
          <p className="text-sm text-slate-400">{videos.length} shown</p>
        </header>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                  filter === item
                    ? "border-amber-300/50 bg-amber-400/20 text-amber-50"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
                ].join(" ")}
              >
                {item}
                <span className="ml-1.5 opacity-70">{categoryCounts[item] || 0}</span>
              </button>
            ))}
          </div>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, id, or tag"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-300/40"
            />
          </label>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              { id: "category", label: "By category" },
              { id: "number", label: "By number" },
              { id: "title", label: "A–Z title" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSort(item.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                sort === item.id
                  ? "border-slate-200/40 bg-slate-100/10 text-slate-50"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">
            No RAW masters match this filter.
          </div>
        ) : grouped ? (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.label}>
                <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-slate-800 pb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">{group.label}</h2>
                  <p className="text-xs text-slate-500">{group.items.length} clips</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {group.items.map((video) => (
                    <FactoryCard
                      key={video.id}
                      video={video}
                      playing={playingId === video.id}
                      onToggle={() => setPlayingId((current) => (current === video.id ? null : video.id))}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((video) => (
              <FactoryCard
                key={video.id}
                video={video}
                playing={playingId === video.id}
                onToggle={() => setPlayingId((current) => (current === video.id ? null : video.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
