import { Route } from "react-router-dom";
import type { ReactNode } from "react";
import ChristmasSendGiftPage from "@/features/christmas/ChristmasSendGiftPage";

/**
 * Duplicate Christmas product routes under a locale prefix (Strategy A).
 * English remains at /christmas/...; pilots live at /ro/christmas/...
 *
 * Send-a-Gift is appended here so every enabled locale gets the same real
 * privacy-safe flow without duplicating route declarations in App.tsx.
 */
export function christmasLocalePrefixedRoutes(
  prefix: string,
  routes: Array<{ path: string; element: ReactNode }>,
) {
  const root = `/${prefix}`;
  const allRoutes = routes.some((route) => route.path === "/christmas/send-a-gift")
    ? routes
    : [
        ...routes,
        { path: "/christmas/send-a-gift", element: <ChristmasSendGiftPage /> },
      ];

  return allRoutes.map((route) => (
    <Route
      key={`${root}${route.path}`}
      path={`${root}${route.path}`}
      element={route.element}
    />
  ));
}
