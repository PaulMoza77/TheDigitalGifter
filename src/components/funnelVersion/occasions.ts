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

export type FunnelExampleItem = {
  beforeVariant: string;
  afterVariant: string;
};

export type FunnelValueItem = {
  title: string;
  desc: string;
  variant: string;
};

export type FunnelOccasionConfig = {
  key: FunnelOccasionKey;

  // Hero
  heroTitle: string;
  heroSubtitle: string;
  heroCaption?: string;
  ctaLabel?: string;

  // Hero before/after under /assets/funnel/{variant}.png
  heroBeforeVariant: string;
  heroAfterVariant: string;

  // Optional lower-page content
  examples?: FunnelExampleItem[];
  valueTrio?: FunnelValueItem[];

  // CTA target (upload builder uses occasion slug)
  ctaTo: string;
};

const asset = (name: string) => name;

export const FUNNEL_OCCASIONS: Record<FunnelOccasionKey, FunnelOccasionConfig> = {
  christmas: {
    key: "christmas",
    heroTitle: "Turn a Christmas photo into a personalized still image",
    heroSubtitle:
      "Upload a holiday photo and create a warm, shareable Christmas still image.",
    heroCaption: "A still-image example of a Christmas photo and a selected style.",
    ctaLabel: "Try now — Create a Christmas gift",
    heroBeforeVariant: asset("christmas-before"),
    heroAfterVariant: asset("christmas-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "christmas-before",
        afterVariant: "christmas-after",
      },
{ beforeVariant: "christmas-ex2-before",
        afterVariant: "christmas-ex2-after",
      },
{ beforeVariant: "christmas-ex3-before",
        afterVariant: "christmas-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Start with a holiday photo",
        desc: "Choose a Christmas photo and a festive still-image style.",
        variant: "christmas-after",
      },
{
        title: "Share a Christmas keepake",
        desc: "Send a holiday still image that feels personal, not like a generic card.",
        variant: "christmas-ex2-after",
      },
{
        title: "Preserve this year’s magic",
        desc: "Turn one photo into a Christmas moment you’ll want to reopen every year.",
        variant: "christmas-ex3-after",
      }
    ],
  },

  birthday: {
    key: "birthday",
    heroTitle: "Make birthdays feel unforgettable",
    heroSubtitle:
      "Turn a favorite birthday photo into a personalized still image.",
    heroCaption: "A still-image example of a birthday photo and a selected style.",
    ctaLabel: "Try now — Create a birthday gift",
    heroBeforeVariant: asset("birthday-before"),
    heroAfterVariant: asset("birthday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "birthday-before",
        afterVariant: "birthday-after",
      },
{ beforeVariant: "birthday-ex2-before",
        afterVariant: "birthday-ex2-after",
      },
{ beforeVariant: "birthday-ex3-before",
        afterVariant: "birthday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate this birthday",
        desc: "Candles, smiles, and a still-image style made for birthdays.",
        variant: "birthday-after",
      },
{
        title: "Surprise the guest of honor",
        desc: "Turn one photo into a shareable birthday still image.",
        variant: "birthday-ex2-after",
      },
{
        title: "Keep the party forever",
        desc: "A still-image keepsake from the day — warm, joyful, and gift-ready.",
        variant: "birthday-ex3-after",
      }
    ],
  },

  pregnancy: {
    key: "pregnancy",
    heroTitle: "Celebrate pregnancy with a personalized still image",
    heroSubtitle:
      "Create a still-image keepsake from your maternity photo for announcing and sharing with family.",
    heroCaption: "A still-image example of a maternity photo and a selected style.",
    ctaLabel: "Try now — Create a pregnancy gift",
    heroBeforeVariant: asset("pregnancy-before"),
    heroAfterVariant: asset("pregnancy-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "pregnancy-before",
        afterVariant: "pregnancy-after",
      },
{ beforeVariant: "pregnancy-ex2-before",
        afterVariant: "pregnancy-ex2-after",
      },
{ beforeVariant: "pregnancy-ex3-before",
        afterVariant: "pregnancy-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor this chapter",
        desc: "A calm still-image style that celebrates the wait.",
        variant: "pregnancy-after",
      },
{
        title: "Share the news beautifully",
        desc: "A maternity moment ready for family chats and keepsake albums.",
        variant: "pregnancy-ex2-after",
      },
{
        title: "Keep the glow forever",
        desc: "Preserve this season of anticipation as a still image.",
        variant: "pregnancy-ex3-after",
      }
    ],
  },

  wedding: {
    key: "wedding",
    heroTitle: "Turn your wedding photo into a personalized still image",
    heroSubtitle:
      "A still-image gift from your best wedding moment — made to be shared.",
    heroCaption: "A still-image example of a wedding photo and a selected style.",
    ctaLabel: "Try now — Create a wedding gift",
    heroBeforeVariant: asset("wedding-before"),
    heroAfterVariant: asset("wedding-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "wedding-before",
        afterVariant: "wedding-after",
      },
{ beforeVariant: "wedding-ex2-before",
        afterVariant: "wedding-ex2-after",
      },
{ beforeVariant: "wedding-ex3-before",
        afterVariant: "wedding-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Relive the vows",
        desc: "A still-image style that honors the romance of the day.",
        variant: "wedding-after",
      },
{
        title: "Share with guests",
        desc: "A wedding keepake that feels premium and personal.",
        variant: "wedding-ex2-after",
      },
{
        title: "A gift for years ahead",
        desc: "Preserve your favorite frame as a still-image keepsake.",
        variant: "wedding-ex3-after",
      }
    ],
  },

  anniversary: {
    key: "anniversary",
    heroTitle: "Celebrate your love story with a still image",
    heroSubtitle:
      "Create a romantic still image from your couple photo — for anniversaries and love notes.",
    heroCaption: "A still-image example of a couple photo and a selected style.",
    ctaLabel: "Try now — Create an anniversary gift",
    heroBeforeVariant: asset("anniversary-before"),
    heroAfterVariant: asset("anniversary-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "anniversary-before",
        afterVariant: "anniversary-after",
      },
{ beforeVariant: "anniversary-ex2-before",
        afterVariant: "anniversary-ex2-after",
      },
{ beforeVariant: "anniversary-ex3-before",
        afterVariant: "anniversary-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate your years together",
        desc: "A still-image style for the milestone that matters.",
        variant: "anniversary-after",
      },
{
        title: "A love note in a still image",
        desc: "More personal than a generic card — and ready to share after generation.",
        variant: "anniversary-ex2-after",
      },
{
        title: "Keep the spark visible",
        desc: "Turn one favorite photo into an anniversary keepsake.",
        variant: "anniversary-ex3-after",
      }
    ],
  },

  "valentines-day": {
    key: "valentines-day",
    heroTitle: "Valentine’s gifts that feel real",
    heroSubtitle:
      "Turn a photo into a personalized Valentine still image.",
    heroCaption: "From a couple snap to a Valentine that feels personal.",
    ctaLabel: "Try now — Create a Valentine gift",
    heroBeforeVariant: asset("valentines-before"),
    heroAfterVariant: asset("valentines-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "valentines-before",
        afterVariant: "valentines-after",
      },
{ beforeVariant: "valentines-ex2-before",
        afterVariant: "valentines-ex2-after",
      },
{ beforeVariant: "valentines-ex3-before",
        afterVariant: "valentines-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Say it with a still image",
        desc: "A Valentine that feels intimate, warm, and share-ready.",
        variant: "valentines-after",
      },
{
        title: "Skip the generic card",
        desc: "Your photo becomes the gift — romantic and personal.",
        variant: "valentines-ex2-after",
      },
{
        title: "Made for love notes",
        desc: "A still-image style that puts the photo first.",
        variant: "valentines-ex3-after",
      }
    ],
  },

  "new-years-eve": {
    key: "new-years-eve",
    heroTitle: "Start the year with a personalized still image",
    heroSubtitle:
      "Turn a New Year’s photo into a sparkling, shareable still image.",
    heroCaption: "A still-image example of a New Year photo and a selected style.",
    ctaLabel: "Try now — Create a New Year gift",
    heroBeforeVariant: asset("newyears-before"),
    heroAfterVariant: asset("newyears-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "newyears-before",
        afterVariant: "newyears-after",
      },
{ beforeVariant: "newyears-ex2-before",
        afterVariant: "newyears-ex2-after",
      },
{ beforeVariant: "newyears-ex3-before",
        afterVariant: "newyears-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate the new year",
        desc: "Soft sparkle in a still image for your New Year’s moment.",
        variant: "newyears-after",
      },
{
        title: "Share the first memory",
        desc: "A still image to share with friends and family.",
        variant: "newyears-ex2-after",
      },
{
        title: "Keep the night alive",
        desc: "One photo, a whole celebration feeling.",
        variant: "newyears-ex3-after",
      }
    ],
  },

  thanksgiving: {
    key: "thanksgiving",
    heroTitle: "Say thanks with something personal",
    heroSubtitle:
      "Turn a family Thanksgiving photo into a warm, shareable still image.",
    heroCaption: "A still-image example of a Thanksgiving photo and a selected style.",
    ctaLabel: "Try now — Create a Thanksgiving gift",
    heroBeforeVariant: asset("thanksgiving-before"),
    heroAfterVariant: asset("thanksgiving-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "thanksgiving-before",
        afterVariant: "thanksgiving-after",
      },
{ beforeVariant: "thanksgiving-ex2-before",
        afterVariant: "thanksgiving-ex2-after",
      },
{ beforeVariant: "thanksgiving-ex3-before",
        afterVariant: "thanksgiving-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Thank them with a still image",
        desc: "A warm family keepake that feels grateful and personal.",
        variant: "thanksgiving-after",
      },
{
        title: "Celebrate togetherness",
        desc: "Autumn warmth in a shareable still image.",
        variant: "thanksgiving-ex2-after",
      },
{
        title: "Preserve the gathering",
        desc: "One dinner photo, a memory that keeps giving.",
        variant: "thanksgiving-ex3-after",
      }
    ],
  },

  "baby-reveal": {
    key: "baby-reveal",
    heroTitle: "Make your baby reveal unforgettable",
    heroSubtitle:
      "Create a still-image reveal from your photo — for sharing the big news.",
    heroCaption: "From a reveal photo to a share-worthy announcement.",
    ctaLabel: "Try now — Create a baby reveal",
    heroBeforeVariant: asset("babyreveal-before"),
    heroAfterVariant: asset("babyreveal-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "babyreveal-before",
        afterVariant: "babyreveal-after",
      },
{ beforeVariant: "babyreveal-ex2-before",
        afterVariant: "babyreveal-ex2-after",
      },
{ beforeVariant: "babyreveal-ex3-before",
        afterVariant: "babyreveal-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Announce with emotion",
        desc: "A reveal moment that feels exciting and gift-ready.",
        variant: "babyreveal-after",
      },
{
        title: "Share the big news",
        desc: "A still-image style for a clear, shareable announcement.",
        variant: "babyreveal-ex2-after",
      },
{
        title: "Keep the reveal forever",
        desc: "A keepsake from the day you told the world.",
        variant: "babyreveal-ex3-after",
      }
    ],
  },

  "new-born": {
    key: "new-born",
    heroTitle: "Newborn moments as a personalized still image",
    heroSubtitle:
      "Turn a newborn photo into a gentle still-image keepsake for family and friends.",
    heroCaption: "A still-image example of a newborn photo and a selected style.",
    ctaLabel: "Try now — Create a newborn gift",
    heroBeforeVariant: asset("newborn-before"),
    heroAfterVariant: asset("newborn-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "newborn-before",
        afterVariant: "newborn-after",
      },
{ beforeVariant: "newborn-ex2-before",
        afterVariant: "newborn-ex2-after",
      },
{ beforeVariant: "newborn-ex3-before",
        afterVariant: "newborn-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor those first days",
        desc: "A still-image style that keeps newborn photos tender.",
        variant: "newborn-after",
      },
{
        title: "Share with family",
        desc: "A still image to share with grandparents, aunts, and friends.",
        variant: "newborn-ex2-after",
      },
{
        title: "Keep the beginning forever",
        desc: "One tiny photo becomes a lifelong keepsake.",
        variant: "newborn-ex3-after",
      }
    ],
  },

  easter: {
    key: "easter",
    heroTitle: "Easter memories as a still image",
    heroSubtitle:
      "Create a joyful spring keepsake from your Easter photo — soft pastels, warm smiles, ready to share.",
    heroCaption: "A still-image example of an Easter photo and a selected style.",
    ctaLabel: "Try now — Create an Easter gift",
    heroBeforeVariant: asset("easter-before"),
    heroAfterVariant: asset("easter-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "easter-before",
        afterVariant: "easter-after",
      },
{ beforeVariant: "easter-ex2-before",
        afterVariant: "easter-ex2-after",
      },
{ beforeVariant: "easter-ex3-before",
        afterVariant: "easter-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate spring joy",
        desc: "Pastel warmth in a still image for Easter mornings.",
        variant: "easter-after",
      },
{
        title: "Share the hunt",
        desc: "A still image from baskets, blooms, and smiles.",
        variant: "easter-ex2-after",
      },
{
        title: "Keep the season",
        desc: "One photo, a spring keepsake worth revisiting.",
        variant: "easter-ex3-after",
      }
    ],
  },

  "mothers-day": {
    key: "mothers-day",
    heroTitle: "A Mother’s Day gift that hits the heart",
    heroSubtitle:
      "Turn a mom photo into a thoughtful, personal still image.",
    heroCaption: "A still-image example of a mom photo and a selected style.",
    ctaLabel: "Try now — Create a Mother’s Day gift",
    heroBeforeVariant: asset("mothersday-before"),
    heroAfterVariant: asset("mothersday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "mothersday-before",
        afterVariant: "mothersday-after",
      },
{ beforeVariant: "mothersday-ex2-before",
        afterVariant: "mothersday-ex2-after",
      },
{ beforeVariant: "mothersday-ex3-before",
        afterVariant: "mothersday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor Mom with a still image",
        desc: "A personal keepake that feels warmer than flowers alone.",
        variant: "mothersday-after",
      },
{
        title: "Made from your photo",
        desc: "Her smile in a thoughtful, shareable still image.",
        variant: "mothersday-ex2-after",
      },
{
        title: "A gift she’ll reopen",
        desc: "Preserve a favorite mom moment for years.",
        variant: "mothersday-ex3-after",
      }
    ],
  },

  "fathers-day": {
    key: "fathers-day",
    heroTitle: "A Father’s Day gift that feels real",
    heroSubtitle:
      "Create a still image from a dad photo — simple and ready to share.",
    heroCaption: "From a dad snapshot to a Father’s Day keepake.",
    ctaLabel: "Try now — Create a Father’s Day gift",
    heroBeforeVariant: asset("fathersday-before"),
    heroAfterVariant: asset("fathersday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "fathersday-before",
        afterVariant: "fathersday-after",
      },
{ beforeVariant: "fathersday-ex2-before",
        afterVariant: "fathersday-ex2-after",
      },
{ beforeVariant: "fathersday-ex3-before",
        afterVariant: "fathersday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate Dad",
        desc: "A still image that feels genuine, not gimmicky.",
        variant: "fathersday-after",
      },
{
        title: "Surprise him simply",
        desc: "One photo becomes a gift with quiet emotion.",
        variant: "fathersday-ex2-after",
      },
{
        title: "Keep the bond",
        desc: "Preserve a favorite dad moment forever.",
        variant: "fathersday-ex3-after",
      }
    ],
  },

  graduation: {
    key: "graduation",
    heroTitle: "Graduation memories as a personalized still image",
    heroSubtitle:
      "Turn a proud graduation photo into a still-image keepsake ready to share.",
    heroCaption: "A still-image example of a graduation photo and a selected style.",
    ctaLabel: "Try now — Create a graduation gift",
    heroBeforeVariant: asset("graduation-before"),
    heroAfterVariant: asset("graduation-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{ beforeVariant: "graduation-before",
        afterVariant: "graduation-after",
      },
{ beforeVariant: "graduation-ex2-before",
        afterVariant: "graduation-ex2-after",
      },
{ beforeVariant: "graduation-ex3-before",
        afterVariant: "graduation-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor the milestone",
        desc: "A still-image style for caps, gowns, and hard-earned smiles.",
        variant: "graduation-after",
      },
{
        title: "Share the achievement",
        desc: "A graduation still image families can share.",
        variant: "graduation-ex2-after",
      },
{
        title: "Keep the day forever",
        desc: "One photo becomes a lifelong celebration keepake.",
        variant: "graduation-ex3-after",
      }
    ],
  },
};

