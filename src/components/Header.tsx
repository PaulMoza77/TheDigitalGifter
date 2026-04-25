// FILE: src/components/Header.tsx
import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Shield,
  Users,
  Wand2,
  X,
} from "lucide-react";

import { CreditsDisplay } from "./CreditsDisplay";
import { SignInButton } from "./SignInButton";
import UserMenu from "./UserMenu";
import { Logo } from "./ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onBuyCredits?: () => void;
}

const desktopNavItems = [
  { label: "Home", to: "/" },
  { label: "Templates", to: "/templates" },
  { label: "Generator", to: "/generator" },
];

export default function Header({ onBuyCredits }: HeaderProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const {
    loading: overviewLoading,
    isAdmin,
    creditsRemaining,
    affiliateEarnings,
  } = useAccountOverview();

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isAuthenticated = !!user;
  const loading = authLoading || overviewLoading;

  async function handleLogout() {
    setMobileOpen(false);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  function goTo(path: string) {
    setMobileOpen(false);
    navigate(path);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(4,8,18,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            to="/"
            aria-label="Go to homepage"
            className="shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {desktopNavItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 sm:gap-3 lg:flex">
          {authLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-full border border-white/10 bg-white/10" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <SignInButton />
          )}

          <CreditsDisplay onBuyCredits={onBuyCredits} />
        </div>

        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[82vw] max-w-[360px] border-l border-white/10 bg-zinc-950 p-0 text-white sm:w-[390px] sm:max-w-[390px]"
            >
              <SheetHeader className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <SheetTitle className="flex items-center gap-3 text-left text-white">
                    <Logo />
                  </SheetTitle>

                  <SheetClose asChild>
                    <button
                      type="button"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </SheetClose>
                </div>
              </SheetHeader>

              <div className="px-5 py-6">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                    <div className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                    <div className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                  </div>
                ) : isAuthenticated ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          onBuyCredits?.();
                        }}
                        className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left"
                      >
                        <div className="flex items-center gap-2 text-sm text-zinc-300">
                          <Plus className="h-4 w-4" />
                          Credits
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-[#ffd976]">
                          {creditsRemaining}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => goTo("/account/affiliate")}
                        className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-left"
                      >
                        <div className="flex items-center gap-2 text-sm text-emerald-100">
                          <Users className="h-4 w-4" />
                          Affiliate
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-300">
                          ${affiliateEarnings.toFixed(2)}
                        </div>
                      </button>
                    </div>

                    <nav className="mt-5 space-y-2">
                      <button
                        type="button"
                        onClick={() => goTo("/account/dashboard")}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-4 text-base font-semibold text-white"
                      >
                        <LayoutGrid className="h-5 w-5 shrink-0" />
                        Dashboard
                      </button>

                      <button
                        type="button"
                        onClick={() => goTo("/account/affiliate")}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                      >
                        <Users className="h-5 w-5 shrink-0" />
                        Affiliate
                      </button>

                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => goTo("/admin")}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                        >
                          <Shield className="h-5 w-5 shrink-0" />
                          Admin Panel
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => goTo("/generator")}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                      >
                        <Wand2 className="h-5 w-5 shrink-0" />
                        Generator
                      </button>
                    </nav>

                    <div className="mt-7 border-t border-white/10 pt-5">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold text-red-200 transition hover:bg-red-500/10"
                      >
                        <LogOut className="h-5 w-5 shrink-0" />
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <nav className="space-y-2">
                      <button
                        type="button"
                        onClick={() => goTo("/generator")}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-4 text-base font-semibold text-white"
                      >
                        <Wand2 className="h-5 w-5 shrink-0" />
                        Generator
                      </button>
                    </nav>

                    <div className="mt-5">
                      <SignInButton />
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}