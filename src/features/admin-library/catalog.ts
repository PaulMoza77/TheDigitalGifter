export type LibraryCategoryId =
  | "christmas_reels"
  | "christmas_marketing"
  | "pet_dog"
  | "pet_cat"
  | "pet_other";

export type LibraryKind = "reel" | "short" | "photo";

export type LibraryVideo = {
  id: string;
  title: string;
  description: string;
  src: string;
  filename: string;
  category: LibraryCategoryId;
  kind: LibraryKind;
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

export type LibraryKindFilter = {
  id: LibraryKind;
  label: string;
  description: string;
};

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    id: "christmas_reels",
    label: "Christmas Reels",
    description:
      "Assembled Reels, short clips, and the stills used to generate them. Open Reels, Shorts, or Photos.",
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

export const CHRISTMAS_LIBRARY_KINDS: LibraryKindFilter[] = [
  {
    id: "reel",
    label: "Reels",
    description: "Assembled vertical Reels, about 10–15 seconds.",
  },
  {
    id: "short",
    label: "Shorts",
    description: "The 3–5s clips that make up the Reels — including NYC ice and snowy village.",
  },
  {
    id: "photo",
    label: "Photos",
    description: "Source stills used to generate the Reels and Shorts.",
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
    kind: "short",
    durationSeconds: 5,
    poster: `/pet/${species}/scenes/${slug}.webp`,
  }));
}

const CHRISTMAS_REELS: LibraryVideo[] = [
  {
    id: "reel-cut3",
    title: "NEW · Ice · Village kids · Prague Reel",
    description:
      "15s 1080×1920. NYC ice skater → Prague Old Town → kids sledding in the village → Polar Express → Santa. Mixed with the existing 1080p Kling masters.",
    src: "/assets/christmas/instagram-reel-cut3/final_christmas_reel_cut3.mp4",
    filename: "final_christmas_reel_cut3.mp4",
    category: "christmas_reels",
    kind: "reel",
    durationSeconds: 15,
    poster: "/assets/christmas/instagram-reel-cut3/posters/final.jpg",
  },
  {
    id: "reel-kling-1080p-cut2",
    title: "NEW · Kling 1080p Cut 2",
    description:
      "True 1080×1920 remix, ~15.5 Mbps, 12.5s. Four clips: Santa → market → Polar Express → cozy cat. No text overlay.",
    src: "/assets/christmas/instagram-reel-kling-1080p/final_christmas_reel_1080p_cut2.mp4",
    filename: "final_christmas_reel_1080p_cut2.mp4",
    category: "christmas_reels",
    kind: "reel",
    durationSeconds: 12.5,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/final_cut2.jpg",
  },
  {
    id: "reel-kling-1080p-final",
    title: "NEW · Kling 1080p Final Reel",
    description: "True 1080×1920, ~15.7 Mbps, 13.5s. Polar Express → Santa → market → chalet → cozy cat. No text overlay.",
    src: "/assets/christmas/instagram-reel-kling-1080p/final_christmas_reel_1080p.mp4",
    filename: "final_christmas_reel_1080p.mp4",
    category: "christmas_reels",
    kind: "reel",
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
    kind: "reel",
    durationSeconds: 13.5,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/final_text.jpg",
  },
  {
    id: "reel-cozy-final",
    title: "Cozy cottage Reel",
    description:
      "15s Kling cottage loop: cocoa, golden retriever, fireplace, snowy village outside the window. 1080×1920.",
    src: "/assets/christmas/cozy-reel/final_reel.mp4",
    filename: "cozy_cottage_reel.mp4",
    category: "christmas_reels",
    kind: "reel",
    durationSeconds: 15.13,
    poster: "/assets/christmas/cozy-reel/posters/final.jpg",
  },
  {
    id: "reel-final",
    title: "OLD · Wan 2.2 Final Reel",
    description:
      "Sep 16 test, ~13s. NYC snowy street → cottage → Rockefeller ice rink → living room → cocoa → cookies → snowy village window.",
    src: "/assets/christmas/instagram-reel/final_christmas_reel.mp4",
    filename: "final_christmas_reel.mp4",
    category: "christmas_reels",
    kind: "reel",
    durationSeconds: 13.4,
    poster: "/assets/christmas/instagram-reel/source/clip_01.jpg",
  },
];

