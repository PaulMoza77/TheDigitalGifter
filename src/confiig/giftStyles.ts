export type GiftStyle = {
  id: string;
  name: string;
  script: string;
};

export type GiftOccasion = {
  title: string;
  subtitle: string;
  styles: GiftStyle[];
};

export const GIFT_STYLES: Record<string, GiftOccasion> = {
  new_born: {
    title: "Choose your New Born Vibe",
    subtitle: "A gentle beginning deserves a timeless memory.",
    styles: [
      {
        id: "soft_pastel",
        name: "Soft Pastel",
        script:
          "Soft pastel newborn portrait, natural daylight, smooth skin tones, airy atmosphere, peaceful expression",
      },
      {
        id: "cozy_blanket",
        name: "Cozy Blanket",
        script:
          "Newborn wrapped in a soft cozy blanket, warm tones, close framing, intimate feeling, gentle light",
      },
      {
        id: "angel_sleep",
        name: "Angel Sleep",
        script:
          "Sleeping newborn portrait, angelic mood, soft glow, peaceful face, heavenly light",
      },
      {
        id: "first_light",
        name: "First Light",
        script:
          "Newborn portrait with soft morning light, fresh beginning mood, hopeful atmosphere",
      },
      {
        id: "minimal_studio",
        name: "Minimal Studio",
        script:
          "Minimal studio newborn portrait, clean background, neutral tones, elegant and timeless",
      },
      {
        id: "golden_memory",
        name: "Golden Memory",
        script:
          "Newborn portrait with warm golden tones, nostalgic feeling, timeless memory style",
      },
    ],
  },
};
