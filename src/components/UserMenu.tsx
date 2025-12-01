import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import { useLoggedInUserQuery } from "@/data";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserMenu() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { data: user } = useLoggedInUserQuery();
  const { isAdmin } = useAdminAuth(false);
  const navigate = useNavigate();

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
