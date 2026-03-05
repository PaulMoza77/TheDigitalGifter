// src/components/funnelVersion/occasions.ts

export type FunnelOccasionKey =
  | "christmas"
  | "birthday"
  | "pregnancy"
  | "wedding"
  | "anniversary"
  | "valentines-day"
  | "new-years-eve"
  | "thanksgiving"
  | "baby-reveal"
  | "new-born"
  | "easter"
  | "mothers-day"
  | "fathers-day"
  | "graduation";

export type FunnelOccasionConfig = {
  key: FunnelOccasionKey;

  // Hero
  heroTitle: string;
  heroSubtitle: string;

  // Optional: swaps the mock images in hero
  heroBeforeVariant?: string; // ex: "vintage"
  heroAfterVariant?: string; // ex: "winter"

  // CTA target
  ctaTo: string;
};

export const FUNNEL_OCCASIONS: Record<FunnelOccasionKey, FunnelOccasionConfig> = {
  christmas: {
    key: "christmas",
    heroTitle: "Bring Your Photos to Life",
    heroSubtitle:
      "Upload a photo and generate a moving memory in minutes. Perfect for winter surprises and heartfelt gifts.",
    heroBeforeVariant: "vintage",
    heroAfterVariant: "winter",
    ctaTo: "/funnel/uploadPhoto",
  },

  birthday: {
    key: "birthday",
    heroTitle: "Make birthdays feel unforgettable",
    heroSubtitle:
      "Turn a favorite photo into a moving birthday surprise — personal, emotional, and ready to share.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  pregnancy: {
    key: "pregnancy",
    heroTitle: "Celebrate your pregnancy with motion",
    heroSubtitle:
      "Create a gentle, emotional moving memory from your maternity photo — perfect for sharing with family.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "love",
    ctaTo: "/funnel/uploadPhoto",
  },

  wedding: {
    key: "wedding",
    heroTitle: "Turn your wedding photo into a living memory",
    heroSubtitle:
      "A timeless moving gift from your best wedding moment — elegant, subtle, and made to be shared.",
    heroBeforeVariant: "vintage",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  anniversary: {
    key: "anniversary",
    heroTitle: "Celebrate your love story",
    heroSubtitle:
      "Create a romantic moving memory from your couple photo — perfect for anniversaries and love notes.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "love",
    ctaTo: "/funnel/uploadPhoto",
  },

  "valentines-day": {
    key: "valentines-day",
    heroTitle: "Valentine’s gifts that feel real",
    heroSubtitle:
      "Turn a photo into a moving love message in minutes — subtle motion, big emotion.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "love",
    ctaTo: "/funnel/uploadPhoto",
  },

  "new-years-eve": {
    key: "new-years-eve",
    heroTitle: "Start the year with a moving memory",
    heroSubtitle:
      "Make a photo feel alive again — perfect for New Year messages and shareable moments.",
    heroBeforeVariant: "vintage",
    heroAfterVariant: "winter",
    ctaTo: "/funnel/uploadPhoto",
  },

  thanksgiving: {
    key: "thanksgiving",
    heroTitle: "Say thanks with something personal",
    heroSubtitle:
      "Turn a family photo into a moving memory — warm, heartfelt, and made to share.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  "baby-reveal": {
    key: "baby-reveal",
    heroTitle: "Make your baby reveal unforgettable",
    heroSubtitle:
      "Create a moving memory from your photo — perfect for sharing the big news.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  "new-born": {
    key: "new-born",
    heroTitle: "Newborn moments, brought to life",
    heroSubtitle:
      "Turn a newborn photo into a gentle moving keepsake — made for family and friends.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  easter: {
    key: "easter",
    heroTitle: "Easter memories that move",
    heroSubtitle:
      "Create a joyful moving memory from your photo — quick to make, beautiful to share.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  "mothers-day": {
    key: "mothers-day",
    heroTitle: "A Mother’s Day gift that hits the heart",
    heroSubtitle:
      "Turn a photo into a moving memory — thoughtful, personal, and ready to share.",
    heroBeforeVariant: "vintage",
    heroAfterVariant: "love",
    ctaTo: "/funnel/uploadPhoto",
  },

  "fathers-day": {
    key: "fathers-day",
    heroTitle: "A Father’s Day gift that feels real",
    heroSubtitle:
      "Create a moving memory from a photo — a simple surprise with big emotion.",
    heroBeforeVariant: "vintage",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },

  graduation: {
    key: "graduation",
    heroTitle: "Graduation memories, brought to life",
    heroSubtitle:
      "Turn a proud moment into a moving keepsake — perfect for sharing and celebrating.",
    heroBeforeVariant: "warm",
    heroAfterVariant: "cinematic",
    ctaTo: "/funnel/uploadPhoto",
  },
};