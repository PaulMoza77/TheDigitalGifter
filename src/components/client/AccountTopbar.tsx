// FILE: src/components/client/AccountTopbar.tsx
import React from "react";
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

import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { supabase } from "@/lib/supabase";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type TopbarItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

type AffiliateProfileRow = {
  user_id: string;
  available_earnings: number | string | null;
};

type AffiliateEarningRow = {
  amount: number | string | null;
  status: string | null;
};

function desktopNavClass(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-all xl:px-4",
    active
      ? "border-white/10 bg-white/10 text-white"
      : "border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

function mobileNavClass(active: boolean) {
  return [
    "flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold transition-all",
    active
      ? "bg-white/10 text-white"
      : "text-zinc-200 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function getAffiliateBalance(userId: string): Promise<number> {
  const { data: earningsRows, error: earningsError } = await supabase
    .from("affiliate_earnings")
    .select("amount,status")
    .eq("affiliate_user_id", userId)
    .eq("status", "pending");

  if (!earningsError && earningsRows) {
    return (earningsRows as AffiliateEarningRow[]).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("affiliate_profiles")
    .select("user_id,available_earnings")
    .eq("user_id", userId)
    .maybeSingle<AffiliateProfileRow>();

  if (profileError) throw profileError;

  return Number(profile?.available_earnings ?? 0);
}

export default function AccountTopbar() {
  const navigate = useNavigate();
  const { loading, isAdmin, creditsRemaining, affiliateEarnings, refresh } =
    useAccountOverview();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [affiliateBalance, setAffiliateBalance] = React.useState<number>(
    Number(affiliateEarnings || 0)
  );
  const [affiliateLoading, setAffiliateLoading] = React.useState(true);

  const items: TopbarItem[] = React.useMemo(() => {
    const base: TopbarItem[] = [
      { label: "Dashboard", to: "/account/dashboard", icon: LayoutGrid },
      { label: "Affiliate", to: "/account/affiliate", icon: Users },
    ];

    if (isAdmin) {
      base.push({ label: "Admin Panel", to: "/admin", icon: Shield });
    }

    base.push({ label: "Generator", to: "/generator", icon: Wand2 });

    return base;
  }, [isAdmin]);

  const loadAffiliateBalance = React.useCallback(async () => {
    try {
      setAffiliateLoading(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      if (!user?.id) {
        setAffiliateBalance(0);
        return;
      }

      const balance = await getAffiliateBalance(user.id);
      setAffiliateBalance(balance);
    } catch (error) {
      console.error("[AccountTopbar] affiliate balance error:", error);
      setAffiliateBalance(Number(affiliateEarnings || 0));
    } finally {
      setAffiliateLoading(false);
    }
  }, [affiliateEarnings]);

  React.useEffect(() => {
    void loadAffiliateBalance();
  }, [loadAffiliateBalance]);

  React.useEffect(() => {
    setAffiliateBalance(Number(affiliateEarnings || 0));
  }, [affiliateEarnings]);

  React.useEffect(() => {
    const onRefresh = () => {
      void refresh();
      void loadAffiliateBalance();
    };

    window.addEventListener("credits:refresh", onRefresh);
    window.addEventListener("affiliate:refresh", onRefresh);

    return () => {
      window.removeEventListener("credits:refresh", onRefresh);
      window.removeEventListener("affiliate:refresh", onRefresh);
    };
  }, [refresh, loadAffiliateBalance]);

  async function handleLogout() {
    setMobileOpen(false);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  function handleNavigate(path: string) {
    setMobileOpen(false);
    navigate(path);
  }

  const affiliateDisplayLoading = loading || affiliateLoading;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Go to homepage">
            <img
              src="/TheDigitalGifter.png"
              alt="TheDigitalGifter"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex xl:gap-2">
            {!loading &&
              items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} to={item.to}>
                    {({ isActive }) => (
                      <span className={desktopNavClass(isActive)}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="hidden xl:inline">{item.label}</span>
                        <span className="xl:hidden">
                          {item.label === "Admin Panel" ? "Admin" : item.label}
                        </span>
                      </span>
                    )}
                  </NavLink>
                );
              })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/account/affiliate")}
            className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex"
          >
            <Users size={17} />
            <span className="hidden xl:inline">Affiliate:</span>
            <span className="font-bold text-emerald-300">
              {affiliateDisplayLoading ? "..." : money(affiliateBalance)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 sm:flex"
          >
            <Plus size={18} />
            <span className="hidden xl:inline">Credits:</span>
            <span className="font-bold text-[#ffd976]">
              {loading ? "..." : creditsRemaining}
            </span>
          </button>

          <Button
            asChild
            variant="secondary"
            className="hidden rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 xl:inline-flex"
          >
            <Link to="/generator">Open Generator</Link>
          </Button>

          <div className="hidden lg:block">
            <UserMenu />
          </div>

          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
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
                      <img
                        src="/TheDigitalGifter.png"
                        alt="TheDigitalGifter"
                        className="h-10 w-auto object-contain"
                      />
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
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavigate("/pricing")}
                      className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left"
                    >
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Plus className="h-4 w-4" />
                        Credits
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-[#ffd976]">
                        {loading ? "..." : creditsRemaining}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavigate("/account/affiliate")}
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-left"
                    >
                      <div className="flex items-center gap-2 text-sm text-emerald-100">
                        <Users className="h-4 w-4" />
                        Affiliate
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-emerald-300">
                        {affiliateDisplayLoading ? "..." : money(affiliateBalance)}
                      </div>
                    </button>
                  </div>

                  <nav className="mt-5 space-y-2">
                    {!loading &&
                      items.map((item) => {
                        const Icon = item.icon;

                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => mobileNavClass(isActive)}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
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
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}