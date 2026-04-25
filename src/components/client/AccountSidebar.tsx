import React from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, LayoutGrid, Shield, Users, Wand2 } from "lucide-react";
import { useAccountOverview } from "@/hooks/useAccountOverview";

function navClass(active: boolean) {
  return [
    "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
    active
      ? "bg-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/10"
      : "text-zinc-400 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

type SidebarItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function AccountSidebar() {
  const { loading, isAdmin } = useAccountOverview();

  const items: SidebarItem[] = React.useMemo(() => {
    const base: SidebarItem[] = [
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
    <aside className="hidden xl:flex xl:w-[280px] xl:flex-col">
      <div className="sticky top-6 rounded-[28px] border border-white/10 bg-zinc-950/70 p-4 shadow-2xl backdrop-blur">
        <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            {isAdmin ? "Admin Account" : "Client Account"}
          </div>

          <div className="mt-2 text-xl font-semibold text-white">
            {isAdmin ? "Workspace + Admin" : "Workspace"}
          </div>

          <p className="mt-1 text-sm leading-6 text-zinc-400">
            {isAdmin
              ? "Access your dashboard, affiliate area, admin panel and generator from one workspace."
              : "Manage your creations, credits, affiliate area and generator access."}
          </p>
        </div>

        <nav className="space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
              Loading menu...
            </div>
          ) : (
            items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => navClass(isActive)}
                >
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
                          isActive
                            ? "translate-x-0 text-white"
                            : "text-zinc-600 group-hover:text-zinc-300",
                        ].join(" ")}
                      />
                    </>
                  )}
                </NavLink>
              );
            })
          )}
        </nav>
      </div>
    </aside>
  );
}