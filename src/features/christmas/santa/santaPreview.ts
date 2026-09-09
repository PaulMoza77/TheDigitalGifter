import type { SantaLanguage } from "./santaTypes";

export type SantaPreviewInput = {
  childFirstName: string;
  language: SantaLanguage;
  age?: number | null;
  somethingGood?: string | null;
  hobbyOrInterest?: string | null;
  christmasWish?: string | null;
  customFact?: string | null;
  senderName?: string | null;
};

/**
 * Client-side script preview (illustrative). Real generation uses the server pipeline.
 * Kept aligned in spirit with supabase mockSantaScript — not a duplicate of production prompts.
 */
export function buildSantaMessagePreview(input: SantaPreviewInput): string {
  const name = input.childFirstName.trim();
  if (input.language === "ro") {
    return [
      `Ho-ho-ho! Dragă ${name}!`,
      "",
      input.somethingGood
        ? `Am aflat că ${input.somethingGood}, și asta m-a bucurat foarte tare.`
        : `Am auzit că ai fost un copil minunat anul acesta.`,
      "",
      input.christmasWish
        ? `Am notat cu grijă dorința ta: ${input.christmasWish}.`
        : `Am ascultat dorințele tale de Crăciun.`,
      input.customFact ? `\nȘi am reținut și asta: ${input.customFact}.` : "",
      "",
      `Fii bun cu cei din jur și păstrează magia iernii în inimă.`,
      `Crăciun fericit, ${name}!`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  const proud = input.somethingGood
    ? /^you\b/i.test(input.somethingGood.trim())
      ? `I heard ${input.somethingGood.trim()}, and I’m very proud of you.`
      : /^(she|he|they|we)\b/i.test(input.somethingGood.trim())
        ? `I heard ${input.somethingGood.trim()}, and I’m very proud of you.`
        : `I heard that you ${input.somethingGood.trim().replace(/^[Yy]ou\s+/, "")}, and I’m very proud of you.`
    : `I heard you’ve been doing wonderful things this year, and I’m very proud of you.`;

  const wish = input.christmasWish
    ? `The elves also told me you’ve been hoping for ${input.christmasWish}.`
    : `I’ve been listening carefully to your Christmas wishes.`;

  const extra = input.customFact ? `\nAnd I remembered this too: ${input.customFact}.` : "";

  return [
    `Ho ho ho, ${name}!`,
    "",
    proud,
    "",
    wish + extra,
    "",
    `Keep being kind, ${name}. I’ll see what the elves can do!`,
    `Merry Christmas!`,
  ].join("\n");
}

export function santaMentionChecklist(input: SantaPreviewInput): string[] {
  const items: string[] = [`${input.childFirstName}'s name`];
  if (input.somethingGood) items.push(input.somethingGood);
  if (input.christmasWish) items.push(`Christmas wish: ${input.christmasWish}`);
  if (input.customFact) items.push(input.customFact);
  if (input.hobbyOrInterest) items.push(input.hobbyOrInterest);
  if (input.age != null) items.push(`Age ${input.age}`);
  return items;
}
