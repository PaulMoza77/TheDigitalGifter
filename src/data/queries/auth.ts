import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export type LoggedInUser = {
  id: string;
  email: string | null;
};

export function useLoggedInUserQuery() {
  return useQuery<LoggedInUser | null, Error>({
    queryKey: authKeys.me,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const u = data.user;
      if (!u) return null;

      return { id: u.id, email: u.email ?? null };
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: true,
  });
}