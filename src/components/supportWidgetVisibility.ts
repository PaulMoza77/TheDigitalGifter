/** Hide the floating Help chip on sales funnels. Keep it on /pet/order after purchase. */
export function isSupportWidgetHidden(pathname: string) {
  if (
    pathname.includes("/admin") ||
    pathname.includes("/funnel") ||
    pathname.includes("/checkout") ||
    pathname.includes("/payment") ||
    pathname.includes("/credits")
  ) {
    return true;
  }

  if (pathname === "/pet" || pathname.startsWith("/pet/") || pathname.startsWith("/pet-v2")) {
    return pathname !== "/pet/order" && !pathname.startsWith("/pet/order/");
  }

  return false;
}
