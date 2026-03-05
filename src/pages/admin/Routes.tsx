// src/pages/admin/routes.tsx
// (patch: add adminEmailRoutes into your admin routes list)
import React from "react";
import type { RouteObject } from "react-router-dom";
import { adminEmailRoutes } from "./email/Routes";

// ... your other imports

export const adminRoutes: RouteObject[] = [
  // ... your existing admin routes
  adminEmailRoutes,
];