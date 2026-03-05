// src/pages/admin/email/index.tsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function TabLink(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      end
      className={({ isActive }) =>
        cn(
          "px-4 py-2 rounded-xl text-sm font-medium border transition",
          isActive
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
        )
      }
    >
      {props.label}
    </NavLink>
  );
}

export default function AdminEmailLayoutPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <TabLink to="/admin/email/templates" label="Templates" />
        <TabLink to="/admin/email/offers" label="Offers" />
        <TabLink to="/admin/email/campaigns" label="Campaigns" />
      </div>

      <Outlet />
    </div>
  );
}