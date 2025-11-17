import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { useLoggedInUserQuery } from "@/data";

export default function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { data: user } = useLoggedInUserQuery();

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

  const userImage = user?.image ?? null;

  return (
    <button
      onClick={() => {
        void handleSignOut();
      }}
      className=" group rounded-full flex items-center text-sm border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-red-100 transition will-change-transform hover:scale-[1.04]"
    >
      {userImage ? (
        <img
          src={userImage}
          alt="User avatar"
          className="w-9 h-9 rounded-full object-cover border border-red-400/30"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-red-400/20 border border-red-400/30 flex items-center justify-center">
          <User className="w-5 h-5 text-red-200" />
        </div>
      )}
      <span className="hidden group-hover:block group-hover:px-2">
        Sign Out
      </span>
    </button>
  );
}
