import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const creditsKeys = {
  all: ["credits"] as const,
};

export function useUserCreditsQuery() {
  return useQuery<number, Error>({
    queryKey: creditsKeys.all,
    queryFn: async () => {
      // 1️⃣ Get logged-in user
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;
      if (!user) return 0;

      // 2️⃣ Get credits from DB
      const { data, error } = await supabase
        .from("profiles") // 🔁 schimbă dacă tabelul tău are alt nume
        .select("credits")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      return Number(data?.credits ?? 0);
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: true,
  });
}