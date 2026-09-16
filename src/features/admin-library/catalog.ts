export type LibraryCategoryId =
  | "christmas_reels"
  | "christmas_marketing"
  | "pet_dog"
  | "pet_cat"
  | "pet_other";

export type LibraryVideo = {
  id: string;
  title: string;
  description: string;
  src: string;
  filename: string;
  category: LibraryCategoryId;
};

export type LibraryCategory = {
  id: LibraryCategoryId;
  label: string;
  description: string;
};

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    id: "christmas_reels",
    label: "Christmas Reels",
    description: "Wan image-to-video clips and the assembled Instagram Reel.",
  },
  {
    id: "christmas_marketing",
    label: "Christmas marketing",
    description: "Landing, Advent, and gift-tree loops used on the public site.",
  },
  {
    id: "pet_dog",
    label: "Pet · Dog",
    description: "Public dog teaser clips.",
  },
  {
    id: "pet_cat",
    label: "Pet · Cat",
    description: "Public cat teaser clips.",
  },
  {
    id: "pet_other",
    label: "Pet · Other",
    description: "Public other-pet teaser clips.",
  },
];

const PET_CLIP_STYLES = [
  ["astronaut", "Astronaut"],
  ["beach-vacation", "Beach vacation"],
  ["christmas-portrait", "Christmas portrait"],
  ["cinema-boss", "Cinema boss"],
  ["formula-racer", "Formula racer"],
  ["head-chef", "Head chef"],
  ["luxury-ceo", "Luxury CEO"],
  ["newspaper", "Newspaper"],
  ["original-superhero", "Superhero"],
  ["renaissance", "Renaissance"],
  ["royal-portrait", "Royal portrait"],
  ["spa-bathtub", "Spa bathtub"],
] as const;

function petClips(species: "dog" | "cat" | "other", category: LibraryCategoryId): LibraryVideo[] {
  const label = species === "other" ? "Other pet" : species[0].toUpperCase() + species.slice(1);
  return PET_CLIP_STYLES.map(([slug, title]) => ({
    id: `pet-${species}-${slug}`,
    title: `${label} · ${title}`,
    description: `Public ${species} teaser clip.`,
    src: `/pet/${species}/clips/${slug}.mp4`,
    filename: `${species}-${slug}.mp4`,
    category,
  }));
}

export const LIBRARY_VIDEOS: LibraryVideo[] = [
  {
    id: "reel-final",
    title: "Final Christmas Reel",
    description: "Assembled 9:16 Reel (~13s). Hard cuts, no music.",
    src: "/assets/christmas/instagram-reel/final_christmas_reel.mp4",
    filename: "final_christmas_reel.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-01",
    title: "NYC Christmas street",
    description: "Snowy evening street with Empire State in the distance.",
    src: "/assets/christmas/instagram-reel/clip_01.mp4",
    filename: "clip_01.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-02",
    title: "Candlelit cottage entrance",
    description: "Luxury snowy house entrance with lanterns.",
    src: "/assets/christmas/instagram-reel/clip_02.mp4",
    filename: "clip_02.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-03",
    title: "Cocoa by the fire",
    description: "Hot chocolate mug with fireplace and tree lights.",
    src: "/assets/christmas/instagram-reel/clip_03.mp4",
    filename: "clip_03.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-04",
    title: "Living room wonderland",
    description: "Wide cozy living room with tree, gifts, and fireplace.",
    src: "/assets/christmas/instagram-reel/clip_04.mp4",
    filename: "clip_04.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-05",
    title: "Cookie plate by the tree",
    description: "Festive cookie plate held in front of the tree.",
    src: "/assets/christmas/instagram-reel/clip_05.mp4",
    filename: "clip_05.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-06",
    title: "Rockefeller Center evening",
    description: "Tree, rink, and Prometheus fountain.",
    src: "/assets/christmas/instagram-reel/clip_06.mp4",
    filename: "clip_06.mp4",
    category: "christmas_reels",
  },
  {
    id: "reel-07",
    title: "Window nook",
    description: "Cat, cocoa, and a snowy village outside the window.",
    src: "/assets/christmas/instagram-reel/clip_07.mp4",
    filename: "clip_07.mp4",
    category: "christmas_reels",
  },
  {
    id: "cabin-hero",
    title: "Cabin hero loop",
    description: "Desktop landing loop.",
    src: "/christmas/cabin-hero-loop.mp4",
    filename: "cabin-hero-loop.mp4",
    category: "christmas_marketing",
  },
  {
    id: "cabin-hero-720",
    title: "Cabin hero loop 720p",
    description: "Mobile landing loop.",
    src: "/christmas/cabin-hero-loop-720.mp4",
    filename: "cabin-hero-loop-720.mp4",
    category: "christmas_marketing",
  },
  {
    id: "advent-loop",
    title: "Advent calendar loop",
    description: "Advent product loop.",
    src: "/christmas/advent/advent-loop.mp4",
    filename: "advent-loop.mp4",
    category: "christmas_marketing",
  },
  {
    id: "advent-loop-540",
    title: "Advent calendar loop 540p",
    description: "Smaller Advent loop.",
    src: "/christmas/advent/advent-loop-540.mp4",
    filename: "advent-loop-540.mp4",
    category: "christmas_marketing",
  },
  {
    id: "gift-scene-desktop",
    title: "Gift tree · desktop",
    description: "Gift-tree landing scene.",
    src: "/christmas/gifts/scene-desktop.mp4",
    filename: "gift-tree-scene-desktop.mp4",
    category: "christmas_marketing",
  },
  {
    id: "gift-scene-mobile",
    title: "Gift tree · mobile",
    description: "Gift-tree landing scene (mobile crop).",
    src: "/christmas/gifts/scene-mobile.mp4",
    filename: "gift-tree-scene-mobile.mp4",
    category: "christmas_marketing",
  },
  {
    id: "gift-open",
    title: "Gift open",
    description: "Gift-open motion for the tree product.",
    src: "/christmas/gifts/gift-open.mp4",
    filename: "gift-open.mp4",
    category: "christmas_marketing",
  },
  ...petClips("dog", "pet_dog"),
  ...petClips("cat", "pet_cat"),
  ...petClips("other", "pet_other"),
];

export function librarySrcPath(src: string): string {
  return src.split("?")[0];
}

export function videosForCategory(categoryId: LibraryCategoryId | "all"): LibraryVideo[] {
  if (categoryId === "all") return LIBRARY_VIDEOS;
  return LIBRARY_VIDEOS.filter((video) => video.category === categoryId);
}

export function searchLibraryVideos(query: string, categoryId: LibraryCategoryId | "all"): LibraryVideo[] {
  const needle = query.trim().toLowerCase();
  const list = videosForCategory(categoryId);
  if (!needle) return list;
  return list.filter((video) =>
    [video.title, video.description, video.filename, video.id].join(" ").toLowerCase().includes(needle),
  );
}
