import { Route } from "react-router-dom";
import type { ReactNode } from "react";

/** Duplicate pet product routes under a locale prefix (Strategy A). */
export function petLocalePrefixedRoutes(
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
