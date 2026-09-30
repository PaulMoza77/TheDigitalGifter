import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clapperboard } from "lucide-react";

import {
  CHRISTMAS_FACTORY_200_SHORTS,
  CF200_PRODUCTION_ID,
} from "@/features/admin-library/christmasFactory200Catalog";
import type { LibraryVideo } from "@/features/admin-library/catalog";

const CATEGORIES = ["ALL", "JOY", "NOSTALGIA", "SANTA", "NYC", "EUROPE", "COZY", "WOW", "ELEGANT"] as const;
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

function categoryOf(video: LibraryVideo): string {
  const tag = (video.tags || []).find((item) => item in BUCKET_TO_LABEL);
  return tag ? BUCKET_TO_LABEL[tag] : "JOY";
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
          ready
        </p>
      </div>
      <div className="space-y-1 px-3 py-3">
        <p className="truncate font-mono text-[11px] text-slate-400">{video.id.replace(/^short-/, "")}</p>
        <p className="line-clamp-2 text-sm font-medium text-slate-100">{video.title.replace(/^Factory · /, "")}</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">5s · silent · RAW master</p>
      </div>
    </article>
  );
}

export default function ChristmasFactoryReviewPage() {
  const [filter, setFilter] = React.useState<(typeof CATEGORIES)[number]>("ALL");
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const videos = React.useMemo(() => {
    if (filter === "ALL") return CHRISTMAS_FACTORY_200_SHORTS;
    return CHRISTMAS_FACTORY_200_SHORTS.filter((video) => categoryOf(video) === filter);
  }, [filter]);

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
              {CHRISTMAS_FACTORY_200_SHORTS.length} completed 5-second Kling masters. Click a card to preview.
              Production {CF200_PRODUCTION_ID}.
            </p>
          </div>
          <p className="text-sm text-slate-400">{videos.length} shown</p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
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
            </button>
          ))}
        </div>

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
      </div>
    </div>
  );
}