const CHRISTMAS_SHORTS: LibraryVideo[] = [
  {
    id: "short-ice-nyc",
    title: "NYC girl ice skating",
    description: "5s 1080×1920. The New York street-rink skater you asked for.",
    src: "/assets/christmas/instagram-reel-cut3/clip_ice_nyc.mp4",
    filename: "clip_ice_nyc.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-cut3/posters/clip_ice_nyc.jpg",
  },
  {
    id: "short-kids-sled",
    title: "Kids sledding in the village",
    description: "5s 1080×1920. Children on sleds and a golden retriever in a snowy Alpine village.",
    src: "/assets/christmas/instagram-reel-cut3/clip_kids_sled.mp4",
    filename: "clip_kids_sled.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-cut3/posters/clip_kids_sled.jpg",
  },
  {
    id: "short-prague-square",
    title: "Prague Old Town Christmas square",
    description: "5s 1080×1920. Gingerbread stall, carousel, tree, and Tyn Church.",
    src: "/assets/christmas/instagram-reel-cut3/clip_prague_square.mp4",
    filename: "clip_prague_square.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-cut3/posters/clip_prague_square.jpg",
  },
  {
    id: "reel-kling-01-train",
    title: "NEW · Polar Express train",
    description: "Kling v3 Pro master, 1080×1920, ~5s. White Christmas train at Alpine Valley.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_01_train_raw.mp4",
    filename: "clip_01_train_raw.mp4",
    category: "christmas_reels",
    kind: "short",
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
    kind: "short",
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
    kind: "short",
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
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/chalet.jpg",
  },
  {
    id: "reel-kling-05-cozy",
    title: "NEW · Cozy window + snowy village",
    description: "Kling v3 Pro master, 1080×1920, ~5s. Cat, cocoa, and a snowy village outside the window.",
    src: "/assets/christmas/instagram-reel-kling-1080p/clip_05_cozy_raw.mp4",
    filename: "clip_05_cozy_raw.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/instagram-reel-kling-1080p/posters/cozy.jpg",
  },
  {
    id: "reel-01",
    title: "NYC snowy Christmas street",
    description: "Snow falling on a New York evening street with the Empire State Building in the distance.",
    src: "/assets/christmas/instagram-reel/clip_01.mp4",
    filename: "clip_01.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 2.2,
    poster: "/assets/christmas/instagram-reel/source/clip_01.jpg",
  },
  {
    id: "reel-06",
    title: "NYC Rockefeller ice rink",
    description:
      "Rockefeller Center at night: Christmas tree, Prometheus fountain, and people skating on the ice in New York.",
    src: "/assets/christmas/instagram-reel/clip_06.mp4",
    filename: "clip_06.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 2.2,
    poster: "/assets/christmas/instagram-reel/source/clip_06.jpg",
  },
  {
    id: "reel-02",
    title: "Candlelit cottage entrance",
    description: "Luxury snowy house entrance with lanterns.",
    src: "/assets/christmas/instagram-reel/clip_02.mp4",
    filename: "clip_02.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 1.2,
    poster: "/assets/christmas/instagram-reel/source/clip_02.jpg",
  },
  {
    id: "reel-03",
    title: "Cocoa by the fire",
    description: "Hot chocolate mug with fireplace and tree lights.",
    src: "/assets/christmas/instagram-reel/clip_03.mp4",
    filename: "clip_03.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 2.2,
    poster: "/assets/christmas/instagram-reel/source/clip_03.jpg",
  },
  {
    id: "reel-04",
    title: "Living room wonderland",
    description: "Wide cozy living room with tree, gifts, fireplace, and a snowy village outside.",
    src: "/assets/christmas/instagram-reel/clip_04.mp4",
    filename: "clip_04.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 2.2,
    poster: "/assets/christmas/instagram-reel/source/clip_04.jpg",
  },
  {
    id: "reel-05",
    title: "Cookie plate by the tree",
    description: "Festive cookie plate held in front of the tree.",
    src: "/assets/christmas/instagram-reel/clip_05.mp4",
    filename: "clip_05.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 1.2,
    poster: "/assets/christmas/instagram-reel/source/clip_05.jpg",
  },
  {
    id: "reel-07",
    title: "Snowy village window nook",
    description: "Cat, cocoa, and a snowy village outside the window.",
    src: "/assets/christmas/instagram-reel/clip_07.mp4",
    filename: "clip_07.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 2.2,
    poster: "/assets/christmas/instagram-reel/source/clip_07.jpg",
  },
  {
    id: "reel-cozy-01",
    title: "Cozy cottage · fireplace + snow",
    description: "Kling 5s. Cocoa, golden retriever, fireplace, snow falling on the village outside.",
    src: "/assets/christmas/cozy-reel/clip1.mp4",
    filename: "cozy_cottage_clip1.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/cozy-reel/posters/clip1.jpg",
  },
  {
    id: "reel-cozy-02",
    title: "Cozy cottage · cocoa + dog",
    description: "Kling 5s. Close mug of hot chocolate with a sleeping golden retriever.",
    src: "/assets/christmas/cozy-reel/clip2.mp4",
    filename: "cozy_cottage_clip2.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/cozy-reel/posters/clip2.jpg",
  },
  {
    id: "reel-cozy-03",
    title: "Cozy cottage · snowy village window",
    description: "Kling 5s. Fireplace, tree, and a snowy village through the window.",
    src: "/assets/christmas/cozy-reel/clip3.mp4",
    filename: "cozy_cottage_clip3.mp4",
    category: "christmas_reels",
    kind: "short",
    durationSeconds: 5.04,
    poster: "/assets/christmas/cozy-reel/posters/clip3.jpg",
  },
];

