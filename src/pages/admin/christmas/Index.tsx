import { NavLink, Outlet } from "react-router-dom";
import { Gift } from "lucide-react";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function TabLink(props: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={props.to}
      end={props.end}
      className={({ isActive }) =>
        cn(
          "rounded-xl border px-4 py-2 text-sm font-medium transition",
          isActive
            ? "border-slate-600 bg-slate-800 text-slate-50"
            : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60",
        )
      }
    >
      {props.label}
    </NavLink>
  );
}

export default function AdminChristmasLayoutPage() {
  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Gift className="h-4 w-4 text-rose-300" />
          <p className="text-xs uppercase tracking-[0.25em]">Christmas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TabLink to="/admin/christmas/countdown" label="Countdown" />
          <TabLink to="/admin/christmas/orders" label="Orders" />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
