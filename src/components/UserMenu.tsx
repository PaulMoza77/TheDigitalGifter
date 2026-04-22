import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  LogOut,
  Shield,
  Wand2,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type AffiliateEarningRow = {
  amount: number | string | null;
};

export default function UserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [open, setOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [affiliateEarnings, setAffiliateEarnings] = React.useState(0);
  const [earningsLoading, setEarningsLoading] = React.useState(true);

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function loadMenuData() {
      try {
        if (!user?.id) {
          if (!mounted) return;
          setIsAdmin(false);
          setAffiliateEarnings(0);
          setEarningsLoading(false);
          return;
        }

        const [{ data: adminData, error: adminError }, { data: earningsRows, error: earningsError }] =
          await Promise.all([
            supabase.rpc("is_admin"),
            supabase
              .from("affiliate_earnings")
              .select("amount")
              .eq("user_id", user.id),
          ]);

        if (!mounted) return;

        if (adminError) {
          console.error("is_admin rpc error:", adminError);
          setIsAdmin(false);
        } else {
          setIsAdmin(Boolean(adminData));
        }

        if (earningsError) {
          console.error("affiliate_earnings query error:", earningsError);
          setAffiliateEarnings(0);
        } else {
          const total = ((earningsRows ?? []) as AffiliateEarningRow[]).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0
          );

          setAffiliateEarnings(total);
        }
      } catch (error) {
        console.error("UserMenu load error:", error);
        if (!mounted) return;
        setIsAdmin(false);
        setAffiliateEarnings(0);
      } finally {
        if (mounted) {
          setEarningsLoading(false);
        }
      }
    }

    void loadMenuData();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    "";

  const initials =
    ((user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      user?.email ||
      "U")
      .trim()
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10"
        aria-label="Open user menu"
        aria-expanded={open}
      >
        {avatar ? (
          <img
            src={avatar}
            alt="User avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold text-white">{initials}</span>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#11131c]/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/account/dashboard");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white transition hover:bg-white/8"
          >
            <LayoutGrid className="h-4 w-4" />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/account/affiliate");
            }}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-white transition hover:bg-white/8"
          >
            <span className="flex items-center gap-3">
              <Users className="h-4 w-4" />
              Affiliate
            </span>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
              {earningsLoading ? "..." : `$${affiliateEarnings.toFixed(2)}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/generator");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white transition hover:bg-white/8"
          >
            <Wand2 className="h-4 w-4" />
            Generator
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/admin");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white transition hover:bg-white/8"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </button>
          ) : null}

          <div className="my-2 h-px bg-white/10" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#ffcece] transition hover:bg-[#ffffff0a]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}