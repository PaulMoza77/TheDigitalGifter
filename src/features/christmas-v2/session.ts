import { CHRISTMAS_V2_SESSION_KEY } from "./config";

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getChristmasV2SessionId(): string {
  try {
    const existing = localStorage.getItem(CHRISTMAS_V2_SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = uuid();
    localStorage.setItem(CHRISTMAS_V2_SESSION_KEY, next);
    return next;
  } catch {
    return uuid();
  }
}
