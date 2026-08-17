export const ADMIN_SEEN_ORDERS_KEY = "tdg-admin-seen-orders";
export const ADMIN_SEEN_PET_ORDERS_KEY = "tdg-admin-seen-pet-orders";

const CLOSED_TICKET_STATUSES = new Set(["closed"]);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isOpenSupportTicket(status: string | null | undefined): boolean {
  return !CLOSED_TICKET_STATUSES.has(String(status || "").trim().toLowerCase());
}

export function formatAlertCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 99) return "99+";
  return String(Math.floor(count));
}

export function unseenSince(lastSeenIso: string | null | undefined, now = Date.now()): string {
  const parsed = Date.parse(String(lastSeenIso || ""));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date(now - SEVEN_DAYS_MS).toISOString();
}

export function isOrdersPath(pathname: string): boolean {
  return pathname === "/admin/orders" || pathname.startsWith("/admin/orders/");
}

export function isPetOrdersPath(pathname: string): boolean {
  return pathname === "/admin/pet-orders" || pathname.startsWith("/admin/pet-orders/");
}
