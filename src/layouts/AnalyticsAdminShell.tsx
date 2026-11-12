// Adapted from the production Flavours Bistro AdminMenu.tsx; TDG routes and authentication.
// src/admin/AdminMenu.tsx
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminNavAlerts } from "@/hooks/useAdminNavAlerts";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  ShoppingBag,
  Wallet,
  UtensilsCrossed,
  LayoutList,
  CalendarDays,
  ChefHat,
  PartyPopper,
  MapPin,
  Settings,
  Users,
  ShieldCheck,
  Menu as MenuIcon,
  X,
  ExternalLink,
  LogOut,
  Store,
  PackageSearch,
  IdCard,
} from "lucide-react";

type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** exact = doar path-ul exact e activ (evită conflict Meniu / Meniu Builder) */
  exact?: boolean;
};

type NavGroup = { title: string; items: NavEntry[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Activitate",
    items: [
      { path: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { path: "/admin/christmas/orders", label: "Comenzi", icon: ShoppingBag },
      { path: "/admin/customers", label: "Clienți", icon: Users },
      {
        path: "/admin/christmas/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
      },
      {
        path: "/admin/support-tickets",
        label: "Tickete suport",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Produse & conținut",
    items: [
      {
        path: "/admin/christmas/santa-call",
        label: "Apel cu Moșu",
        icon: Store,
      },
      {
        path: "/admin/christmas",
        label: "Crăciun",
        icon: CalendarDays,
        exact: true,
      },
      { path: "/admin/templates", label: "Template-uri", icon: LayoutList },
      { path: "/admin/library", label: "Bibliotecă", icon: PackageSearch },
    ],
  },
  {
    title: "Administrare",
    items: [
      {
        path: "/admin/christmas/monetization",
        label: "Monetizare",
        icon: Wallet,
      },
      { path: "/admin/blog", label: "Blog", icon: LayoutList },
      { path: "/admin/publisher", label: "Publicare", icon: CalendarDays },
      { path: "/admin/pricing", label: "Prețuri", icon: Settings },
    ],
  },
];

function isEntryActive(entry: NavEntry, pathname: string) {
  if (entry.exact)
    return pathname === entry.path || pathname === entry.path + "/";
  return pathname === entry.path || pathname.startsWith(entry.path + "/");
}

function pageTitle(pathname: string): string {
  for (const g of NAV_GROUPS) {
    // căutăm întâi match-urile mai specifice (path mai lung)
    const sorted = [...g.items].sort((a, b) => b.path.length - a.path.length);
    for (const item of sorted) {
      if (isEntryActive(item, pathname)) return item.label;
    }
  }
  return "Admin";
}

export default function AnalyticsAdminShell({
  alerts,
}: {
  alerts: AdminNavAlerts;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pendingOrders = alerts.orders;
  // închide drawer-ul mobil la schimbare de rută
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  const title = pageTitle(loc.pathname);

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mt-5 first:mt-2">
          <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isEntryActive(item, loc.pathname);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${
                    active
                      ? "bg-[#FBF6EC] font-semibold text-[#8C6118]"
                      : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#C08A2D]" />
                  )}
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#A87824]" : "text-neutral-400"}`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.path === "/admin/support-tickets" &&
                    alerts.tickets > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C08A2D] px-1.5 text-[11px] font-bold leading-none text-white">
                        {alerts.tickets}
                      </span>
                    )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="space-y-0.5">
      <Link
        to="/"
        target="_blank"
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
      >
        <ExternalLink className="h-[18px] w-[18px] text-neutral-400" />
        Vezi site-ul
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-600 transition hover:bg-red-50 hover:text-red-700"
      >
        <LogOut className="h-[18px] w-[18px] text-neutral-400" />
        Ieși din cont
      </button>
    </div>
  );

  const sidebarBottom = (
    <>
      <div className="border-t border-neutral-200/70">{sidebarFooter}</div>
    </>
  );

  const brand = (
    <div className="flex h-16 items-center gap-2.5 px-6">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#C08A2D] text-sm font-extrabold text-white">
        ★
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold text-neutral-900">
          The Digital Gifter
        </div>
        <div className="text-[11px] font-medium text-neutral-400">Admin</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* ===== SIDEBAR desktop ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200/70 bg-white lg:flex">
        {brand}
        {navContent}
        {sidebarBottom}
      </aside>

      {/* ===== DRAWER mobil ===== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label="Închide meniul"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent}
            {sidebarBottom}
          </div>
        </div>
      )}

      {/* ===== CONȚINUT ===== */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200/70 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
            aria-label="Deschide meniul"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            {pendingOrders > 0 && (
              <NavLink
                to="/admin/orders"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FBF6EC] px-3 text-xs font-semibold text-[#8C6118] transition hover:bg-[#F5EAD3]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#C08A2D]" />
                {pendingOrders}{" "}
                {pendingOrders === 1 ? "comandă nouă" : "comenzi noi"}
              </NavLink>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