const NEW_STILL_PHOTOS: LibraryVideo[] = [
  {
    id: "photo-nyc-ice-girl",
    title: "Photo · NYC girl ice skating",
    description:
      "New York Christmas night. Young woman skating on a street rink with the Empire State Building behind her.",
    src: "/assets/christmas/library-stills/nyc_girl_ice_skating.jpg",
    filename: "nyc_girl_ice_skating.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-village-kids-sled",
    title: "Photo · Kids sledding in the village",
    description: "Alpine village at sunset. Children on sleds, a golden retriever, snowy houses, and a lake.",
    src: "/assets/christmas/library-stills/village_kids_sledding.jpg",
    filename: "village_kids_sledding.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-carousel",
    title: "Photo · Prague Old Town carousel",
    description: "Prague Christmas market square with Tyn Church, tree, carousel, and gingerbread.",
    src: "/assets/christmas/library-stills/prague_old_town_carousel_market.jpg",
    filename: "prague_old_town_carousel_market.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-balcony",
    title: "Photo · Prague balcony dessert table",
    description: "Christmas cookies and cocoa on a balcony overlooking Prague at sunset.",
    src: "/assets/christmas/library-stills/prague_balcony_christmas_spread.jpg",
    filename: "prague_balcony_christmas_spread.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-cafe",
    title: "Photo · Prague cafe street",
    description: "Cookies, cocoa, and a snowy Prague lane toward Tyn Church.",
    src: "/assets/christmas/library-stills/prague_cafe_street_cookies.jpg",
    filename: "prague_cafe_street_cookies.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-gingerbread",
    title: "Photo · Prague gingerbread stall",
    description: "Market stall of gingerbread and cakes with Prague towers behind.",
    src: "/assets/christmas/library-stills/prague_market_gingerbread_stall.jpg",
    filename: "prague_market_gingerbread_stall.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-bakery",
    title: "Photo · Prague bakery window",
    description: "Cozy bakery table of cookies and cocoa with Charles Bridge outside.",
    src: "/assets/christmas/library-stills/prague_bakery_window.jpg",
    filename: "prague_bakery_window.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-prague-couple",
    title: "Photo · Prague market couple",
    description: "Snowy Prague market with carousel, tree, and a couple walking with cocoa.",
    src: "/assets/christmas/library-stills/prague_market_couple_carousel.jpg",
    filename: "prague_market_couple_carousel.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-alpine-cocoa-bridge",
    title: "Photo · Alpine village cocoa",
    description: "Cocoa on a snowy balcony overlooking a lit Alpine village and stone bridge.",
    src: "/assets/christmas/library-stills/alpine_village_cocoa_bridge.jpg",
    filename: "alpine_village_cocoa_bridge.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-chalet-hot-tub",
    title: "Photo · Chalet hot tub",
    description: "Luxury snowy chalet with Christmas tree inside and a steaming outdoor spa.",
    src: "/assets/christmas/library-stills/alpine_chalet_hot_tub.jpg",
    filename: "alpine_chalet_hot_tub.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-luxury-train",
    title: "Photo · Luxury Christmas train",
    description: "Dark Orient-Express style train at an Alpine station at dusk.",
    src: "/assets/christmas/library-stills/alpine_luxury_christmas_train.jpg",
    filename: "alpine_luxury_christmas_train.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-santa-village-square",
    title: "Photo · Santa in the village square",
    description: "Storybook village with a giant tree, Santa’s sleigh, snowman, and a stream.",
    src: "/assets/christmas/library-stills/santa_village_square.jpg",
    filename: "santa_village_square.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-santa-sleigh-ride",
    title: "Photo · Santa sleigh ride",
    description: "Santa driving reindeer through snowy pines toward a lakeside village.",
    src: "/assets/christmas/library-stills/santa_reindeer_sleigh_ride.jpg",
    filename: "santa_reindeer_sleigh_ride.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-swiss-sleigh",
    title: "Photo · Swiss hotel horse sleigh",
    description: "Grand Swiss hotel at dusk with a horse-drawn sleigh and frozen lake.",
    src: "/assets/christmas/library-stills/swiss_hotel_horse_sleigh.jpg",
    filename: "swiss_hotel_horse_sleigh.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-matterhorn-pool",
    title: "Photo · Matterhorn infinity pool",
    description: "Luxury chalet terrace and steaming pool facing the Matterhorn at sunset.",
    src: "/assets/christmas/library-stills/matterhorn_infinity_pool.jpg",
    filename: "matterhorn_infinity_pool.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
];

const CHRISTMAS_PHOTOS: LibraryVideo[] = [
  ...NEW_STILL_PHOTOS,
  {
    id: "photo-kling-train",
    title: "Photo · Polar Express train",
    description: "Source still for the Kling Polar Express short.",
    src: "/assets/christmas/instagram-reel-kling-1080p/source/alpine_valley_polar_express_at_christmas.jpg",
    filename: "alpine_valley_polar_express_at_christmas.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-kling-santa",
    title: "Photo · Santa + sleigh",
    description: "Source still for the Kling Santa short.",
    src: "/assets/christmas/instagram-reel-kling-1080p/source/santa_s_moonlit_christmas_sleigh_ride.jpg",
    filename: "santa_s_moonlit_christmas_sleigh_ride.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-kling-market",
    title: "Photo · Cathedral Christmas market",
    description: "Source still for the Kling market short.",
    src: "/assets/christmas/instagram-reel-kling-1080p/source/snowy_christmas_market_by_the_cathedral.jpg",
    filename: "snowy_christmas_market_by_the_cathedral.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-kling-chalet",
    title: "Photo · Luxury snowy chalet",
    description: "Source still for the Kling chalet short.",
    src: "/assets/christmas/instagram-reel-kling-1080p/source/snowy_christmas_chalet_at_twilight.jpg",
    filename: "snowy_christmas_chalet_at_twilight.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-kling-village",
    title: "Photo · Snowy village window",
    description: "Source still for the Kling cozy short. Cat, cocoa, and a snowy village outside.",
    src: "/assets/christmas/instagram-reel-kling-1080p/source/cozy_christmas_reading_nook_by_snowy_village.jpg",
    filename: "cozy_christmas_reading_nook_by_snowy_village.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-nyc-street",
    title: "Photo · NYC snowy Christmas street",
    description: "Source still for the New York snow street short.",
    src: "/assets/christmas/instagram-reel/source/clip_01.jpg",
    filename: "nyc_snowy_christmas_street.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-ice-rink",
    title: "Photo · NYC Rockefeller ice rink",
    description: "Source still for the Rockefeller ice-skating short — tree, rink, and skaters in New York.",
    src: "/assets/christmas/instagram-reel/source/clip_06.jpg",
    filename: "nyc_rockefeller_ice_rink.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-cottage",
    title: "Photo · Candlelit cottage",
    description: "Source still for the cottage-entrance short.",
    src: "/assets/christmas/instagram-reel/source/clip_02.jpg",
    filename: "candlelit_christmas_cottage.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-cocoa",
    title: "Photo · Cocoa by the fire",
    description: "Source still for the cocoa short.",
    src: "/assets/christmas/instagram-reel/source/clip_03.jpg",
    filename: "cozy_christmas_cocoa.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-living-room",
    title: "Photo · Living room wonderland",
    description: "Source still for the living-room short.",
    src: "/assets/christmas/instagram-reel/source/clip_04.jpg",
    filename: "cozy_christmas_living_room.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-cookies",
    title: "Photo · Cookie plate",
    description: "Source still for the cookie-plate short.",
    src: "/assets/christmas/instagram-reel/source/clip_05.jpg",
    filename: "cozy_christmas_cookie_plate.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
  {
    id: "photo-wan-village",
    title: "Photo · Snowy village window nook",
    description: "Source still for the village-window short.",
    src: "/assets/christmas/instagram-reel/source/clip_07.jpg",
    filename: "snowy_village_window_nook.jpg",
    category: "christmas_reels",
    kind: "photo",
  },
];

const CHRISTMAS_MARKETING: LibraryVideo[] = [
  {
    id: "cabin-hero",
    title: "Cabin hero loop",
    description: "Desktop landing loop.",
    src: "/christmas/cabin-hero-loop.mp4",
    filename: "cabin-hero-loop.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "cabin-hero-720",
    title: "Cabin hero loop 720p",
    description: "Mobile landing loop.",
    src: "/christmas/cabin-hero-loop-720.mp4",
    filename: "cabin-hero-loop-720.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "advent-loop",
    title: "Advent calendar loop",
    description: "Advent product loop.",
    src: "/christmas/advent/advent-loop.mp4",
    filename: "advent-loop.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "advent-loop-540",
    title: "Advent calendar loop 540p",
    description: "Smaller Advent loop.",
    src: "/christmas/advent/advent-loop-540.mp4",
    filename: "advent-loop-540.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "gift-scene-desktop",
    title: "Gift tree · desktop",
    description: "Gift-tree landing scene.",
    src: "/christmas/gifts/scene-desktop.mp4",
    filename: "gift-tree-scene-desktop.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "gift-scene-mobile",
    title: "Gift tree · mobile",
    description: "Gift-tree landing scene (mobile crop).",
    src: "/christmas/gifts/scene-mobile.mp4",
    filename: "gift-tree-scene-mobile.mp4",
    category: "christmas_marketing",
    kind: "reel",
  },
  {
    id: "gift-open",
    title: "Gift open",
    description: "Gift-open motion for the tree product.",
    src: "/christmas/gifts/gift-open.mp4",
    filename: "gift-open.mp4",
    category: "christmas_marketing",
    kind: "short",
  },
];

export const LIBRARY_VIDEOS: LibraryVideo[] = [
  ...CHRISTMAS_REELS,
  ...CHRISTMAS_SHORTS,
  ...CHRISTMAS_PHOTOS,
  ...CHRISTMAS_MARKETING,
  ...petClips("dog", "pet_dog"),
  ...petClips("cat", "pet_cat"),
  ...petClips("other", "pet_other"),
];

export function librarySrcPath(src: string): string {
  return src.split("?")[0];
}

export function isLibraryPhoto(item: LibraryVideo): boolean {
  return item.kind === "photo" || /\.(jpe?g|png|webp)$/i.test(item.filename);
}

export function videosForCategory(categoryId: LibraryCategoryId | "all"): LibraryVideo[] {
  if (categoryId === "all") return LIBRARY_VIDEOS;
  return LIBRARY_VIDEOS.filter((video) => video.category === categoryId);
}

export function searchLibraryVideos(
  query: string,
  categoryId: LibraryCategoryId | "all",
  kind: LibraryKind | "all" = "all",
): LibraryVideo[] {
  const needle = query.trim().toLowerCase();
  let list = videosForCategory(categoryId);
  if (kind !== "all") list = list.filter((item) => item.kind === kind);
  if (!needle) return list;
  return list.filter((video) =>
    [video.title, video.description, video.filename, video.id].join(" ").toLowerCase().includes(needle),
  );
}

export function countChristmasKind(kind: LibraryKind): number {
  return LIBRARY_VIDEOS.filter((item) => item.category === "christmas_reels" && item.kind === kind).length;
}
