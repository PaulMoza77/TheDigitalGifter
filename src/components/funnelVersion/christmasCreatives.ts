/**
 * Christmas funnel creatives.
 * Before stills are the original photos. After is a ~5s Higgsfield clip
 * generated from that same photo (see scripts/generate_christmas_funnel_clips.py).
 */
export type ChristmasCreative = {
  id: "family" | "morning" | "gift";
  name: string;
  location: string;
  quote: string;
  beforeSrc: string;
  posterSrc: string;
  clipSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

export const CHRISTMAS_CREATIVES: ChristmasCreative[] = [
  {
    id: "family",
    name: "Emily R.",
    location: "Portland, OR",
    quote: "Our family photo finally felt alive. The lights move, and it still looks like us.",
    beforeSrc: "/assets/funnel/christmas-before.png",
    posterSrc: "/assets/funnel/christmas-clips/family.jpg",
    clipSrc: "/assets/funnel/christmas-clips/family.mp4",
    beforeAlt: "Original Christmas family photo",
    afterAlt: "Five-second clip of the same Christmas family photo",
  },
  {
    id: "morning",
    name: "Marcus T.",
    location: "Chicago, IL",
    quote: "I sent the morning-gifts clip as a card. Relatives played it twice.",
    beforeSrc: "/assets/funnel/christmas-ex2-before.png",
    posterSrc: "/assets/funnel/christmas-clips/morning.jpg",
    clipSrc: "/assets/funnel/christmas-clips/morning.mp4",
    beforeAlt: "Original Christmas morning photo of a family opening gifts",
    afterAlt: "Five-second clip of the same Christmas morning photo",
  },
  {
    id: "gift",
    name: "Sofia L.",
    location: "Denver, CO",
    quote: "Soft snowfall, same little face. It feels like a memory, not a filter.",
    beforeSrc: "/assets/funnel/christmas-ex3-before.png",
    posterSrc: "/assets/funnel/christmas-clips/gift.jpg",
    clipSrc: "/assets/funnel/christmas-clips/gift.mp4",
    beforeAlt: "Original photo of a child holding a Christmas gift",
    afterAlt: "Five-second clip of the same child with a Christmas gift",
  },
];

export const CHRISTMAS_HERO_CREATIVE = CHRISTMAS_CREATIVES[0];
