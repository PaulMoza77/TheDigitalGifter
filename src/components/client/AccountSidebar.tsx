// FILE: src/components/client/AccountSidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, Wand2, ChevronRight } from "lucide-react";

function navClass(active: boolean) {
  return [
    "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
    active
      ? "bg-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/10"
      : "text-zinc-400 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

export default function AccountSidebar() {
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
    <aside className="hidden xl:flex xl:w-[280px] xl:flex-col">
      <div className="sticky top-6 rounded-[28px] border border-white/10 bg-zinc-950/70 p-4 shadow-2xl backdrop-blur">
        <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Client Account
          </div>
          <div className="mt-2 text-xl font-semibold text-white">Workspace</div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Manage your creations, credits and generator access.
          </p>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                        isActive
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-zinc-400 group-hover:text-white",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="flex-1">{item.label}</span>

                    <ChevronRight
                      className={[
                        "h-4 w-4 transition-transform",
                        isActive ? "translate-x-0 text-white" : "text-zinc-600 group-hover:text-zinc-300",
                      ].join(" ")}
                    />
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}