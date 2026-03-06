// FILE: src/components/client/client-demo.ts
import type { ClientDashboardData } from "@/components/client/types";

export const clientDashboardDemo: ClientDashboardData = {
  stats: [
    {
      label: "Total Generations",
      value: "24",
      helper: "All-time creations",
      icon: "sparkles",
    },
    {
      label: "Remaining Credits",
      value: "12",
      helper: "Ready to use",
      icon: "coins",
    },
    {
      label: "Saved Results",
      value: "8",
      helper: "Bookmarked outputs",
      icon: "bookmark",
    },
    {
      label: "Recent Activity",
      value: "5",
      helper: "Last 7 days",
      icon: "activity",
    },
  ],
  recentGenerations: [
    {
      id: "gen_1",
      title: "Birthday Portrait",
      occasion: "Birthday",
      style: "Cinematic",
      status: "Completed",
      createdAt: "2 hours ago",
      imageUrl: null,
    },
    {
      id: "gen_2",
      title: "Pet Memory Frame",
      occasion: "Pets",
      style: "Warm Studio",
      status: "Saved",
      createdAt: "Yesterday",
      imageUrl: null,
    },
    {
      id: "gen_3",
      title: "Couple Anniversary",
      occasion: "Anniversary",
      style: "Golden Glow",
      status: "Processing",
      createdAt: "2 days ago",
      imageUrl: null,
    },
  ],
};