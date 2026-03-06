// FILE: src/components/client/ClientStatsCards.tsx
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = getIcon(stat.icon);

        return (
          <div
            key={stat.label}
            className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-400">{stat.label}</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {stat.value}
                </div>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
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