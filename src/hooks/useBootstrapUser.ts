import { useEffect } from "react";
import { useLoggedInUserQuery, useEnsureUserProfileMutation } from "@/data";

export function useBootstrapUser() {
  const { data: user } = useLoggedInUserQuery();
  const { mutateAsync: ensureUserProfile } = useEnsureUserProfileMutation();

  useEffect(() => {
    if (!user?._id) {
      return;
    }
    ensureUserProfile({ userId: user._id as string }).catch((err) =>
      console.error("Failed to bootstrap user:", err)
    );
  }, [ensureUserProfile, user?._id]);

  return user;
}
