import React from "react";
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

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { label: "Categories", path: "/admin/categories" },
    { label: "Templates", path: "/admin/templates", badge: "Items" },
    { label: "Credits", path: "/admin/credits" },
    { label: "Orders", path: "/admin/orders" },
    { label: "Customers", path: "/admin/customers" },
    { label: "Statistics", path: "/admin/statistics" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex font-sans">
        {/* Sidebar */}
        <Sidebar className="w-64 border-r border-slate-800 bg-slate-950">
          <SidebarContent className="px-5 py-6 flex flex-col gap-8">
            {/* Main Section */}
            <div>
              <SidebarGroupLabel className="text-xs font-semibold tracking-[0.2em] text-slate-400 mb-2">
                MAIN
              </SidebarGroupLabel>
              <button
                onClick={() => navigate("/admin")}
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
                      onClick={() => navigate(item.path)}
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
                    onClick={() => navigate("/admin/offers")}
                    className={`mt-4 rounded-xl px-2 py-1.5 text-left text-indigo-300 hover:bg-slate-800/70 ${
                      isActive("/admin/offers") ? "bg-slate-800" : ""
                    }`}
                  >
                    Offers
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main content area - Outlet for nested routes */}
        <main className="flex-1 bg-slate-950 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
