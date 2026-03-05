// src/layouts/AdminLayout.tsx
import React, { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  FileText,
  BadgePercent,
  Send,
  Sparkles,
  Coins,
  ShoppingCart,
  Users,
} from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useIsActivePath() {
  const { pathname } = useLocation();
  return React.useCallback(
    (path: string) => pathname === path || (path !== "/admin" && pathname.startsWith(path)),
    [pathname]
  );
}

function NavButton({
  collapsed,
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cx(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
        "border border-transparent",
        active
          ? "bg-slate-800 text-slate-50 border-slate-700"
          : "text-slate-200 hover:bg-slate-800/60",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cx("h-4 w-4 shrink-0", active ? "text-slate-100" : "text-slate-300")} />

      {!collapsed ? (
        <div className="flex w-full items-center justify-between gap-2 min-w-0">
          <span className="truncate">{label}</span>
          {badge ? (
            <span className="text-[10px] tracking-[0.25em] text-slate-500 uppercase">{badge}</span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

const SidebarNavigation: React.FC<{
  collapsed: boolean;
  isActive: (path: string) => boolean;
  navigateTo: (path: string) => void;
  onNavigate?: () => void;
}> = ({ collapsed, isActive, navigateTo, onNavigate }) => {
  const sections: NavSection[] = useMemo(
    () => [
      {
        label: "MAIN",
        items: [{ label: "Overview", path: "/admin", badge: "Main", icon: LayoutDashboard }],
      },
      {
        label: "EMAIL",
        items: [
          { label: "Templates", path: "/admin/email/templates", icon: FileText },
          { label: "Offers", path: "/admin/email/offers", icon: BadgePercent },
          { label: "Campaigns", path: "/admin/email/campaigns", icon: Send },
        ],
      },
      {
        label: "FUNNEL",
        items: [{ label: "Occasions & Styles", path: "/admin/funnel", icon: Sparkles }],
      },
      {
        label: "BUSINESS",
        items: [
          { label: "Credits", path: "/admin/credits", icon: Coins },
          { label: "Orders", path: "/admin/orders", icon: ShoppingCart },
          { label: "Customers", path: "/admin/customers", icon: Users },
        ],
      },
    ],
    []
  );

  const handle = (path: string) => {
    navigateTo(path);
    onNavigate?.();
  };

  return (
    <div className={cx("flex flex-col gap-6", collapsed ? "items-center" : "")}>
      <div className={cx("pt-1", collapsed ? "w-full flex justify-center" : "")}>
        <Logo />
      </div>

      <div className="flex flex-col gap-6 w-full">
        {sections.map((section) => (
          <div key={section.label} className={cx("w-full", collapsed ? "px-1" : "")}>
            {!collapsed ? (
              <div className="px-2 text-xs font-semibold tracking-[0.2em] text-slate-400">
                {section.label}
              </div>
            ) : (
              <div className="h-px w-full bg-slate-800 my-1" />
            )}

            <div className={cx("mt-3 flex flex-col gap-2", collapsed ? "items-center" : "")}>
              {section.items.map((item) => (
                <NavButton
                  key={item.path}
                  collapsed={collapsed}
                  active={isActive(item.path)}
                  onClick={() => handle(item.path)}
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const isActive = useIsActivePath();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? 72 : 288; // px (icon-only vs full)

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex flex-col font-sans">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-slate-200" />
              </button>
            </SheetTrigger>

            <SheetContent side="left" className="w-72 bg-slate-950 border-slate-800 p-0">
              <div className="px-5 py-6">
                <SidebarNavigation
                  collapsed={false}
                  isActive={isActive}
                  navigateTo={(p) => navigate(p)}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Logo />
        </div>
      </header>

      {/* Desktop */}
      <div className="hidden md:flex flex-1 min-h-0">
        <aside
          className="relative shrink-0 border-r border-slate-800 bg-slate-950 min-h-0"
          style={{ width: sidebarWidth }}
        >
          {/* Toggle ALWAYS on right edge of sidebar */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cx(
              "absolute top-4 -right-3 z-50",
              "h-9 w-9 rounded-xl border border-slate-800 bg-slate-950",
              "hover:bg-slate-800/60 transition-colors",
              "flex items-center justify-center"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-200" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-200" />
            )}
          </button>

          <div className={cx("h-full overflow-y-auto", collapsed ? "px-2 py-6" : "px-5 py-6")}>
            <SidebarNavigation collapsed={collapsed} isActive={isActive} navigateTo={(p) => navigate(p)} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 bg-slate-950 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 min-h-0">
        <main className="bg-slate-950 overflow-y-auto min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
export { AdminLayout };