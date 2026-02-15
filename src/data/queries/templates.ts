import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TemplateSummary } from "@/types/templates";

export const templateKeys = {
  all: ["templates"] as const,
};

export function useTemplatesQuery() {
  return useQuery<TemplateSummary[], Error>({
    queryKey: templateKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates") // 🔁 asigură-te că tabela se numește exact așa
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as TemplateSummary[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}