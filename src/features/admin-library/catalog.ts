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
  /** Known length in seconds. Used before the file metadata loads. */
  durationSeconds?: number;
  /** Still image shown until the first video frame paints (iOS often stays black otherwise). */
  poster?: string;
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
    description:
      "NEW Kling 1080p Reels first, then the older Wan 2.2 test clips (NYC street, cocoa, cottage).",
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
    durationSeconds: 5,
    poster: `/pet/${species}/scenes/${slug}.webp`,
  }));
}

export const LIBRARY_VIDEOS: LibraryVideo[] = [
  {
    id: "reel-kling-1080p-final",
    title: "NEW · Kling 1080p Final Reel",
    description: "True 1080×1920, ~15.7 Mbps, 13.5s. Polar Express → Santa → market → chalet → cozy cat. No text overlay.",
    src: "/assets/christmas/instagram-reel-kling-1080p/final_christmas_reel_1080p.mp4",
    filename: "final_christmas_reel_1080p.mp4",
    category: "christmas_reels",
    durationSeconds: 13.5,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/final.jpg",
  },
  {
    id: "reel-kling-1080p-final-text",
    title: "NEW · Kling 1080p Final Reel (text)",
    description: "Same 1080×1920 cut with “Christmas is getting closer” overlay.",
    src: "/assets/christmas/instagram-reel-kling-1080p/final_christmas_reel_1080p_text.mp4",
    filename: "final_christmas_reel_1080p_text.mp4",
    category: "christmas_reels",
    durationSeconds: 13.5,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/final_text.jpg",
  },
  {
    id: "reel-kling-01-train",
    title: "NEW · Polar Express train",
    description: "Kling v3 Pro master, 1080×1920, ~5s. White Christmas train at Alpine Valley.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_01_train_raw.mp4",
    filename: "clip_01_train_raw.mp4",
    category: "christmas_reels",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/train.jpg",
  },
  {
    id: "reel-kling-02-santa",
    title: "NEW · Santa + sleigh + reindeer",
    description: "Kling v3 Pro master, 1080×1920, ~5s. Moonlit Santa beside the sleigh.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_02_santa_raw.mp4",
    filename: "clip_02_santa_raw.mp4",
    category: "christmas_reels",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/santa.jpg",
  },
  {
    id: "reel-kling-03-market",
    title: "NEW · Cathedral Christmas market",
    description: "Kling v3 Pro master, 1080×1920, ~5s. European market street and carousel.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_03_market_raw.mp4",
    filename: "clip_03_market_raw.mp4",
    category: "christmas_reels",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/market.jpg",
  },
  {
    id: "reel-kling-04-chalet",
    title: "NEW · Luxury snowy chalet",
    description: "Kling v3 Pro master, 1080×1920, ~5s. Twilight chalet entrance.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_04_chalet_raw.mp4",
    filename: "clip_04_chalet_raw.mp4",
    category: "christmas_reels",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/chalet.jpg",
  },
  {
    id: "reel-kling-05-cozy",
    title: "NEW · Cozy window + cat",
    description: "Kling v3 Pro master, 1080×1920, ~5s. Cat, cocoa, snowy village outside.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_05_cozy_raw.mp4",
    filename: "clip_05_cozy_raw.mp4",
    category: "christmas_reels",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/cozy.jpg",
  },
  {
    id: "reel-final",
    title: "OLD · Wan 2.2 Final Reel",
    description: "Previous Sep 16 test (NYC street, cottage, cocoa). Not the Kling 1080p job.",
    src: "/assets/christmas/instagram-reel/final_christmas_reel.mp4",
    filename: "final_christmas_reel.mp4",
    category: "christmas_reels",
    durationSeconds: 13.4,
  },
  {
    id: "reel-01",
    title: "OLD · NYC Christmas street",
    description: "Snowy evening street with Empire State in the distance.",
    src: "/assets/christmas/instagram-reel/clip_01.mp4",
    filename: "clip_01.mp4",
    category: "christmas_reels",
    durationSeconds: 2.2,
  },
  {
    id: "reel-02",
    title: "OLD · Candlelit cottage entrance",
    description: "Luxury snowy house entrance with lanterns.",
    src: "/assets/christmas/instagram-reel/clip_02.mp4",
    filename: "clip_02.mp4",
    category: "christmas_reels",
    durationSeconds: 1.2,
  },
  {
    id: "reel-03",
    title: "OLD · Cocoa by the fire",
    description: "Hot chocolate mug with fireplace and tree lights.",
    src: "/assets/christmas/instagram-reel/clip_03.mp4",
    filename: "clip_03.mp4",
    category: "christmas_reels",
    durationSeconds: 2.2,
  },
  {
    id: "reel-04",
    title: "OLD · Living room wonderland",
    description: "Wide cozy living room with tree, gifts, and fireplace.",
    src: "/assets/christmas/instagram-reel/clip_04.mp4",
    filename: "clip_04.mp4",
    category: "christmas_reels",
    durationSeconds: 2.2,
  },
  {
    id: "reel-05",
    title: "OLD · Cookie plate by the tree",
    description: "Festive cookie plate held in front of the tree.",
    src: "/assets/christmas/instagram-reel/clip_05.mp4",
    filename: "clip_05.mp4",
    category: "christmas_reels",
    durationSeconds: 1.2,
  },
  {
    id: "reel-06",
    title: "OLD · Rockefeller Center evening",
    description: "Tree, rink, and Prometheus fountain.",
    src: "/assets/christmas/instagram-reel/clip_06.mp4",
    filename: "clip_06.mp4",
    category: "christmas_reels",
    durationSeconds: 2.2,
  },
  {
    id: "reel-07",
    title: "OLD · Window nook",
    description: "Cat, cocoa, and a snowy village outside the window.",
    src: "/assets/christmas/instagram-reel/clip_07.mp4",
    filename: "clip_07.mp4",
    category: "christmas_reels",
    durationSeconds: 2.2,
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
