import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";

export default function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  async function handleSignOut(): Promise<void> {
    try {
      await signOut();
    } catch (e) {
      console.error("Sign-out failed:", e);
      toast.error("Sign-out failed. Please try again.");
    }
  }

  return (
    <button
      onClick={() => {
        void handleSignOut();
      }}
      className="rounded-full px-3 py-2 text-sm border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-red-100 transition will-change-transform hover:scale-[1.04]"
    >
      Sign Out
    </button>
  );
}
