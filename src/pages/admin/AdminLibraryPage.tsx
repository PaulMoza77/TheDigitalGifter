import React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Library, Search, Share2 } from "lucide-react";

import LibraryVideoCard from "@/features/admin-library/LibraryVideoCard";
import {
  CHRISTMAS_LIBRARY_KINDS,
  LIBRARY_CATEGORIES,
  LIBRARY_VIDEOS,
  countChristmasKind,
  searchLibraryCatalog,
  type LibraryCategoryId,
  type LibraryKind,
  type LibraryVideo,
} from "@/features/admin-library/catalog";
import { clipFactoryApi } from "@/features/clip-factory/api";
import { longFormApi } from "@/features/long-form-studio/api";
import BulkScheduleDialog from "@/features/social-publisher/BulkScheduleDialog";
import PublishReelDrawer from "@/features/social-publisher/PublishReelDrawer";
import { socialPublisherApi } from "@/features/social-publisher/api";
import { resolveDefaultTimezone } from "@/features/social-publisher/timezone";

type CategoryFilter = LibraryCategoryId | "all";

export default function AdminLibraryPage() {
  const [category, setCategory] = React.useState<CategoryFilter>("christmas_reels");
  const [kind, setKind] = React.useState<LibraryKind>("reel");
  const [query, setQuery] = React.useState("");
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [publisher, setPublisher] = React.useState<LibraryVideo | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [factoryVideos, setFactoryVideos] = React.useState<LibraryVideo[]>([]);
  const [timezone, setTimezone] = React.useState(() =>
    resolveDefaultTimezone({
      browserTimezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
    }),
  );

  React.useEffect(() => {
    void socialPublisherApi
      .bootstrap()
      .then((data) => {
        setTimezone(
          resolveDefaultTimezone({
            settingsTimezone: data.timezone,
            browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        );
      })
      .catch(() => {
        /* keep browser/UTC fallback */
      });
  }, []);

  React.useEffect(() => {
    void Promise.all([
      clipFactoryApi.dynamicLibrary().catch(() => ({ videos: [] as Array<Record<string, unknown>> })),
      longFormApi.libraryVideos().catch(() => ({ videos: [] as Array<Record<string, unknown>> })),
    ]).then(([factory, longForm]) => {
      const factoryRows = (factory.videos || []).map((row) => ({
        id: String(row.id),
        title: String(row.title || "Clip Factory"),
        description: String(row.description || ""),
        src: String(row.src || ""),
        filename: String(row.filename || "clip.mp4"),
        category: (row.category as LibraryCategoryId) || "clip_factory",
        kind: (row.kind as LibraryKind) || "reel",
        durationSeconds: typeof row.durationSeconds === "number" ? row.durationSeconds : undefined,
        poster: typeof row.poster === "string" ? row.poster : undefined,
        width: typeof row.width === "number" ? row.width : 1080,
        height: typeof row.height === "number" ? row.height : 1920,
      }));
      const longRows = (longForm.videos || []).map((row) => ({
        id: String(row.id),
        title: String(row.title || "Long-form"),
        description: String(row.description || ""),
        src: String(row.src || ""),
        filename: String(row.filename || "long-form.mp4"),
        category: "long_form" as const,
        kind: "long_form" as const,
        durationSeconds: typeof row.durationSeconds === "number" ? row.durationSeconds : undefined,
        poster: typeof row.poster === "string" ? row.poster : undefined,
        width: typeof row.width === "number" ? row.width : 1920,
        height: typeof row.height === "number" ? row.height : 1080,
      }));
      setFactoryVideos([...longRows, ...factoryRows]);
    });
  }, []);

  const catalog = React.useMemo(() => [...factoryVideos, ...LIBRARY_VIDEOS], [factoryVideos]);
  const kindFilter = category === "christmas_reels" ? kind : "all";
  const videos = React.useMemo(
    () => searchLibraryCatalog(catalog, query, category, kindFilter),
    [catalog, query, category, kindFilter],
  );
  const christmasTotal = LIBRARY_VIDEOS.filter((item) => item.category === "christmas_reels").length;
  const totalLabel =
    category === "christmas_reels"
      ? `${videos.length} of ${christmasTotal} Christmas items`
      : `${videos.length} of ${catalog.length} items`;
  const selectedVideos = videos.filter((item) => item.kind === "reel" && selectedIds.includes(item.id));

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Media library</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
              <Library className="h-7 w-7 text-slate-300" />
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Finished Reels, Shorts, Photos, and long-form ambience. Preview, save, and schedule.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <LibraryNavBadge to="/admin/social-accounts" icon={Share2} label="Social Accounts" />
              <LibraryNavBadge to="/admin/publishing" icon={CalendarClock} label="Publishing" />
            </div>
            <p className="text-sm text-slate-400">{totalLabel}</p>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={category === "all"} label="All" onClick={() => setCategory("all")} />
            {LIBRARY_CATEGORIES.map((item) => (
              <FilterChip
                key={item.id}
                active={category === item.id}
                label={item.label}
                onClick={() => {
                  setCategory(item.id);
                  if (item.id === "christmas_reels") setKind("reel");
                }}
              />
            ))}
          </div>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or filename"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/50"
            />
          </label>
        </div>

        {category === "christmas_reels" ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {CHRISTMAS_LIBRARY_KINDS.map((item) => (
              <KindBadge
                key={item.id}
                active={kind === item.id}
                label={item.label}
                count={countChristmasKind(item.id)}
                onClick={() => setKind(item.id)}
              />
            ))}
          </div>
        ) : null}

        {category !== "all" ? (
          <p className="mb-4 text-sm text-slate-400">
            {category === "christmas_reels"
              ? CHRISTMAS_LIBRARY_KINDS.find((item) => item.id === kind)?.description
              : LIBRARY_CATEGORIES.find((item) => item.id === category)?.description}
          </p>
        ) : null}

        {selectedVideos.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3">
            <p className="text-sm text-indigo-100">{selectedVideos.length} Reels selected</p>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white"
            >
              Schedule batch
            </button>
          </div>
        ) : null}

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">
            No items match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <LibraryVideoCard
                key={video.id}
                video={video}
                playing={playingId === video.id}
                onPlayingChange={(next) => setPlayingId(next ? video.id : null)}
                selected={selectedIds.includes(video.id)}
                onToggleSelect={
                  video.kind === "reel"
                    ? () =>
                        setSelectedIds((current) =>
                          current.includes(video.id)
                            ? current.filter((id) => id !== video.id)
                            : [...current, video.id],
                        )
                    : undefined
                }
                onShare={video.kind === "reel" ? () => setPublisher(video) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {publisher ? (
        <PublishReelDrawer video={publisher} timezone={timezone} onClose={() => setPublisher(null)} />
      ) : null}
      {bulkOpen ? (
        <BulkScheduleDialog
          videos={selectedVideos}
          timezone={timezone}
          onClose={() => setBulkOpen(false)}
          onScheduled={() => setSelectedIds([])}
        />
      ) : null}
    </div>
  );
}

function LibraryNavBadge({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50"
    >
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </Link>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function KindBadge({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
        active
          ? "border-amber-300/50 bg-amber-400/20 text-amber-50"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
      ].join(" ")}
    >
      {label}
      <span className="ml-1.5 text-xs font-medium opacity-70">{count}</span>
    </button>
  );
}
