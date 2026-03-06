// FILE: src/components/client/types.ts
export type ClientStat = {
  label: string;
  value: string;
  helper: string;
  icon: "sparkles" | "coins" | "bookmark" | "activity";
};

export type ClientGeneration = {
  id: string;
  title: string;
  occasion: string;
  style: string;
  status: "Completed" | "Processing" | "Saved";
  createdAt: string;
  imageUrl?: string | null;
};

export type ClientDashboardData = {
  stats: ClientStat[];
  recentGenerations: ClientGeneration[];
};