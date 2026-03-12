import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type LedgerRow = {
  direction: "in" | "out" | null;
  credits: number | string | null;
};

export const creditsKeys = {
  all: ["credits"] as const,
};

export async function getCreditsBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("credits_ledger")
    .select("direction, credits")
    .eq("user_convex_id", userId);

  if (error) {
    console.error("[getCreditsBalance] credits load failed:", error);
    return 0;
  }

  const balance = ((data ?? []) as LedgerRow[]).reduce((sum, row) => {
    const value = Number(row.credits ?? 0);

    if (!Number.isFinite(value)) return sum;
    if (row.direction === "in") return sum + value;
    if (row.direction === "out") return sum - value;
    return sum;
  }, 0);

  return balance;
}

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

      return getCreditsBalance(user.id);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}