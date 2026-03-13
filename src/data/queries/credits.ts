import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type LedgerRow = {
  direction: "in" | "out" | null;
  credits: number | string | null;
};

export const creditsKeys = {
  all: ["credits"] as const,
};

export async function getCreditsBalance(userEmail: string): Promise<number> {
  const normalizedEmail = (userEmail || "").trim().toLowerCase();

  if (!normalizedEmail) return 0;

  const { data, error } = await supabase
    .from("credits_ledger")
    .select("direction, credits")
    .eq("user_convex_id", normalizedEmail);

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
      const normalizedEmail = (user?.email || "").trim().toLowerCase();

      if (!normalizedEmail) {
        return 0;
      }

      return getCreditsBalance(normalizedEmail);
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}