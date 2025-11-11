import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBootstrapUser() {
  const ensureUserProfile = useMutation(api.users.ensureUserProfile);
  const userProfile = useQuery(api.users.getMe, { userId: "skip" });

  useEffect(() => {
    // We don't have a userId here, so this hook just returns the user profile if it exists
    ensureUserProfile({ userId: "skip" }).catch((err) =>
      console.error("Failed to bootstrap user:", err)
    );
  }, [ensureUserProfile]);

  return userProfile;
}
