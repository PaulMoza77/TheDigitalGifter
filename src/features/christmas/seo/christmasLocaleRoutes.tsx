import { Route } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Duplicate Christmas product routes under a locale prefix (Strategy A).
 * English remains at /christmas/...; pilots live at /ro/christmas/...
 */
export function christmasLocalePrefixedRoutes(
  prefix: string,
  routes: Array<{ path: string; element: ReactNode }>,
) {
  const root = `/${prefix}`;
  return routes.map((route) => (
    <Route
      key={`${root}${route.path}`}
      path={`${root}${route.path}`}
      element={route.element}
    />
  ));
}
