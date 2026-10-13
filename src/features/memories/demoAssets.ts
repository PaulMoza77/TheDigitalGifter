/** Public Memories landing demo assets (fictional / consenting-person styled). */

export const MEMORIES_DEMO_DISCLAIMER =
  "Fictional demonstration · not a real recording of any person";

export const MEMORIES_HERO_DEMO = {
  before: "/assets/memories/demo-before.jpg",
  afterVideo: "/assets/memories/demo-after.mp4",
  afterPoster: "/assets/memories/demo-after-poster.jpg",
  label: "Sunday dinner",
  beforeAlt: "Fictional demonstration still photograph before animation",
  afterAlt: "Fictional demonstration: short animated preview created from the still photograph",
} as const;

export const MEMORIES_GALLERY_DEMOS = [
  {
    id: "gallery_garden",
    label: "Garden afternoon",
    still: "/assets/memories/gallery-1.jpg",
    alt: "Fictional demonstration still: garden afternoon",
  },
  {
    id: "gallery_living_room",
    label: "Quiet afternoon",
    still: "/assets/memories/gallery-2.jpg",
    alt: "Fictional demonstration still: quiet afternoon",
  },
  {
    id: "gallery_celebration",
    label: "Celebration night",
    still: "/assets/memories/gallery-3.jpg",
    alt: "Fictional demonstration still: celebration night",
  },
] as const;
