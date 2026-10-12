import { NavLink, Outlet } from "react-router-dom";

const links = [{ to: "/admin/memories", label: "Dashboard", end: true }];

export default function MemoriesAdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Memories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Early-access funnel metrics. Test transactions are excluded from production revenue.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
