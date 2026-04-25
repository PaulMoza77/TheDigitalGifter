import React from "react";
import type { ClientStat } from "@/components/client/types";
import { Activity, Bookmark, Coins, Sparkles } from "lucide-react";

type Props = {
  stats: ClientStat[];
};

function getIcon(icon: ClientStat["icon"]) {
  switch (icon) {
    case "coins":
      return Coins;
    case "bookmark":
      return Bookmark;
    case "activity":
      return Activity;
    case "sparkles":
    default:
      return Sparkles;
  }
}

export default function ClientStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = getIcon(stat.icon);

        return (
          <div
            key={stat.label}
            className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-400">
                  {stat.label}
                </div>

                <div className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-3xl">
                  {stat.value}
                </div>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-11 sm:w-11">
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 text-sm text-zinc-500">{stat.helper}</div>
          </div>
        );
      })}
    </div>
  );
}