import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const jobsKeys = {
  all: ["jobs"] as const,
};

// ✅ adaptează câmpurile după tabela ta `jobs`
export type JobRow = {
  id: string;
  created_at?: string | null;
  status?: string | null;
  // ...restul coloanelor tale
};

export function useJobsQuery() {
  return useQuery<JobRow[], Error>({
    queryKey: jobsKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs") // 🔁 numele tabelei din Supabase
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: 5 * 1000,
    refetchIntervalInBackground: true,
  });
}