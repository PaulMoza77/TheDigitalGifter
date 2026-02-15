import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const userKeys = {
  profile: (userId?: string | null) =>
    ["userProfile", userId ?? "anonymous"] as const,
};

// ✅ adaptează câmpurile după tabela ta
export type UserProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  credits?: number | null;
  created_at?: string | null;
  // ...alte coloane dacă ai
};

export function useUserProfileQuery(userId?: string | null) {
  return useQuery<UserProfileRow | null, Error>({
    queryKey: userKeys.profile(userId),
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_profiles") // 🔁 schimbă dacă tabela ta are alt nume (ex: profiles)
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      return (data ?? null) as UserProfileRow | null;
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}