import { recipientFinderKeys } from "../giftConcierge/context";

export type ChristmasIdentity = {
  id: string;
  src: string;
  alt: string;
  label: string;
  caption: string;
};

/** Editorial Christmas objects only. Never portraits or initials. */
export const CHRISTMAS_IDENTITIES: ChristmasIdentity[] = [
  {
    id: "red-wrap",
    src: "/christmas/planner/gifts-editorial.webp",
    alt: "Wrapped Christmas presents with ribbon",
    label: "Festive wrap",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "still-life",
    src: "/christmas/gifts-still-life.png",
    alt: "Christmas gifts in warm still life light",
    label: "Still life",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "finder",
    src: "/christmas/gifts/finder-still.webp",
    alt: "Soft Christmas gift scene",
    label: "Soft glow",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "ambient",
    src: "/christmas/gifts/scene-ambient.jpg",
    alt: "Warm Christmas gift room",
    label: "Cabin light",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "tree",
    src: "/christmas/gifts/tree-hero-desktop.webp",
    alt: "Christmas tree and presents",
    label: "Under the tree",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "scene",
    src: "/christmas/gifts/scene-desktop.poster.webp",
    alt: "Christmas presents by the tree",
    label: "Tree gifts",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "letter",
    src: "/assets/christmas/wishlist_letter.webp",
    alt: "Handwritten Christmas letter",
    label: "Letter",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "card",
    src: "/assets/christmas/christmas_card_open.webp",
    alt: "Open Christmas card",
    label: "Card",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "table",
    src: "/christmas/planner/dinner-table.webp",
    alt: "Christmas table with festive details",
    label: "Table",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "advent",
    src: "/christmas/advent/advent-loop.poster.webp",
    alt: "Christmas ornaments and lights",
    label: "Ornaments",
    caption: "Christmas decoration, not a portrait",
  },
];

const BY_ROLE: Record<string, string> = {
  mom: "red-wrap",
  mother: "red-wrap",
  mum: "red-wrap",
  dad: "still-life",
  father: "still-life",
  child: "tree",
  son: "tree",
  daughter: "scene",
  teen: "finder",
  partner: "card",
  wife: "card",
  husband: "card",
  girlfriend: "card",
  boyfriend: "card",
  grandma: "table",
  grandpa: "table",
  grandmother: "table",
  grandfather: "table",
  friend: "ambient",
  grandparent: "table",
};

function hashKey(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) n = (n * 31 + value.charCodeAt(i)) >>> 0;
  return n;
}

export function christmasIdentityForPerson(input: {
  id: string;
  displayName: string;
  relationship: string;
}): ChristmasIdentity {
  const name = String(input.displayName || "").trim().toLowerCase();
  const rel = String(input.relationship || "").trim().toLowerCase();
  const fromName = Object.keys(BY_ROLE).find((key) => name === key || name.includes(key));
  const fromRel = recipientFinderKeys(input.relationship).recipientKey;
  const preferred = (fromName && BY_ROLE[fromName]) || BY_ROLE[rel] || BY_ROLE[fromRel];
  if (preferred) {
    const found = CHRISTMAS_IDENTITIES.find((row) => row.id === preferred);
    if (found) return found;
  }
  return CHRISTMAS_IDENTITIES[hashKey(input.id || name) % CHRISTMAS_IDENTITIES.length];
}
