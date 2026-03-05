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
import { Menu } from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  badge?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SidebarNavigation: React.FC<{
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
  onNavigate?: () => void;
}> = ({ isActive, navigate, onNavigate }) => {
  const sections: NavSection[] = useMemo(
    () => [
      {
        label: "MAIN",
        items: [{ label: "Overview", path: "/admin", badge: "Main" }],
      },
      {
        label: "EMAIL",
        items: [
          { label: "Templates", path: "/admin/email/templates" },
          { label: "Offers", path: "/admin/email/offers" },
          { label: "Campaigns", path: "/admin/email/campaigns" },
        ],
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

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <>
      <Logo />

      {sections.map((section) => (
        <div key={section.label}>
          <SidebarGroupLabel className="text-xs font-semibold tracking-[0.2em] text-slate-400 mb-2">
            {section.label}
          </SidebarGroupLabel>

          <SidebarGroup>
            <SidebarMenu className="flex flex-col gap-2 text-sm text-slate-200">
              {section.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    type="button"
                    onClick={() => handleNavigation(item.path)}
                    className={[
                      "rounded-xl px-2 py-1.5 text-left hover:bg-slate-800/70",
                      isActive(item.path) ? "bg-slate-800" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={section.label === "EMAIL" ? "text-indigo-200" : ""}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[10px] tracking-[0.25em] text-slate-500 uppercase">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </div>
      ))}
    </>
  );
};

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const nav = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
                <Menu className="w-5 h-5 text-slate-200" />
              </button>
            </SheetTrigger>

            <SheetContent side="left" className="w-72 bg-slate-950 border-slate-800 p-0">
              <SidebarContent className="px-5 py-6 flex flex-col gap-8">
                <SidebarNavigation
                  isActive={isActive}
                  navigate={(path) => nav(path)}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </SidebarContent>
            </SheetContent>
          </Sheet>

          <Logo />
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <Sidebar className="hidden md:flex w-72 border-r border-slate-800 bg-slate-950">
            <SidebarContent className="px-5 py-6 flex flex-col gap-8">
              <SidebarNavigation isActive={isActive} navigate={(path) => nav(path)} />
            </SidebarContent>
          </Sidebar>

          {/* Main content */}
          <main className="flex-1 bg-slate-950 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;