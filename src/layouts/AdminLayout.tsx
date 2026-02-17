// src/layouts/AdminLayout.tsx
import React, { useState } from "react";
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

// Reusable Sidebar Navigation Component
const SidebarNavigation: React.FC<{
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
  onNavigate?: () => void;
}> = ({ isActive, navigate, onNavigate }) => {
  const navigationItems = [
    { label: "Categories", path: "/admin/categories" },
    { label: "Templates", path: "/admin/templates", badge: "Items" },
    { label: "Credits", path: "/admin/credits" },
    { label: "Orders", path: "/admin/orders" },
    { label: "Customers", path: "/admin/customers" },
    { label: "Statistics", path: "/admin/statistics" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <>
      <Logo />

      {/* Main Section */}
      <div>
        <SidebarGroupLabel className="text-xs font-semibold tracking-[0.2em] text-slate-400 mb-2">
          MAIN
        </SidebarGroupLabel>

        <button
          type="button"
          onClick={() => handleNavigation("/admin")}
          className={`inline-flex items-center justify-between w-full rounded-2xl px-4 py-3 ${
            isActive("/admin")
              ? "bg-slate-100 text-slate-900"
              : "bg-slate-800/50 text-slate-200 hover:bg-slate-800/70"
          }`}
        >
          <span className="text-sm font-semibold">Overview</span>
          {isActive("/admin") && (
            <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-400 uppercase">
              Main
            </span>
          )}
        </button>
      </div>

      {/* Navigation Menu */}
      <SidebarGroup>
        <SidebarMenu className="flex flex-col gap-3 text-sm text-slate-200">
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                type="button"
                onClick={() => handleNavigation(item.path)}
                className={`rounded-xl px-2 py-1.5 text-left hover:bg-slate-800/70 ${
                  isActive(item.path) ? "bg-slate-800" : ""
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] tracking-[0.25em] text-slate-500 uppercase">
                      {item.badge}
                    </span>
                  )}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {/* Offers - Special styling */}
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={() => handleNavigation("/admin/offers")}
              className={`mt-4 rounded-xl px-2 py-1.5 text-left text-indigo-300 hover:bg-slate-800/70 ${
                isActive("/admin/offers") ? "bg-slate-800" : ""
              }`}
            >
              Offers
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
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

            <SheetContent
              side="left"
              className="w-64 bg-slate-950 border-slate-800 p-0"
            >
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

        {/* Desktop & Mobile Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <Sidebar className="hidden md:flex w-64 border-r border-slate-800 bg-slate-950">
            <SidebarContent className="px-5 py-6 flex flex-col gap-8">
              <SidebarNavigation
                isActive={isActive}
                navigate={(path) => nav(path)}
              />
            </SidebarContent>
          </Sidebar>

          {/* Main content area - Outlet for nested routes */}
          <main className="flex-1 bg-slate-950 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
