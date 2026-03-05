// src/layouts/AdminLayout.tsx
import React, { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/ui/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";

type NavItem = {
  label: string;
  path: string;
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

const SidebarNavigation: React.FC<{
  collapsed?: boolean;
  isActive: (path: string) => boolean;
  navigateTo: (path: string) => void;
  onNavigate?: () => void;
}> = ({ collapsed = false, isActive, navigateTo, onNavigate }) => {
  const sections: NavSection[] = useMemo(
    () => [
      { label: "MAIN", items: [{ label: "Overview", path: "/admin", badge: "Main" }] },
      {
        label: "EMAIL",
        items: [
          { label: "Templates", path: "/admin/email/templates" },
          { label: "Offers", path: "/admin/email/offers" },
          { label: "Campaigns", path: "/admin/email/campaigns" },
        ],
      },
      {
        label: "FUNNEL",
        items: [{ label: "Occasions & Styles", path: "/admin/funnel" }],
      },
      {
        label: "BUSINESS",
        items: [
          { label: "Credits", path: "/admin/credits" },
          { label: "Orders", path: "/admin/orders" },
          { label: "Customers", path: "/admin/customers" },
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
    <div className={cx("flex flex-col gap-8", collapsed ? "items-center" : "")}>
      <div className={cx("pt-1", collapsed ? "w-full flex justify-center" : "")}>
        <Logo />
      </div>

      {sections.map((section) => (
        <div key={section.label} className={cx("space-y-3", collapsed && "w-full")}>
          <SidebarGroupLabel
            className={cx(
              "text-xs font-semibold tracking-[0.2em] text-slate-400",
              collapsed && "text-center"
            )}
          >
            {collapsed ? section.label[0] : section.label}
          </SidebarGroupLabel>

          <SidebarGroup>
            <SidebarMenu className="flex flex-col gap-2 text-sm text-slate-200">
              {section.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    type="button"
                    onClick={() => handle(item.path)}
                    className={cx(
                      "rounded-xl px-2 py-1.5 text-left transition-colors",
                      "hover:bg-slate-800/70",
                      isActive(item.path) && "bg-slate-800",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className={cx("flex w-full items-center justify-between gap-3", collapsed && "justify-center")}>
                      <span className={cx(section.label === "EMAIL" && "text-indigo-200", collapsed && "hidden")}>
                        {item.label}
                      </span>

                      {!collapsed && item.badge ? (
                        <span className="text-[10px] tracking-[0.25em] text-slate-500 uppercase">
                          {item.badge}
                        </span>
                      ) : null}

                      {collapsed ? (
                        <span className="text-[11px] text-slate-300">
                          {item.label
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 3)
                            .toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </div>
      ))}
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const isActive = useIsActivePath();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex flex-col font-sans">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800">
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
              <SidebarContent className="px-5 py-6 flex flex-col gap-8">
                <SidebarNavigation
                  isActive={isActive}
                  navigateTo={(path) => navigate(path)}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </SidebarContent>
            </SheetContent>
          </Sheet>

          <Logo />
        </header>

        {/* Desktop: grid => sidebar + content (NU suprapune) */}
        <div
          className="hidden md:grid flex-1 overflow-hidden"
          style={{ gridTemplateColumns: collapsed ? "4.25rem 1fr" : "18rem 1fr" }}
        >
          <aside className="border-r border-slate-800 bg-slate-950 overflow-hidden">
            <Sidebar className="w-full bg-transparent">
              <SidebarContent className={cx("px-5 py-6 flex flex-col gap-6", collapsed && "px-3")}>
                <div className={cx("flex items-center", collapsed ? "justify-center" : "justify-between")}>
                  {!collapsed ? <div className="opacity-0 pointer-events-none select-none"><Logo /></div> : null}
                  <button
                    type="button"
                    onClick={() => setCollapsed((v) => !v)}
                    className={cx(
                      "h-9 w-9 rounded-xl border border-slate-800 hover:bg-slate-800/60 transition-colors",
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
                </div>

                <SidebarNavigation
                  collapsed={collapsed}
                  isActive={isActive}
                  navigateTo={(path) => navigate(path)}
                />
              </SidebarContent>
            </Sidebar>
          </aside>

          <main className="bg-slate-950 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        {/* Mobile/Small screens fallback content area */}
        <div className="md:hidden flex-1 overflow-hidden">
          <main className="bg-slate-950 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
export { AdminLayout };