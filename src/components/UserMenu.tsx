// FILE: src/components/UserMenu.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function UserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
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
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#11131c]/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
              navigate("/generator");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white transition hover:bg-white/8"
          >
            <Wand2 className="h-4 w-4" />
            Generator
          </button>

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