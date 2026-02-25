import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const creditsKeys = {
  all: ["credits"] as const,
};

export function useUserCreditsQuery() {
  return useQuery<number, Error>({
    queryKey: creditsKeys.all,
    queryFn: async () => {
      // 1) Get logged-in user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) return 0;

      // 2) Get credits balance from ledger view
      const { data, error } = await supabase
        .from("user_credits_balance_view")
        .select("credits_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      // If view is blocked by RLS or missing, don't hard-crash UI; show 0 and log
      if (error) {
        console.warn("[useUserCreditsQuery] credits load failed:", error);
        return 0;
      }

      return Number(data?.credits_balance ?? 0);
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: true,
  });
}