/**
 * Portrait → Christmas Card handoff.
 * Parallel to message→card sessionStorage handoff.
 * Stores a recoverable image URL (never analytics payload content).
 */

export const PORTRAIT_TO_CARD_KEY = "tdg.christmas.portrait.card.handoff.v1";
export const LAST_PORTRAIT_RESULT_KEY = "tdg.christmas.portrait.lastResult.v1";

const HANDOFF_TTL_MS = 2 * 60 * 60 * 1000;
const LAST_RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PortraitToCardHandoff = {
  imageUrl: string;
  source: "portrait_result" | "last_portrait" | "manual";
  verticalId?: string;
  productKey?: string;
  orderId?: string | null;
  savedAt: number;
};

export type LastPortraitResult = {
  imageUrl: string;
  verticalId?: string;
  productKey?: string;
  orderId?: string | null;
  savedAt: number;
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "blob:";
  } catch {
    return value.startsWith("data:image/");
  }
}

export function writePortraitToCardHandoff(
  value: Omit<PortraitToCardHandoff, "savedAt"> & { savedAt?: number },
): void {
  if (typeof window === "undefined") return;
  if (!value.imageUrl || !isHttpUrl(value.imageUrl)) return;
  try {
    const payload: PortraitToCardHandoff = {
      imageUrl: value.imageUrl,
      source: value.source,
      verticalId: value.verticalId,
      productKey: value.productKey,
      orderId: value.orderId ?? null,
      savedAt: value.savedAt || Date.now(),
    };
    sessionStorage.setItem(PORTRAIT_TO_CARD_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function readPortraitToCardHandoff(): PortraitToCardHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PORTRAIT_TO_CARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortraitToCardHandoff;
    if (!parsed?.imageUrl || !isHttpUrl(String(parsed.imageUrl))) return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > HANDOFF_TTL_MS) return null;
    return {
      imageUrl: String(parsed.imageUrl),
      source: parsed.source || "portrait_result",
      verticalId: parsed.verticalId ? String(parsed.verticalId) : undefined,
      productKey: parsed.productKey ? String(parsed.productKey) : undefined,
      orderId: parsed.orderId == null ? null : String(parsed.orderId),
      savedAt: Number(parsed.savedAt || Date.now()),
    };
  } catch {
    return null;
  }
}

export function clearPortraitToCardHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PORTRAIT_TO_CARD_KEY);
  } catch {
    /* ignore */
  }
}

export function writeLastPortraitResult(
  value: Omit<LastPortraitResult, "savedAt"> & { savedAt?: number },
): void {
  if (typeof window === "undefined") return;
  if (!value.imageUrl || !isHttpUrl(value.imageUrl)) return;
  try {
    const payload: LastPortraitResult = {
      imageUrl: value.imageUrl,
      verticalId: value.verticalId,
      productKey: value.productKey,
      orderId: value.orderId ?? null,
      savedAt: value.savedAt || Date.now(),
    };
    localStorage.setItem(LAST_PORTRAIT_RESULT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readLastPortraitResult(): LastPortraitResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_PORTRAIT_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastPortraitResult;
    if (!parsed?.imageUrl || !isHttpUrl(String(parsed.imageUrl))) return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > LAST_RESULT_TTL_MS) return null;
    return {
      imageUrl: String(parsed.imageUrl),
      verticalId: parsed.verticalId ? String(parsed.verticalId) : undefined,
      productKey: parsed.productKey ? String(parsed.productKey) : undefined,
      orderId: parsed.orderId == null ? null : String(parsed.orderId),
      savedAt: Number(parsed.savedAt || Date.now()),
    };
  } catch {
    return null;
  }
}

export function cardsUrlFromPortrait(opts?: { skipPhoto?: boolean }): string {
  const params = new URLSearchParams();
  params.set("from_portrait", "1");
  if (opts?.skipPhoto !== false) params.set("step", "design");
  return `/christmas/cards?${params.toString()}`;
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load portrait image."));
    el.src = url;
  });
}
