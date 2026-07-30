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
  name: string;
  location: string;
  quote: string;
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
    heroTitle: "Turn a Christmas photo into a moving memory",
    heroSubtitle:
      "Upload a holiday photo and create a warm, shareable Christmas gift in minutes — soft motion, festive feeling.",
    heroCaption: "From a still Christmas photo to a living holiday card.",
    ctaLabel: "Try now — Create a Christmas gift",
    heroBeforeVariant: asset("christmas-before"),
    heroAfterVariant: asset("christmas-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Emily R.",
        location: "Portland, OR",
        quote:
          "Our family Christmas photo finally felt alive again — everyone cried when they saw the motion.",
        beforeVariant: "christmas-before",
        afterVariant: "christmas-after",
      },
{
        name: "Marcus T.",
        location: "Chicago, IL",
        quote:
          "Sent this as a digital Christmas card. Relatives thought we hired a studio.",
        beforeVariant: "christmas-ex2-before",
        afterVariant: "christmas-ex2-after",
      },
{
        name: "Sofia L.",
        location: "Denver, CO",
        quote:
          "Subtle snowfall vibe without looking fake. Perfect holiday surprise.",
        beforeVariant: "christmas-ex3-before",
        afterVariant: "christmas-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Bring holiday photos to life",
        desc: "Watch Christmas smiles gently move — cozy lights, warm emotion, gift-ready.",
        variant: "christmas-after",
      },
{
        title: "Share a Christmas keepake",
        desc: "Send a moving holiday memory that feels personal, not like a template.",
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
      "Turn a favorite birthday photo into a moving surprise — candles, joy, and emotion ready to share.",
    heroCaption: "From a still birthday snap to a celebration that moves.",
    ctaLabel: "Try now — Create a birthday gift",
    heroBeforeVariant: asset("birthday-before"),
    heroAfterVariant: asset("birthday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Avery",
        location: "Cheyenne, WY",
        quote:
          "The birthday motion is subtle and beautiful. Everyone asked how I made it.",
        beforeVariant: "birthday-before",
        afterVariant: "birthday-after",
      },
{
        name: "Nina P.",
        location: "Austin, TX",
        quote:
          "Used a cake photo and got a celebration card that felt premium.",
        beforeVariant: "birthday-ex2-before",
        afterVariant: "birthday-ex2-after",
      },
{
        name: "Jordan K.",
        location: "Seattle, WA",
        quote:
          "Perfect surprise for my sister — personal, fun, and ready in minutes.",
        beforeVariant: "birthday-ex3-before",
        afterVariant: "birthday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate with motion",
        desc: "Candles, smiles, and soft movement that make birthdays feel bigger.",
        variant: "birthday-after",
      },
{
        title: "Surprise the guest of honor",
        desc: "Turn one photo into a shareable birthday moment they’ll replay.",
        variant: "birthday-ex2-after",
      },
{
        title: "Keep the party forever",
        desc: "A moving keepsake from the day — warm, joyful, and gift-ready.",
        variant: "birthday-ex3-after",
      }
    ],
  },

  pregnancy: {
    key: "pregnancy",
    heroTitle: "Celebrate pregnancy with a gentle moving memory",
    heroSubtitle:
      "Create a soft, emotional keepake from your maternity photo — perfect for announcing and sharing with family.",
    heroCaption: "From a maternity photo to a tender moving memory.",
    ctaLabel: "Try now — Create a pregnancy gift",
    heroBeforeVariant: asset("pregnancy-before"),
    heroAfterVariant: asset("pregnancy-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Maya S.",
        location: "San Diego, CA",
        quote:
          "Our bump photo became the sweetest announcement — soft motion, zero gimmicks.",
        beforeVariant: "pregnancy-before",
        afterVariant: "pregnancy-after",
      },
{
        name: "Elena V.",
        location: "Boston, MA",
        quote:
          "Family kept rewatching it. It felt intimate and beautiful.",
        beforeVariant: "pregnancy-ex2-before",
        afterVariant: "pregnancy-ex2-after",
      },
{
        name: "Priya N.",
        location: "Toronto, ON",
        quote:
          "Exactly the calm, glowing vibe we wanted for the baby news.",
        beforeVariant: "pregnancy-ex3-before",
        afterVariant: "pregnancy-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor this chapter",
        desc: "Gentle motion that celebrates the wait — calm, glowing, emotional.",
        variant: "pregnancy-after",
      },
{
        title: "Share the news beautifully",
        desc: "A maternity moment ready for family chats and keepsake albums.",
        variant: "pregnancy-ex2-after",
      },
{
        title: "Keep the glow forever",
        desc: "Preserve this season of anticipation in a moving memory.",
        variant: "pregnancy-ex3-after",
      }
    ],
  },

  wedding: {
    key: "wedding",
    heroTitle: "Turn your wedding photo into a living memory",
    heroSubtitle:
      "A timeless moving gift from your best wedding moment — elegant, subtle, and made to be shared.",
    heroCaption: "From a wedding still to a timeless moving keepsake.",
    ctaLabel: "Try now — Create a wedding gift",
    heroBeforeVariant: asset("wedding-before"),
    heroAfterVariant: asset("wedding-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Anna K.",
        location: "Omaha, NE",
        quote:
          "Our first dance photo felt cinematic without looking overdone.",
        beforeVariant: "wedding-before",
        afterVariant: "wedding-after",
      },
{
        name: "Chris & Lea",
        location: "Nashville, TN",
        quote:
          "Guests thought it was a professional wedding film still.",
        beforeVariant: "wedding-ex2-before",
        afterVariant: "wedding-ex2-after",
      },
{
        name: "Olivia M.",
        location: "London, UK",
        quote:
          "Elegant motion — perfect anniversary follow-up from our wedding day.",
        beforeVariant: "wedding-ex3-before",
        afterVariant: "wedding-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Relive the vows",
        desc: "Soft cinematic motion that honors the romance of the day.",
        variant: "wedding-after",
      },
{
        title: "Share with guests",
        desc: "A wedding keepake that feels premium and personal.",
        variant: "wedding-ex2-after",
      },
{
        title: "A gift for years ahead",
        desc: "Preserve your favorite frame as a living memory.",
        variant: "wedding-ex3-after",
      }
    ],
  },

  anniversary: {
    key: "anniversary",
    heroTitle: "Celebrate your love story in motion",
    heroSubtitle:
      "Create a romantic moving memory from your couple photo — perfect for anniversaries and love notes.",
    heroCaption: "From a couple photo to a romantic anniversary gift.",
    ctaLabel: "Try now — Create an anniversary gift",
    heroBeforeVariant: asset("anniversary-before"),
    heroAfterVariant: asset("anniversary-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Daniel R.",
        location: "Miami, FL",
        quote:
          "Sent this on our 10th anniversary — she watched it three times.",
        beforeVariant: "anniversary-before",
        afterVariant: "anniversary-after",
      },
{
        name: "Hannah & Theo",
        location: "Paris, FR",
        quote:
          "Romantic without being cheesy. Exactly our vibe.",
        beforeVariant: "anniversary-ex2-before",
        afterVariant: "anniversary-ex2-after",
      },
{
        name: "Laura B.",
        location: "Dublin, IE",
        quote:
          "A quiet, beautiful reminder of why we chose each other.",
        beforeVariant: "anniversary-ex3-before",
        afterVariant: "anniversary-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate your years together",
        desc: "Soft romantic motion for the milestone that matters.",
        variant: "anniversary-after",
      },
{
        title: "A love note that moves",
        desc: "More personal than flowers — and ready to share instantly.",
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
      "Turn a photo into a moving love message in minutes — subtle motion, big emotion.",
    heroCaption: "From a couple snap to a Valentine that feels personal.",
    ctaLabel: "Try now — Create a Valentine gift",
    heroBeforeVariant: asset("valentines-before"),
    heroAfterVariant: asset("valentines-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Sam W.",
        location: "Brooklyn, NY",
        quote:
          "Best Valentine I ever sent — romantic motion, no clutter.",
        beforeVariant: "valentines-before",
        afterVariant: "valentines-after",
      },
{
        name: "Isla C.",
        location: "Edinburgh, UK",
        quote:
          "Felt handmade even though it took minutes.",
        beforeVariant: "valentines-ex2-before",
        afterVariant: "valentines-ex2-after",
      },
{
        name: "Noah D.",
        location: "Phoenix, AZ",
        quote:
          "She said it was better than a store-bought card.",
        beforeVariant: "valentines-ex3-before",
        afterVariant: "valentines-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Say it with motion",
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
        desc: "Subtle motion that puts emotion first.",
        variant: "valentines-ex3-after",
      }
    ],
  },

  "new-years-eve": {
    key: "new-years-eve",
    heroTitle: "Start the year with a moving memory",
    heroSubtitle:
      "Turn a New Year’s photo into a sparkling, shareable moment — champagne energy, soft celebration motion.",
    heroCaption: "From a midnight photo to a New Year keepsake.",
    ctaLabel: "Try now — Create a New Year gift",
    heroBeforeVariant: asset("newyears-before"),
    heroAfterVariant: asset("newyears-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Alex J.",
        location: "Las Vegas, NV",
        quote:
          "Our countdown photo got the perfect sparkle — festive, not overdone.",
        beforeVariant: "newyears-before",
        afterVariant: "newyears-after",
      },
{
        name: "Kim R.",
        location: "New York, NY",
        quote:
          "Sent it at midnight. Instant group-chat favorite.",
        beforeVariant: "newyears-ex2-before",
        afterVariant: "newyears-ex2-after",
      },
{
        name: "Tom H.",
        location: "Berlin, DE",
        quote:
          "Celebratory and clean — exactly the vibe we wanted.",
        beforeVariant: "newyears-ex3-before",
        afterVariant: "newyears-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate the countdown",
        desc: "Soft sparkle and motion for your New Year’s moment.",
        variant: "newyears-after",
      },
{
        title: "Share the first memory",
        desc: "A moving toast for friends and family.",
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
      "Turn a family Thanksgiving photo into a warm moving memory — cozy, heartfelt, and made to share.",
    heroCaption: "From a dinner-table still to a thankful moving gift.",
    ctaLabel: "Try now — Create a Thanksgiving gift",
    heroBeforeVariant: asset("thanksgiving-before"),
    heroAfterVariant: asset("thanksgiving-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Grace P.",
        location: "Minneapolis, MN",
        quote:
          "Our table photo became the sweetest thank-you we sent that year.",
        beforeVariant: "thanksgiving-before",
        afterVariant: "thanksgiving-after",
      },
{
        name: "Ben C.",
        location: "Columbus, OH",
        quote:
          "Warm autumn tones and gentle motion — felt homemade.",
        beforeVariant: "thanksgiving-ex2-before",
        afterVariant: "thanksgiving-ex2-after",
      },
{
        name: "Ruth A.",
        location: "Atlanta, GA",
        quote:
          "Grandma printed it. Best compliment possible.",
        beforeVariant: "thanksgiving-ex3-before",
        afterVariant: "thanksgiving-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Thank them with motion",
        desc: "A warm family keepake that feels grateful and personal.",
        variant: "thanksgiving-after",
      },
{
        title: "Celebrate togetherness",
        desc: "Autumn warmth, soft movement, shareable emotion.",
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
      "Create a moving reveal from your photo — pink or blue energy, perfect for sharing the big news.",
    heroCaption: "From a reveal photo to a share-worthy announcement.",
    ctaLabel: "Try now — Create a baby reveal",
    heroBeforeVariant: asset("babyreveal-before"),
    heroAfterVariant: asset("babyreveal-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Tara & Mike",
        location: "Dallas, TX",
        quote:
          "The reveal motion made the announcement feel magical.",
        beforeVariant: "babyreveal-before",
        afterVariant: "babyreveal-after",
      },
{
        name: "Jess L.",
        location: "Orlando, FL",
        quote:
          "Family group chat exploded. Worth every second.",
        beforeVariant: "babyreveal-ex2-before",
        afterVariant: "babyreveal-ex2-after",
      },
{
        name: "Omar H.",
        location: "Detroit, MI",
        quote:
          "Clear, joyful, and not gimmicky — perfect big-news vibe.",
        beforeVariant: "babyreveal-ex3-before",
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
        desc: "Soft motion that makes the surprise land beautifully.",
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
    heroTitle: "Newborn moments, brought to life",
    heroSubtitle:
      "Turn a newborn photo into a gentle moving keepsake — soft, tender, and made for family and friends.",
    heroCaption: "From a quiet newborn still to a living first memory.",
    ctaLabel: "Try now — Create a newborn gift",
    heroBeforeVariant: asset("newborn-before"),
    heroAfterVariant: asset("newborn-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Claire M.",
        location: "Vancouver, BC",
        quote:
          "Our sleeping newborn photo felt like a lullaby in motion — everyone melted.",
        beforeVariant: "newborn-before",
        afterVariant: "newborn-after",
      },
{
        name: "Diego F.",
        location: "Madrid, ES",
        quote:
          "Sent it to grandparents abroad. They said it felt like holding the baby.",
        beforeVariant: "newborn-ex2-before",
        afterVariant: "newborn-ex2-after",
      },
{
        name: "Amelia W.",
        location: "Sydney, AU",
        quote:
          "Soft, private, perfect — no winter stock photos, just our baby.",
        beforeVariant: "newborn-ex3-before",
        afterVariant: "newborn-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor those first days",
        desc: "Gentle motion that protects the tenderness of newborn photos.",
        variant: "newborn-after",
      },
{
        title: "Share with family",
        desc: "A moving welcome for grandparents, aunts, and friends.",
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
    heroTitle: "Easter memories that move",
    heroSubtitle:
      "Create a joyful spring keepsake from your Easter photo — soft pastels, warm smiles, ready to share.",
    heroCaption: "From an Easter morning still to a spring celebration.",
    ctaLabel: "Try now — Create an Easter gift",
    heroBeforeVariant: asset("easter-before"),
    heroAfterVariant: asset("easter-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Lily T.",
        location: "Charleston, SC",
        quote:
          "Egg-hunt photos never looked this sweet. Soft spring motion.",
        beforeVariant: "easter-before",
        afterVariant: "easter-after",
      },
{
        name: "Henry G.",
        location: "Cleveland, OH",
        quote:
          "Pastel and joyful without looking childish.",
        beforeVariant: "easter-ex2-before",
        afterVariant: "easter-ex2-after",
      },
{
        name: "Nora S.",
        location: "Bath, UK",
        quote:
          "Perfect little Easter surprise for the cousins.",
        beforeVariant: "easter-ex3-before",
        afterVariant: "easter-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate spring joy",
        desc: "Pastel warmth and gentle motion for Easter mornings.",
        variant: "easter-after",
      },
{
        title: "Share the hunt",
        desc: "A moving memory from baskets, blooms, and smiles.",
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
      "Turn a mom photo into a moving memory — thoughtful, personal, and ready to share.",
    heroCaption: "From a still of Mom to a gift she’ll replay.",
    ctaLabel: "Try now — Create a Mother’s Day gift",
    heroBeforeVariant: asset("mothersday-before"),
    heroAfterVariant: asset("mothersday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Rachel D.",
        location: "Philadelphia, PA",
        quote:
          "Mom cried happy tears. Best Mother’s Day gift I’ve given.",
        beforeVariant: "mothersday-before",
        afterVariant: "mothersday-after",
      },
{
        name: "Kevin O.",
        location: "Dublin, IE",
        quote:
          "Used an old photo with my sister — felt intimate and modern.",
        beforeVariant: "mothersday-ex2-before",
        afterVariant: "mothersday-ex2-after",
      },
{
        name: "Sophie Y.",
        location: "Melbourne, AU",
        quote:
          "Soft motion, zero clutter. She watched it on loop.",
        beforeVariant: "mothersday-ex3-before",
        afterVariant: "mothersday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor Mom with motion",
        desc: "A personal keepake that feels warmer than flowers alone.",
        variant: "mothersday-after",
      },
{
        title: "Made from your photo",
        desc: "Her smile, gently alive — thoughtful and share-ready.",
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
      "Create a moving memory from a dad photo — simple, strong emotion, ready to surprise him.",
    heroCaption: "From a dad snapshot to a Father’s Day keepake.",
    ctaLabel: "Try now — Create a Father’s Day gift",
    heroBeforeVariant: asset("fathersday-before"),
    heroAfterVariant: asset("fathersday-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Ryan P.",
        location: "Houston, TX",
        quote:
          "Dad doesn’t do gifts — he loved this. Quiet pride, soft motion.",
        beforeVariant: "fathersday-before",
        afterVariant: "fathersday-after",
      },
{
        name: "Mia L.",
        location: "Calgary, AB",
        quote:
          "Used a fishing trip photo. Felt like us, not a template.",
        beforeVariant: "fathersday-ex2-before",
        afterVariant: "fathersday-ex2-after",
      },
{
        name: "Ethan B.",
        location: "Manchester, UK",
        quote:
          "Simple and emotional. Perfect Father’s Day surprise.",
        beforeVariant: "fathersday-ex3-before",
        afterVariant: "fathersday-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Celebrate Dad",
        desc: "A moving memory that feels genuine, not gimmicky.",
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
    heroTitle: "Graduation memories, brought to life",
    heroSubtitle:
      "Turn a proud graduation photo into a moving keepsake — caps, smiles, and celebration ready to share.",
    heroCaption: "From a diploma still to a proud moving celebration.",
    ctaLabel: "Try now — Create a graduation gift",
    heroBeforeVariant: asset("graduation-before"),
    heroAfterVariant: asset("graduation-after"),
    ctaTo: "/funnel/uploadPhoto",
    examples: [
{
        name: "Priya K.",
        location: "Ann Arbor, MI",
        quote:
          "Cap-and-gown photo felt epic — proud without being loud.",
        beforeVariant: "graduation-before",
        afterVariant: "graduation-after",
      },
{
        name: "Lucas M.",
        location: "Barcelona, ES",
        quote:
          "Parents shared it everywhere. Perfect graduation card.",
        beforeVariant: "graduation-ex2-before",
        afterVariant: "graduation-ex2-after",
      },
{
        name: "Zoe F.",
        location: "Boston, MA",
        quote:
          "Clean cinematic motion for a milestone day.",
        beforeVariant: "graduation-ex3-before",
        afterVariant: "graduation-ex3-after",
      }
    ],
    valueTrio: [
{
        title: "Honor the milestone",
        desc: "Proud motion for caps, gowns, and hard-earned smiles.",
        variant: "graduation-after",
      },
{
        title: "Share the achievement",
        desc: "A graduation gift families love to replay.",
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
