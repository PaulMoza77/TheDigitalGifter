// FILE: src/components/client/UsageSummaryCard.tsx
import React from "react";
import { BarChart3, CheckCircle2, Coins, TimerReset } from "lucide-react";

type Props = {
  creditsAvailable: number;
  completedCreations: number;
  inProgress: number;
  savedItems: number;
};

export default function UsageSummaryCard({
  creditsAvailable,
  completedCreations,
  inProgress,
  savedItems,
}: Props) {
  const rows = [
    {
      icon: Coins,
      label: "Credits available",
      value: String(creditsAvailable),
    },
    {
      icon: CheckCircle2,
      label: "Completed creations",
      value: String(completedCreations),
    },
    {
      icon: TimerReset,
      label: "In progress",
      value: String(inProgress),
    },
    {
      icon: BarChart3,
      label: "Saved items",
      value: String(savedItems),
    },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur">
      <h3 className="text-lg font-semibold text-white">Usage Summary</h3>
      <p className="mt-1 text-sm text-zinc-400">Quick overview of your current activity.</p>

      <div className="mt-5 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;

          return (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                <span className="truncate text-sm text-zinc-300">{row.label}</span>
              </div>

              <span className="text-sm font-semibold text-white">{row.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}