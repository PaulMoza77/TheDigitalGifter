import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin/christmas", label: "Dashboard", end: true },
  { to: "/admin/christmas/analytics", label: "Analytics", end: false },
  { to: "/admin/christmas/orders", label: "Orders", end: false },
  { to: "/admin/christmas/monetization", label: "Monetization", end: false },
] as const;

function tabClass(isActive: boolean) {
  return [
    "rounded-lg border px-3 py-1.5 text-sm",
    isActive
      ? "border-slate-600 bg-slate-800 text-white"
      : "border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900",
  ].join(" ");
}

export default function ChristmasAdminLayout() {
  return (
    <div className="min-h-full">
      <div className="border-b border-slate-800 px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Christmas</h1>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Christmas sections">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => tabClass(isActive)}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
