import { fetchPlannerAccess } from "@/features/christmas/planner/api";
import { CHECKOUT_INTENT_KEY, resolvePostAuthPath } from "@/features/christmas/planner/bonusCredits";
import { isSafeAuthReturnPath, takeAuthReturnTo } from "@/lib/auth/returnTo";

export function peekCheckoutIntent(): boolean {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: number };
    if (typeof parsed.at === "number" && Date.now() - parsed.at > 1000 * 60 * 60) return false;
    return true;
  } catch {
    return false;
  }
}

export async function resolvePostAuthDestination(preferred?: string): Promise<string> {
  const fallback = "/account";
  const fromPreferred = preferred && isSafeAuthReturnPath(preferred) ? preferred.split("?")[0] : "";
  const returnTo = fromPreferred || takeAuthReturnTo(fallback);
  const safeReturn = isSafeAuthReturnPath(returnTo) ? returnTo.split("?")[0] : fallback;
  let entitled = false;
  try {
    const access = await fetchPlannerAccess();
    entitled = Boolean(access?.paid);
  } catch {
    entitled = false;
  }
  return resolvePostAuthPath({
    entitled,
    returnTo: safeReturn,
    checkoutIntent: peekCheckoutIntent(),
  });
}
