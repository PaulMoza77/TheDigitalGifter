// FILE: src/components/client/types.ts

export type ClientStat = {
  label: string;
  value: string;
  helper: string;
  icon: "sparkles" | "coins" | "bookmark" | "activity";
};

export type ClientGenerationStatus = "Completed" | "Processing" | "Saved";

export type ClientGeneration = {
  id: string;
  title: string;
  occasion: string;
  style: string;
  status: ClientGenerationStatus;
  createdAt: string;
  imageUrl?: string | null;
  resultHref?: string;
};

export type ClientDashboardData = {
  stats: ClientStat[];
  recentGenerations: ClientGeneration[];
};