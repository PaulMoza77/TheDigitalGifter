const STORAGE_KEY = "tdg.christmas.planner.guest.v1";
const ORDER_KEY = "tdg.christmas.planner.order.v1";

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `planner${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getOrCreatePlannerGuestToken(): string {
  if (typeof window === "undefined") return randomToken();
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 22) return existing;
    const next = randomToken();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomToken();
  }
}

export type PlannerOrderRecovery = {
  orderId: string;
  publicToken: string;
  packageKey: string;
  addonKeys: string[];
  funnelSessionId: string | null;
};

export function persistPlannerOrderRecovery(row: PlannerOrderRecovery) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

export function readPlannerOrderRecovery(): PlannerOrderRecovery | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerOrderRecovery;
    if (!parsed?.orderId || !parsed?.publicToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlannerOrderRecovery() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ORDER_KEY);
  } catch {
    /* ignore */
  }
}
