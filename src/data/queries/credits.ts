import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const creditsKeys = {
  all: ["credits"] as const,
};

export function useUserCreditsQuery() {
  return useQuery<number, Error>({
    queryKey: creditsKeys.all,
    queryFn: async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[useUserCreditsQuery] getSession error:", sessionError);
        throw sessionError;
      }

      const user = session?.user;
      if (!user?.id) {
        return 0;
      }

      const { data, error } = await supabase
        .from("user_credits_balance_view")
        .select("credits_balance")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[useUserCreditsQuery] credits load failed:", error);
        return 0;
      }

      return Number(data?.credits_balance ?? 0);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}