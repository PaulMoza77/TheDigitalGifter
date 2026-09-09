/** Letter framing helpers — presentation layer over wishlist title/description. */

export type LetterFraming = {
  salutation: string;
  intro: string;
  closing: string;
  signature: string;
};

export const DEFAULT_LETTER: LetterFraming = {
  salutation: "Dear Santa,",
  intro: "This Christmas, I’d love a few things that would make the season extra special.",
  closing: "With love,",
  signature: "",
};

const MARKER = "\u200B\u200Bwl\u200B"; // zero-width markers (legacy-safe-ish)

/** Pack letter framing into description (≤500). Falls back to intro-only for old lists. */
export function serializeLetterDescription(framing: LetterFraming): string {
  const salutation = framing.salutation.trim() || DEFAULT_LETTER.salutation;
  const intro = framing.intro.trim();
  const closing = framing.closing.trim() || DEFAULT_LETTER.closing;
  const signature = framing.signature.trim();
  const packed = `${MARKER}\n${salutation}\n\n${intro}\n\n${closing}\n${signature}`.trim();
  return packed.slice(0, 500);
}

export function parseLetterDescription(raw: string | null | undefined): LetterFraming {
  const text = String(raw || "").trim();
  if (!text) return { ...DEFAULT_LETTER };

  if (text.startsWith(MARKER) || text.includes(MARKER)) {
    const body = text.replace(MARKER, "").trim();
    const parts = body.split(/\n\s*\n/);
    if (parts.length >= 2) {
      const salutation = parts[0]?.trim() || DEFAULT_LETTER.salutation;
      const intro = parts[1]?.trim() || "";
      const tail = (parts[2] || "").trim();
      const tailLines = tail.split("\n").map((l) => l.trim()).filter(Boolean);
      const closing = tailLines[0] || DEFAULT_LETTER.closing;
      const signature = tailLines.slice(1).join(" ").trim();
      return { salutation, intro, closing, signature };
    }
  }

  // Plain legacy description → treat as intro
  const looksLikeSalutation = /^dear\s+/i.test(text.split("\n")[0] || "");
  if (looksLikeSalutation) {
    const lines = text.split("\n");
    const salutation = lines[0].trim();
    const rest = lines.slice(1).join("\n").trim();
    return { ...DEFAULT_LETTER, salutation, intro: rest || DEFAULT_LETTER.intro };
  }

  return { ...DEFAULT_LETTER, intro: text };
}

/** Guess a first name from titles like "Paul's Christmas Wishlist". */
export function signatureFromTitle(title: string): string {
  const t = String(title || "").trim();
  const m = t.match(/^(.+?)['’]s\s+Christmas\s+Wishlist$/i);
  if (m?.[1] && !/^my$/i.test(m[1])) return m[1].trim().slice(0, 40);
  return "";
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractUrlFromWishText(text: string): { title: string; url: string | null } {
  const raw = String(text || "");
  const match = raw.match(URL_RE);
  if (!match?.[0]) return { title: raw.trim(), url: null };
  let url = match[0].replace(/[.,;:!?)]+$/, "");
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { title: raw.trim(), url: null };
    url = u.toString().slice(0, 500);
  } catch {
    return { title: raw.trim(), url: null };
  }
  const title = raw.replace(match[0], "").replace(/\s{2,}/g, " ").trim() || url;
  return { title: title.slice(0, 120), url };
}

export function priorityMark(priority?: string | null): string {
  if (priority === "really_want") return "❤️";
  if (priority === "would_love") return "★";
  return "";
}

export const WISH_PLACEHOLDER = "Start writing your first wish…";
export const LETTER_LABEL = "THE DIGITAL GIFTER · CHRISTMAS";
