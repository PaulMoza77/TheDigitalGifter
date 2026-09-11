export type SantaDemoExample = {
  id: string;
  title: string;
  subtitle: string;
  recipientLabel: string;
  posterSrc: string;
  posterAlt: string;
  lines: string[];
  tags: string[];
};

/** Demo-only examples — not customer testimonials. */
export const SANTA_DEMO_EXAMPLES: SantaDemoExample[] = [
  {
    id: "emma",
    title: "Santa video for Emma, age 7",
    subtitle: "Demo: Santa mentions school pride and a bicycle wish",
    recipientLabel: "Demo example",
    posterSrc: "/assets/funnel/christmas-after.png",
    posterAlt: "Warm Christmas scene representing Emma’s demo Santa message",
    lines: [
      "Ho ho ho, Emma! I heard you’ve been doing an amazing job at school this year…",
      "And I know you’ve been hoping for a new bicycle this Christmas…",
      "Keep being kind, Emma. I’ll see what the elves can do!",
    ],
    tags: ["school", "helping brother", "bicycle"],
  },
  {
    id: "noah",
    title: "Santa video for Noah, age 5",
    subtitle: "Demo: Santa mentions swimming progress and a LEGO wish",
    recipientLabel: "Demo example",
    posterSrc: "/assets/funnel/christmas-ex2-after.png",
    posterAlt: "Cozy Christmas scene representing Noah’s demo Santa message",
    lines: [
      "Ho ho ho, Noah! The elves told me you’ve been learning to swim…",
      "They also said you’ve been especially kind this year.",
      "I heard you’re hoping for a LEGO set — I’ll check my workshop!",
    ],
    tags: ["swimming", "kindness", "LEGO"],
  },
  {
    id: "siblings",
    title: "Santa video for Sofia & Luca",
    subtitle: "Demo: siblings decorating the tree together",
    recipientLabel: "Demo example",
    posterSrc: "/assets/funnel/christmas-ex3-after.png",
    posterAlt: "Festive Christmas scene representing a siblings Santa demo",
    lines: [
      "Ho ho ho, Sofia and Luca! I saw you decorating the tree together…",
      "Being good siblings is one of my favorite kinds of Christmas magic.",
      "I can’t wait for Christmas morning with you both!",
    ],
    tags: ["tree decorating", "siblings", "Christmas morning"],
  },
  {
    id: "family",
    title: "Santa video for the Johnson Family",
    subtitle: "Demo: a warm family Christmas greeting from Santa",
    recipientLabel: "Demo example",
    posterSrc: "/images/occasions/christmas.png",
    posterAlt: "Christmas occasion artwork for a family Santa greeting demo",
    lines: [
      "Ho ho ho, dear Johnson family!",
      "From the North Pole, I’m sending warm wishes for a joyful Christmas together.",
      "May your home be full of laughter, kindness, and a little magic.",
    ],
    tags: ["family", "warm greeting"],
  },
];
