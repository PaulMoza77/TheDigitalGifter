/**
 * Route shells for unfinished Christmas suite surfaces.
 * Live product routes are kept out of this registry unless a legacy wrapper
 * still uses the shell contract for routing.
 */

import { parseChristmasLocalePath } from "./seo/localeRouting";

export type ChristmasRouteShellDef = {
  path: string;
  productKey: string;
  title: string;
  status: "live_hub" | "foundation" | "coming_soon";
  description: string;
  noindex: boolean;
};

/**
 * Kids keeps this routing record because ChristmasShellRoute is the legacy
 * entry point, but the route now renders a real guardian-gated generator.
 */
export const CHRISTMAS_ROUTE_SHELLS: ChristmasRouteShellDef[] = [
  {
    path: "/christmas/kids",
    productKey: "christmas_kids",
    title: "Kids Christmas Generator",
    status: "live_hub",
    description:
      "Privacy-first Christmas portraits for children, protected by a parent/guardian permission gate and private-by-default delivery.",
    noindex: false,
  },
];

export function shellForPath(pathname: string): ChristmasRouteShellDef | null {
  const { basePath } = parseChristmasLocalePath(pathname.split("?")[0]);
  return CHRISTMAS_ROUTE_SHELLS.find((s) => s.path === basePath) ?? null;
}

export function shellExposesCheckout(shell: ChristmasRouteShellDef): boolean {
  return false;
  void shell;
}
