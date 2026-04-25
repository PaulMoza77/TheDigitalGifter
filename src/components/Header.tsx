// FILE: src/components/Header.tsx
import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  LogOut,
  Menu,
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
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  onBuyCredits?: () => void;
}

type AffiliateEarningRow = {
  amount: number | string | null;
};

const navItems = [
  { label: "Home", to: "/" },
  { label: "Templates", to: "/templates" },
  { label: "Generator", to: "/generator" },
];

export default function Header({ onBuyCredits }: HeaderProps) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const isAuthenticated = !!user;

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [affiliateEarnings, setAffiliateEarnings] = React.useState(0);
  const [earningsLoading, setEarningsLoading] = React.useState(true);

  React.useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("resize", close);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function loadMobileAccountData() {
      try {
        if (!user?.id) {
          if (!mounted) return;
          setIsAdmin(false);
          setAffiliateEarnings(0);
          setEarningsLoading(false);
          return;
        }

        setEarningsLoading(true);

        const [
          { data: adminData, error: adminError },
          { data: earningsRows, error: earningsError },
        ] = await Promise.all([
          supabase.rpc("is_admin"),
          supabase
            .from("affiliate_earnings")
            .select("amount")
            .eq("user_id", user.id),
        ]);

        if (!mounted) return;

        setIsAdmin(adminError ? false : Boolean(adminData));

        if (earningsError) {
          console.error("[Header] affiliate_earnings query error:", earningsError);
          setAffiliateEarnings(0);
        } else {
          const total = ((earningsRows ?? []) as AffiliateEarningRow[]).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0
          );
          setAffiliateEarnings(total);
        }
      } catch (error) {
        console.error("[Header] mobile account data error:", error);
        if (!mounted) return;
        setIsAdmin(false);
        setAffiliateEarnings(0);
      } finally {
        if (mounted) setEarningsLoading(false);
      }
    }

    void loadMobileAccountData();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

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
        <div className="flex items-center gap-8">
          <Link
            to="/"
            aria-label="Go to homepage"
            className="shrink-0"
            onClick={() => setMobileOpen(false)}
          >
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
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[rgba(4,8,18,0.96)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
            {loading ? (
              <div className="h-11 w-full animate-pulse rounded-2xl border border-white/10 bg-white/10" />
            ) : isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-start pb-2">
                  <CreditsDisplay onBuyCredits={onBuyCredits} />
                </div>

                <button
                  type="button"
                  onClick={() => goTo("/")}
                  className="flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/templates")}
                  className="flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
                >
                  Templates
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/account/dashboard")}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/account/affiliate")}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
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
                  onClick={() => goTo("/generator")}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
                >
                  <Wand2 className="h-4 w-4" />
                  Generator
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => goTo("/admin")}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Panel
                  </button>
                ) : null}

                <div className="my-1 h-px bg-white/10" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-[#ffcece] transition hover:bg-white/8"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                    >
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

                <div className="flex justify-start">
                  <SignInButton />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}