import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export default function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("❌ Sign-out failed:", error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
    >
      Sign Out
    </button>
  );
}
