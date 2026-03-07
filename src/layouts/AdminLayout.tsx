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
  LayoutTemplate,
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
    (path: string) => {
      if (path === "/admin") return pathname === "/admin";
      return pathname === path || pathname.startsWith(`${path}/`);
    },
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
        "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition-colors",
        active
          ? "border-slate-700 bg-slate-800 text-slate-50"
          : "text-slate-200 hover:bg-slate-800/60",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cx("h-4 w-4 shrink-0", active ? "text-slate-100" : "text-slate-300")} />

      {!collapsed ? (
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {badge ? (
            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              {badge}
            </span>
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
        label: "CONTENT",
        items: [{ label: "Templates", path: "/admin/templates", icon: LayoutTemplate }],
      },
      {
        label: "EMAIL",
        items: [
          { label: "Email Templates", path: "/admin/email/templates", icon: FileText },
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

  const handleNavigate = (path: string) => {
    navigateTo(path);
    onNavigate?.();
  };

  return (
    <div className={cx("flex flex-col gap-6", collapsed ? "items-center" : "")}>
      <div className={cx("pt-1", collapsed ? "flex w-full justify-center" : "")}>
        <Logo />
      </div>

      <div className="flex w-full flex-col gap-6">
        {sections.map((section) => (
          <div key={section.label} className={cx("w-full", collapsed ? "px-1" : "")}>
            {!collapsed ? (
              <div className="px-2 text-xs font-semibold tracking-[0.2em] text-slate-400">
                {section.label}
              </div>
            ) : (
              <div className="my-1 h-px w-full bg-slate-800" />
            )}

            <div className={cx("mt-3 flex flex-col gap-2", collapsed ? "items-center" : "")}>
              {section.items.map((item) => (
                <NavButton
                  key={item.path}
                  collapsed={collapsed}
                  active={isActive(item.path)}
                  onClick={() => handleNavigate(item.path)}
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

  const sidebarWidth = collapsed ? 72 : 288;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-950 font-sans text-slate-50">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="rounded-lg p-2 transition-colors hover:bg-slate-800"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-slate-200" />
              </button>
            </SheetTrigger>

            <SheetContent side="left" className="w-72 border-slate-800 bg-slate-950 p-0">
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

      <div className="hidden min-h-0 flex-1 md:flex">
        <aside
          className="relative min-h-0 shrink-0 border-r border-slate-800 bg-slate-950"
          style={{ width: sidebarWidth }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cx(
              "absolute top-4 -right-3 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 transition-colors hover:bg-slate-800/60"
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
            <SidebarNavigation
              collapsed={collapsed}
              isActive={isActive}
              navigateTo={(p) => navigate(p)}
            />
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>

      <div className="min-h-0 flex-1 md:hidden">
        <main className="min-h-0 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
export { AdminLayout };