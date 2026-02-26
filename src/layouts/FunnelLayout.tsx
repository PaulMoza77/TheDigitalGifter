// src/layouts/FunnelLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function FunnelLayout() {
  return (
    <div className="min-h-screen w-full">
      <Outlet />
    </div>
  );
}