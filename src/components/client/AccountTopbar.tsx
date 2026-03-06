// FILE: src/components/client/AccountTopbar.tsx
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { LayoutGrid, Wand2, Sparkles, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

export default function AccountTopbar() {
  const items = [
    {
      label: "Dashboard",
      to: "/account/dashboard",
      icon: LayoutGrid,
    },
    {
      label: "Generator",
      to: "/account/generator",
      icon: Wand2,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <Link to="/account/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-white">My Account</div>
              <div className="text-xs text-zinc-500">Client workspace</div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {items.map((item) => {
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

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="secondary"
            className="hidden rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 md:inline-flex"
          >
            <Link to="/generator">Open Generator</Link>
          </Button>

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
                  <SheetTitle className="text-left text-white">Client Account</SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-2">
                  {items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink key={item.to} to={item.to} className={({ isActive }) => mobileNavClass(isActive)}>
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