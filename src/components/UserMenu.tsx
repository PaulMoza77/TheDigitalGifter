import { toast } from "sonner";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLoggedInUserQuery } from "@/data";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = useLoggedInUserQuery();
  const { isAdmin } = useAdminAuth(false);

  // ✅ supabase auth: if no user => not logged in
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

  // You said you moved to Supabase; your useLoggedInUserQuery returns { id, email }
  // If you have avatar in profile table, fetch it in useUserProfileQuery instead.
  const userImage = null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group rounded-full flex items-center text-sm border border-white/30 bg-white/10 hover:bg-white/20 transition will-change-transform hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-white/50">
          {userImage ? (
            <img
              src={userImage}
              alt="User avatar"
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48 bg-[rgba(30,30,40,0.98)] backdrop-blur-xl border border-white/20 text-white"
      >
        {isAdmin && (
          <>
            <DropdownMenuItem
              onClick={() => navigate("/admin")}
              className="cursor-pointer hover:bg-white/10 focus:bg-white/10"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/20" />
          </>
        )}

        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          className="cursor-pointer hover:bg-red-500/20 focus:bg-red-500/20 text-red-200"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}