/** Map any URL / query slug to a FUNNEL_OCCASIONS key. */
export function toFunnelOccasionKey(raw: string): FunnelOccasionKey {
  const x = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  const aliases: Record<string, FunnelOccasionKey> = {
    christmas: "christmas",
    birthday: "birthday",
    pregnancy: "pregnancy",
    wedding: "wedding",
    anniversary: "anniversary",
    "valentines-day": "valentines-day",
    valentine: "valentines-day",
    valentines: "valentines-day",
    "new-years-eve": "new-years-eve",
    "new-year": "new-years-eve",
    newyear: "new-years-eve",
    thanksgiving: "thanksgiving",
    "thanks-giving": "thanksgiving",
    "baby-reveal": "baby-reveal",
    "gender-reveal": "baby-reveal",
    "new-born": "new-born",
    newborn: "new-born",
    easter: "easter",
    "mothers-day": "mothers-day",
    mothersday: "mothers-day",
    "fathers-day": "fathers-day",
    fathersday: "fathers-day",
    graduation: "graduation",
  };

  return aliases[x] ?? "christmas";
}

/**
 * Slug used by upload / style-select query params.
 * Keeps existing downstream normalizers (newborn, valentines_day, …).
 */
export function toFunnelUploadSlug(raw: string): string {
  const key = toFunnelOccasionKey(raw);
  const map: Record<FunnelOccasionKey, string> = {
    christmas: "christmas",
    birthday: "birthday",
    pregnancy: "pregnancy",
    wedding: "wedding",
    anniversary: "anniversary",
    "valentines-day": "valentines_day",
    "new-years-eve": "new_years_eve",
    thanksgiving: "thanksgiving",
    "baby-reveal": "baby_reveal",
    "new-born": "newborn",
    easter: "easter",
    "mothers-day": "mothers_day",
    "fathers-day": "fathers_day",
    graduation: "graduation",
  };
  return map[key];
}
