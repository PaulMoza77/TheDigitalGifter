/** Central Christmas card style + layout registry (stable keys). */

export const CARD_LAYOUTS = [
  { key: "square", labelEn: "Square", labelRo: "Pătrat", width: 1080, height: 1080 },
  { key: "story", labelEn: "Story", labelRo: "Story", width: 1080, height: 1920 },
  { key: "landscape", labelEn: "Landscape", labelRo: "Peisaj", width: 1600, height: 900 },
] as const;

export const CARD_STYLES = [
  {
    key: "classic_christmas",
    labelEn: "Classic Christmas",
    labelRo: "Crăciun clasic",
    bgTop: "#7f1d1d",
    bgBottom: "#14532d",
    accent: "#fbbf24",
    text: "#fff7ed",
    muted: "#fde68a",
    panel: "rgba(0,0,0,0.35)",
  },
  {
    key: "elegant_gold",
    labelEn: "Elegant Gold",
    labelRo: "Aur elegant",
    bgTop: "#1c1917",
    bgBottom: "#292524",
    accent: "#eab308",
    text: "#fef3c7",
    muted: "#fcd34d",
    panel: "rgba(0,0,0,0.45)",
  },
  {
    key: "cozy_christmas",
    labelEn: "Cozy Christmas",
    labelRo: "Crăciun cozy",
    bgTop: "#9a3412",
    bgBottom: "#431407",
    accent: "#fdba74",
    text: "#fff7ed",
    muted: "#fed7aa",
    panel: "rgba(0,0,0,0.30)",
  },
  {
    key: "winter_wonderland",
    labelEn: "Winter Wonderland",
    labelRo: "Iarnă magică",
    bgTop: "#0c4a6e",
    bgBottom: "#e0f2fe",
    accent: "#38bdf8",
    text: "#0f172a",
    muted: "#075985",
    panel: "rgba(255,255,255,0.72)",
  },
  {
    key: "minimal_christmas",
    labelEn: "Minimal Christmas",
    labelRo: "Crăciun minimal",
    bgTop: "#f8fafc",
    bgBottom: "#e2e8f0",
    accent: "#b91c1c",
    text: "#0f172a",
    muted: "#475569",
    panel: "rgba(255,255,255,0.85)",
  },
  {
    key: "vintage_christmas",
    labelEn: "Vintage Christmas",
    labelRo: "Crăciun vintage",
    bgTop: "#44403c",
    bgBottom: "#78716c",
    accent: "#f59e0b",
    text: "#fafaf9",
    muted: "#e7e5e4",
    panel: "rgba(0,0,0,0.40)",
  },
  {
    key: "playful_christmas",
    labelEn: "Playful Christmas",
    labelRo: "Crăciun jucăuș",
    bgTop: "#be123c",
    bgBottom: "#15803d",
    accent: "#fde047",
    text: "#ffffff",
    muted: "#fef9c3",
    panel: "rgba(0,0,0,0.28)",
  },
  {
    key: "romantic_christmas",
    labelEn: "Romantic Christmas",
    labelRo: "Crăciun romantic",
    bgTop: "#9f1239",
    bgBottom: "#4c0519",
    accent: "#fb7185",
    text: "#fff1f2",
    muted: "#fecdd3",
    panel: "rgba(0,0,0,0.35)",
  },
] as const;

export type CardLayoutKey = (typeof CARD_LAYOUTS)[number]["key"];
export type CardStyleDef = (typeof CARD_STYLES)[number];
export type CardStyleKey = CardStyleDef["key"];

export const CARD_STYLE_KEYS = new Set(CARD_STYLES.map((s) => s.key));
export const CARD_LAYOUT_KEYS = new Set(CARD_LAYOUTS.map((l) => l.key));

export function getCardStyle(key: string): CardStyleDef {
  return CARD_STYLES.find((s) => s.key === key) || CARD_STYLES[0]!;
}

export function findCardStyle(key: string): CardStyleDef {
  return getCardStyle(key);
}

export function getCardLayout(key: string) {
  return CARD_LAYOUTS.find((l) => l.key === key) || CARD_LAYOUTS[0]!;
}

/** Pure text wrap for canvas/tests — no DOM. */
export function wrapTextLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.join(" ").length > lines.join(" ").length) {
    const last = lines[lines.length - 1] || "";
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, "")}…`.trim();
  }
  return lines.slice(0, maxLines);
}

export function adaptiveFontSize(messageLength: number, layoutKey: string | number): number {
  const key = String(layoutKey);
  const base = key === "story" ? 52 : key === "landscape" ? 44 : 48;
  if (messageLength > 400) return Math.round(base * 0.62);
  if (messageLength > 250) return Math.round(base * 0.75);
  if (messageLength > 140) return Math.round(base * 0.88);
  return base;
}

export function maxLinesForLayout(layoutKey: string): number {
  if (layoutKey === "story") return 14;
  if (layoutKey === "landscape") return 8;
  return 10;
}

export function charsPerLineForLayout(layoutKey: string, fontSize: number): number {
  const width = getCardLayout(layoutKey).width;
  const usable = width * 0.72;
  return Math.max(18, Math.floor(usable / (fontSize * 0.52)));
}
