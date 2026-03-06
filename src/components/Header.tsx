// FILE: src/components/Header.tsx
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import * as React from "react";

import { CreditsDisplay } from "./CreditsDisplay";
import { SignInButton } from "./SignInButton";
import UserMenu from "./UserMenu";
import { Logo } from "./ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onBuyCredits?: () => void;
}

const navItems = [
  { label: "Home", to: "/" },
  { label: "Templates", to: "/templates" },
  { label: "Generator", to: "/generator" },
];

export default function Header({ onBuyCredits }: HeaderProps) {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(4,8,18,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="Go to homepage" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
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
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-full border border-white/10 bg-white/10" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <SignInButton />
          )}

          <CreditsDisplay onBuyCredits={onBuyCredits} />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[rgba(4,8,18,0.92)] lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  {({ isActive }) => (
                    <span
                      className={cn(
                        "flex rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="mt-2 flex flex-col gap-3">
              <CreditsDisplay onBuyCredits={onBuyCredits} />

              {loading ? (
                <div className="h-10 w-full animate-pulse rounded-2xl border border-white/10 bg-white/10" />
              ) : isAuthenticated ? (
                <div className="flex justify-start">
                  <UserMenu />
                </div>
              ) : (
                <div className="flex justify-start">
                  <SignInButton />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}