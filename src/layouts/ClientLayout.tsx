import React from "react";
import { Outlet } from "react-router-dom";
import AccountTopbar from "@/components/client/AccountTopbar";

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_25%)]" />
      </div>

      <AccountTopbar />

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 xl:px-8">
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}