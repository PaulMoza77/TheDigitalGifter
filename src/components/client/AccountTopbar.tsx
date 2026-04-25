// FILE: src/components/client/AccountTopbar.tsx
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, Menu, Plus, Shield, Users, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function mobileNavClass(active: boolean) {
  return [
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
    active
      ? "bg-white/10 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

type TopbarItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function AccountTopbar() {
  const navigate = useNavigate();

  const { loading, isAdmin, creditsRemaining, affiliateEarnings } =
    useAccountOverview();

  const items: TopbarItem[] = React.useMemo(() => {
    const base: TopbarItem[] = [
      {
        label: "Dashboard",
        to: "/account/dashboard",
        icon: LayoutGrid,
      },
      {
        label: "Affiliate",
        to: "/account/affiliate",
        icon: Users,
      },
    ];

    if (isAdmin) {
      base.push({
        label: "Admin Panel",
        to: "/admin",
        icon: Shield,
      });
    }

    base.push({
      label: "Generator",
      to: "/generator",
      icon: Wand2,
    });

    return base;
  }, [isAdmin]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex shrink-0 items-center"
            aria-label="Go to homepage"
          >
            <img
              src="/TheDigitalGifter.png"
              alt="TheDigitalGifter"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {!loading &&
              items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} to={item.to}>
                    {({ isActive }) => (
                      <span
                        className={[
                          "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-all",
                          isActive
                            ? "border-white/10 bg-white/10 text-white"
                            : "border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/account/affiliate")}
            className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex"
          >
            <Users size={17} />
            <span className="hidden sm:inline">Affiliate:</span>
            <span className="font-bold text-emerald-300">
              {loading ? "..." : `$${affiliateEarnings.toFixed(2)}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 md:flex"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Credits:</span>
            <span className="font-bold text-[#ffd976]">
              {loading ? "..." : creditsRemaining}
            </span>
          </button>

          <Button
            asChild
            variant="secondary"
            className="hidden rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 md:inline-flex"
          >
            <Link to="/generator">Open Generator</Link>
          </Button>

          <div className="hidden md:block">
            <UserMenu />
          </div>

          <div className="md:hidden">
            <Sheet>
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
                className="border-l border-white/10 bg-zinc-950 text-white"
              >
                <SheetHeader>
                  <SheetTitle className="text-left text-white">
                    Account
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate("/account/affiliate")}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100"
                  >
                    <Users size={17} />
                    <span>Affiliate:</span>
                    <span className="font-bold text-emerald-300">
                      {loading ? "..." : `$${affiliateEarnings.toFixed(2)}`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/pricing")}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90"
                  >
                    <Plus size={18} />
                    <span>Credits:</span>
                    <span className="font-bold text-[#ffd976]">
                      {loading ? "..." : creditsRemaining}
                    </span>
                  </button>

                  {!loading &&
                    items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => mobileNavClass(isActive)}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </NavLink>
                      );
                    })}

                  <Link
                    to="/generator"
                    className="mt-3 flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Open Generator
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}