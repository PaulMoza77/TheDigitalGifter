import React from "react";
import { Library, Search } from "lucide-react";

import LibraryVideoCard from "@/features/admin-library/LibraryVideoCard";
import {
  LIBRARY_CATEGORIES,
  LIBRARY_VIDEOS,
  searchLibraryVideos,
  type LibraryCategoryId,
} from "@/features/admin-library/catalog";

type CategoryFilter = LibraryCategoryId | "all";

export default function AdminLibraryPage() {
  const [category, setCategory] = React.useState<CategoryFilter>("christmas_reels");
  const [query, setQuery] = React.useState("");
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const videos = React.useMemo(() => searchLibraryVideos(query, category), [query, category]);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
              <Library className="h-7 w-7 text-slate-300" />
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Preview clips in place, see how long each one is, and save them without leaving this page.
            </p>
          </div>
          <p className="text-sm text-slate-400">
            {videos.length} of {LIBRARY_VIDEOS.length} videos
          </p>
        </header>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={category === "all"}
              label="All"
              onClick={() => setCategory("all")}
            />
            {LIBRARY_CATEGORIES.map((item) => (
              <FilterChip
                key={item.id}
                active={category === item.id}
                label={item.label}
                onClick={() => setCategory(item.id)}
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

        {category !== "all" ? (
          <p className="mb-4 text-sm text-slate-400">
            {LIBRARY_CATEGORIES.find((item) => item.id === category)?.description}
          </p>
        ) : null}

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">
            No videos match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <LibraryVideoCard
                key={video.id}
                video={video}
                playing={playingId === video.id}
                onPlayingChange={(next) => setPlayingId(next ? video.id : null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
