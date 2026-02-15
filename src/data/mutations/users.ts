import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type EnsureUserProfileArgs = {
  userId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

export type EnsureUserProfileResult = {
  ok: true;
};

export function useEnsureUserProfileMutation() {
  return useMutation<EnsureUserProfileResult, Error, EnsureUserProfileArgs>({
    mutationKey: ["users", "ensureProfile"],
    mutationFn: async ({ userId, email, name, avatarUrl }) => {
      const { error } = await supabase.from("user_profiles").upsert(
        {
          id: userId,
          email: email ?? null,
          name: name ?? null,
          avatar_url: avatarUrl ?? null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "id" }
      );

      if (error) {
        throw new Error(error.message || "Failed to ensure user profile");
      }

      return { ok: true };
    },
  });
}