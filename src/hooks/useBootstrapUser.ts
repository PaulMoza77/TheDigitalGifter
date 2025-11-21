import { useEffect } from "react";
import { useLoggedInUserQuery, useEnsureUserProfileMutation } from "@/data";
import { useConvexAuth } from "convex/react";
import { queryClient, invalidateAuthCaches } from "@/data";

export function useBootstrapUser() {
  const { data: user } = useLoggedInUserQuery();
  const { mutateAsync: ensureUserProfile } = useEnsureUserProfileMutation();
  const { isAuthenticated } = useConvexAuth();

  // When user data is available, ensure profile is synced and refetch if needed
  useEffect(() => {
    if (!user?._id) {
      return;
    }

    console.log(
      "[useBootstrapUser] User data available, ensuring profile is synced",
      {
        userId: user._id,
        userName: user.name,
      }
    );

    void ensureUserProfile({ userId: user._id as string })
      .then(() => {
        console.log("[useBootstrapUser] Profile ensured successfully");
        // Refetch user data after ensuring profile is synced
        void invalidateAuthCaches();
      })
      .catch((err) => {
        console.error("[useBootstrapUser] Failed to bootstrap user:", err);
      });
  }, [ensureUserProfile, user]);

  // When auth state changes to authenticated, clear cache and let queries refetch
  useEffect(() => {
    if (isAuthenticated && !user) {
      console.log(
        "[useBootstrapUser] User authenticated but data not loaded, invalidating cache"
      );
      // Clear the entire query cache to force fresh queries
      queryClient.clear();
      void invalidateAuthCaches();
    }
  }, [isAuthenticated, user]);

  return user;
}
