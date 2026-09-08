import { giftSharePath } from "./packageComposition";

export function giftShareAbsoluteUrl(shareId: string, origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(
    /\/$/,
    "",
  );
  return `${base}${giftSharePath(shareId)}`;
}

export { giftSharePath };

export async function copyGiftLink(shareId: string, origin?: string): Promise<boolean> {
  const url = giftShareAbsoluteUrl(shareId, origin);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShareGift(input: {
  shareId: string;
  title?: string;
  text?: string;
  origin?: string;
}): Promise<"shared" | "copied" | "unavailable"> {
  const url = giftShareAbsoluteUrl(input.shareId, input.origin);
  const title = input.title || "A Christmas gift for you";
  const text = input.text || "Open your prepaid Digital Gifter gift.";
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      // fall through to copy
    }
  }
  const ok = await copyGiftLink(input.shareId, input.origin);
  return ok ? "copied" : "unavailable";
}

export function mailtoGiftLink(input: {
  shareId: string;
  recipientHint?: string;
  origin?: string;
}): string {
  const url = giftShareAbsoluteUrl(input.shareId, input.origin);
  const subject = encodeURIComponent("Your Christmas gift is ready");
  const body = encodeURIComponent(
    `Someone sent you a prepaid Digital Gifter Christmas gift.\n\nOpen it here:\n${url}\n`,
  );
  const to = input.recipientHint ? encodeURIComponent(input.recipientHint) : "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
