// FILE: src/components/UserMenu.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Shield, Users, Wand2, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountOverview } from "@/hooks/useAccountOverview";

export default function UserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { loading, isAdmin, affiliateEarnings } = useAccountOverview();

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

  React.useEffect(() => {
    if (!open) return;

    function handleResize() {
      if (window.innerWidth < 1024) {
        setOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  function goTo(path: string) {
    setOpen(false);
    navigate(path);
  }

  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    "";

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "Your account";

  const email = user?.email ?? "";

  const initials = displayName
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutGrid,
      action: () => goTo("/account/dashboard"),
      badge: null,
    },
    {
      label: "Affiliate",
      icon: Users,
      action: () => goTo("/account/affiliate"),
      badge: loading ? "..." : `$${affiliateEarnings.toFixed(2)}`,
    },
    {
      label: "Generator",
      icon: Wand2,
      action: () => goTo("/generator"),
      badge: null,
    },
    ...(isAdmin
      ? [
          {
            label: "Admin Panel",
            icon: Shield,
            action: () => goTo("/admin"),
            badge: null,
          },
        ]
      : []),
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
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
          <span className="text-sm font-semibold text-white">{initials || "U"}</span>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="User avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-white">
                    {initials || "U"}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {displayName}
                </div>
                {email ? (
                  <div className="truncate text-xs text-zinc-500">{email}</div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              aria-label="Close user menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>

                  {item.badge ? (
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div className="my-2 h-px bg-white/10" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-red-200 transition hover:bg-red-500/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-300/10 bg-red-500/10">
                <LogOut className="h-4 w-4" />
              </span>
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}