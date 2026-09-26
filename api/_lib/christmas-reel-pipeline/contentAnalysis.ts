const TAG_RULES: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /train|express|rail/i, tags: ["train", "christmas", "journey"] },
  { pattern: /santa|north.?pole|elf/i, tags: ["santa", "magical", "christmas"] },
  { pattern: /fireplace|cozy|cabin|hearth/i, tags: ["cozy", "fireplace", "home"] },
  { pattern: /tree|decor|ornament|lights/i, tags: ["tree", "decor", "christmas"] },
  { pattern: /snow|winter|ice|frost/i, tags: ["snow", "winter"] },
  { pattern: /luxury|palace|alpine/i, tags: ["luxury", "cinematic", "christmas"] },
  { pattern: /global|journey|city|nyc|york/i, tags: ["new-york", "cinematic", "christmas"] },
  { pattern: /fun|cartoon|pick.?one/i, tags: ["funny", "fun", "christmas"] },
  { pattern: /family|kids|gift/i, tags: ["family", "christmas"] },
  { pattern: /romantic|couple|love/i, tags: ["romantic", "christmas"] },
];

const BASE_TAGS = ["christmas", "holiday"];

export function analyzeContent(input: {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  provenance?: Record<string, unknown>;
}): string[] {
  const hay = [
    input.title,
    input.description || "",
    input.category || "",
    ...(input.tags || []),
    String(input.provenance?.prompt || ""),
    String(input.provenance?.theme || ""),
    String(input.provenance?.scene || ""),
  ]
    .join(" ")
    .toLowerCase();

  const found = new Set<string>(BASE_TAGS);
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(hay)) {
      for (const tag of rule.tags) found.add(tag);
    }
  }
  return [...found];
}

export function moodHintsFromTags(tags: string[]): string[] {
  const hints: string[] = [];
  if (tags.some((t) => ["fun", "funny", "train", "energetic", "celebration"].includes(t))) hints.push("energetic");
  if (tags.some((t) => ["peaceful", "night", "snow", "emotional", "cozy", "fireplace"].includes(t))) hints.push("calm");
  if (tags.some((t) => ["magical", "cinematic", "santa", "luxury"].includes(t))) hints.push("atmospheric");
  if (tags.some((t) => ["traditional", "home", "tree", "decor", "family"].includes(t))) hints.push("warm");
  return hints.length ? hints : ["celebration"];
}
