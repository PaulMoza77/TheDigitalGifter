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

  if (pathname === "/christmas-ai-photos" || pathname.startsWith("/christmas-ai-photos/")) {
    return (
      pathname !== "/christmas-ai-photos/order" &&
      !pathname.startsWith("/christmas-ai-photos/order/")
    );
  }

  if (pathname === "/christmas/gifts" || pathname.startsWith("/christmas/gifts/")) {
    return true;
  }

  return false;
}
