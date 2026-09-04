/**
 * Route shells for unfinished Christmas suite surfaces.
 * Portrait verticals (photo/family/couples/pets/dogs/cats) use ChristmasPortraitFunnelPage.
 * No fake payment CTAs or AI results on shells.
 */

export type ChristmasRouteShellDef = {
  path: string;
  productKey: string;
  title: string;
  status: "live_hub" | "foundation" | "coming_soon";
  description: string;
  noindex: boolean;
};

/** Unfinished suite surfaces only — portrait verticals + Santa Video are real funnel pages. */
export const CHRISTMAS_ROUTE_SHELLS: ChristmasRouteShellDef[] = [
  {
    path: "/christmas/kids",
    productKey: "christmas_kids",
    title: "Kids Christmas Generator",
    status: "coming_soon",
    description: "This product is not available yet. Privacy controls are required before launch.",
    noindex: true,
  },
];

export function shellForPath(pathname: string): ChristmasRouteShellDef | null {
  const path = pathname.split("?")[0];
  return CHRISTMAS_ROUTE_SHELLS.find((s) => s.path === path) ?? null;
}

export function shellExposesCheckout(shell: ChristmasRouteShellDef): boolean {
  return false;
  void shell;
}
