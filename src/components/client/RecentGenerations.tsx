import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  ImageIcon,
  Sparkles,
  Wand2,
} from "lucide-react";

import type { ClientGeneration } from "@/components/client/types";
import { Button } from "@/components/ui/button";
import ClientEmptyState from "@/components/client/ClientEmptyState";

type Props = {
  items?: ClientGeneration[] | null;
};

function badgeClass(status: ClientGeneration["status"]) {
  if (status === "Completed") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "Processing") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-300";
}

function GenerationThumbnail({
  imageUrl,
  title,
}: {
  imageUrl?: string | null;
  title: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const normalizedUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";

  if (!normalizedUrl || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] sm:h-16 sm:w-16">
        <ImageIcon className="h-5 w-5 text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:h-16 sm:w-16">
      <img
        src={normalizedUrl}
        alt={title}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function RecentGenerations({ items }: Props) {
  const safeItems = React.useMemo(
    () => (Array.isArray(items) ? items.filter(Boolean) : []),
    [items]
  );

  if (safeItems.length === 0) {
    return (
      <ClientEmptyState
        title="No generations yet"
        description="Your recent creations will appear here once you start generating."
      />
    );
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">
            Recent Generations
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Your latest creations and saved results.
          </p>
        </div>

        <Button
          asChild
          variant="secondary"
          className="w-full rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 sm:w-auto"
        >
          <Link to="/generator">
            <Wand2 className="mr-2 h-4 w-4" />
            Create New
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {safeItems.map((item) => {
          const href =
            item.resultHref || `/funnel/result?id=${encodeURIComponent(item.id)}`;

          return (
            <Link
              key={item.id}
              to={href}
              className="block rounded-3xl transition focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                <GenerationThumbnail imageUrl={item.imageUrl} title={item.title} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">
                        {item.title}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.occasion}</span>
                        </span>

                        <span className="text-zinc-600">•</span>

                        <span className="truncate">{item.style}</span>
                      </div>
                    </div>

                    <div
                      className={[
                        "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                        badgeClass(item.status),
                      ].join(" ")}
                    >
                      {item.status}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" />
                      {item.createdAt}
                    </div>

                    <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
                      View Result
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}