import { toast } from "sonner";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLoggedInUserQuery } from "@/data";

export default function SignOutButton() {
  const { data: user } = useLoggedInUserQuery();

  // ✅ supabase auth: dacă nu ai user, nu ești autentificat
  if (!user) return null;

  async function handleSignOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      console.error("Sign-out failed:", e);
      toast.error("Sign-out failed. Please try again.");
    }
  }

  // useLoggedInUserQuery returnează { id, email } (nu mai ai user.image din Convex)
  // Dacă vrei avatar, ia-l din profile (useUserProfileQuery) și pune aici.
  const userImage: string | null = null;

  return (
    <button
      onClick={() => void handleSignOut()}
      className="group rounded-full flex items-center text-sm border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-red-100 transition will-change-transform hover:scale-[1.04]"
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