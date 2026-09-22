export type ChristmasIdentity = {
  id: string;
  src: string;
  alt: string;
  caption: string;
};

/** Editorial Christmas objects only. Never portraits, initials, UI chrome, or blurred placeholders. */
export const CHRISTMAS_IDENTITIES: ChristmasIdentity[] = [
  {
    id: "ivory-ribbon",
    src: "/christmas/planner/gifts-editorial.webp",
    alt: "Ivory wrapped Christmas gift with burgundy velvet ribbon",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "burgundy-gifts",
    src: "/christmas/gifts-still-life.png",
    alt: "Burgundy and gold wrapped Christmas presents under a tree",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "tree-presents",
    src: "/christmas/gifts/scene-desktop.jpg",
    alt: "Christmas tree with wrapped presents by a fireplace",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "green-room",
    src: "/assets/christmas/christmas_hero_room.webp",
    alt: "Evergreen Christmas room with gifts beside the hearth",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "gold-hearth",
    src: "/assets/christmas/christmas_finale_room.webp",
    alt: "Gold-wrapped Christmas presents by a firelit tree",
    caption: "Christmas decoration, not a portrait",
  },
  {
    id: "stockings",
    src: "/christmas/cabin-hero-1280.webp",
    alt: "Christmas cabin with stockings, wreath and wrapped gifts",
    caption: "Christmas decoration, not a portrait",
  },
];

const BY_ROLE: Record<string, string> = {
  mom: "ivory-ribbon",
  mother: "ivory-ribbon",
  mum: "ivory-ribbon",
  dad: "burgundy-gifts",
  father: "burgundy-gifts",
  child: "tree-presents",
  son: "tree-presents",
  daughter: "tree-presents",
  teen: "tree-presents",
  partner: "gold-hearth",
  wife: "gold-hearth",
  husband: "gold-hearth",
  girlfriend: "gold-hearth",
  boyfriend: "gold-hearth",
  grandma: "green-room",
  grandpa: "green-room",
  grandmother: "green-room",
  grandfather: "green-room",
  grandparent: "green-room",
  friend: "stockings",
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
  const fromName = Object.keys(BY_ROLE).find((key) => name === key || name.includes(key));
  const preferred = fromName && BY_ROLE[fromName];
  if (preferred) {
    const found = CHRISTMAS_IDENTITIES.find((row) => row.id === preferred);
    if (found) return found;
  }
  return CHRISTMAS_IDENTITIES[hashKey(input.id || name) % CHRISTMAS_IDENTITIES.length];
}

/** Stable unique covers for a list. Same id always keeps the same image. */
export function christmasIdentitiesForPeople(
  people: Array<{ id: string; displayName: string; relationship: string }>,
): Map<string, ChristmasIdentity> {
  const assigned = new Map<string, ChristmasIdentity>();
  const taken = new Set<string>();
  const ordered = [...people].sort((a, b) => a.id.localeCompare(b.id));
  for (const person of ordered) {
    const preferred = christmasIdentityForPerson(person);
    if (!taken.has(preferred.id)) {
      taken.add(preferred.id);
      assigned.set(person.id, preferred);
      continue;
    }
    const start = hashKey(person.id) % CHRISTMAS_IDENTITIES.length;
    let next = preferred;
    for (let i = 0; i < CHRISTMAS_IDENTITIES.length; i += 1) {
      const candidate = CHRISTMAS_IDENTITIES[(start + i) % CHRISTMAS_IDENTITIES.length];
      if (!taken.has(candidate.id)) {
        next = candidate;
        break;
      }
    }
    taken.add(next.id);
    assigned.set(person.id, next);
  }
  return assigned;
}

