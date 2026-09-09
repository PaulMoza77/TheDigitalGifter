/**
 * Translation-ready Santa Video copy.
 * Prefer full templates over string concatenation for names.
 */

export type SantaRecipientType = "child" | "siblings" | "family" | "special";

export const SANTA_COPY = {
  brand: "TheDigitalGifter",
  productName: "Personalized Santa Video",
  seo: {
    title: "Personalized Santa Video for Kids | TheDigitalGifter",
    description:
      "Create a personalized Christmas video from Santa with your child’s name, Christmas wishes and special moments. Make a magical Santa message in minutes.",
    canonical: "https://www.thedigitalgifter.com/christmas/santa-video",
  },
  hero: {
    /** Static SEO H1 — always present in the document. */
    h1: "Personalized Santa Video",
    h1Alt: "A Personal Christmas Message From Santa",
    support:
      "Santa can say their name, talk about their year and even mention what they’re wishing for this Christmas.",
    ctaDirect: "Start the Magic",
    ctaPrefill: (name: string) => `Continue ${name}’s Santa Message`,
    handoffHeadline: (name: string) => `Santa already knows ${name}.`,
    handoffSupport: (name: string) =>
      `Tell Santa a few little things about ${name} and he’ll create a magical video message just for them — with their name, a warm detail or two, and a special Christmas wish.`,
    magicialHeadline: (name: string) => `Let’s make ${name}’s Christmas magical.`,
    kicker: "A personalized message from Santa",
    namePrompt: "Who is Santa making this for?",
    namePlaceholder: "Your child’s name",
    privacy: "Your details stay private. We never share personal information.",
  },
  language: {
    label: "Santa speaks",
    en: "English",
    ro: "Romanian",
  },
  steps: {
    recipient: {
      title: "Who is this message for?",
      options: [
        { id: "child" as const, label: "My child" },
        { id: "siblings" as const, label: "More than one child" },
        { id: "family" as const, label: "My family" },
        { id: "special" as const, label: "Someone special" },
      ],
    },
    name: {
      title: "Who is Santa making this for?",
      placeholder: "Your child’s name",
      cta: "Start the Magic",
      helper: "Santa will say their name in the video.",
    },
    age: {
      title: (name: string) => `How old is ${name}?`,
      helper: "This helps Santa make the message feel natural.",
      skip: "Skip",
      cta: "Continue",
      unit: "years old",
    },
    achievement: {
      title: (name: string) => `What made you proud of ${name} this year?`,
      placeholder: "He learned to ride his bike without training wheels.",
      chips: [
        "Did well at school",
        "Learned something new",
        "Helped others",
        "Was brave",
        "Was kind",
      ],
      somethingElse: "Something else",
      cta: "Continue",
    },
    interest: {
      title: (name: string) => `What does ${name} love?`,
      placeholder: "Football, LEGO, dinosaurs…",
      chips: [
        "Football",
        "LEGO",
        "Dinosaurs",
        "Gaming",
        "Drawing",
        "Music",
        "Animals",
        "Cars",
      ],
      somethingElse: "Something else",
      cta: "Continue",
      skip: "Skip",
    },
    wish: {
      title: (name: string) => `What is ${name} hoping for this Christmas?`,
      placeholder: "A red bicycle",
      helper: "Santa can mention it in the video.",
      skip: "Skip for now",
      cta: "Continue",
    },
    sender: {
      title: "Who is this magical message from?",
      placeholder: "Mom & Dad",
      chips: ["Mom & Dad", "Mum", "Dad", "Grandma & Grandpa", "The whole family"],
      somethingElse: "Someone else",
      cta: "See message preview",
      skip: "Skip",
    },
    detail: {
      title: "Anything else Santa should know?",
      placeholder: "Her dog is called Milo.",
      helper: "Pet’s name, sibling, hobby, funny detail — optional.",
      skip: "Skip",
      cta: "Continue",
    },
    language: {
      title: "Santa’s language",
      helper: "More languages coming soon.",
      cta: "See message preview",
    },
    preview: {
      eyebrow: "Santa’s message",
      title: (name: string) => `Santa’s message for ${name}`,
      change: "Edit details",
      perfect: "This looks magical",
      cta: (name: string) => `Create ${name}’s Santa Video`,
      mentionsTitle: "Santa will mention:",
      note: "Preview only — the final spoken video may vary slightly.",
    },
    offer: {
      title: "Your Personalized Santa Video",
      included: [
        "Personalized name",
        "Personalized message",
        "Christmas wish",
        "Special achievement",
        "HD video",
        "Downloadable result",
        "Shareable link",
      ],
      consentNote:
        "Details you enter are used only to create this private personalized video.",
      emailLabel: "Email for receipt / recovery (optional)",
      checkoutSoon:
        "Personalization is ready. Purchase unlocks when production pricing is configured.",
      ctaPay: "Unlock Santa Video",
    },
    progress: {
      title: (name: string) => `Creating ${name}’s Santa video`,
      stages: [
        (name: string) => `Santa is reading ${name}’s letter…`,
        "The elves are preparing his message…",
        "Santa is getting ready…",
        "Adding a little Christmas magic…",
        (name: string) => `${name}’s video is almost ready…`,
      ],
    },
    result: {
      title: (name: string) => `Santa made this for ${name}`,
      play: "Play Video",
      download: "Download",
      share: "Share",
      another: "Create Another",
      crossSellCard: "Turn a Christmas photo into a Card",
      crossSellTree: "Put it under a Christmas Tree",
      crossSellPortrait: "Create a Christmas Portrait",
    },
  },
  trust: [
    {
      title: "Private & secure",
      body: "Your child’s details stay private.",
    },
    {
      title: "A truly magical experience",
      body: "A video they’ll always remember.",
    },
    {
      title: "Made for real memories",
      body: "Perfect for children and families.",
    },
  ],
  sections: {
    examples: {
      h2: "See Santa Video Examples",
      intro:
        "Demo messages that show how Santa can personalize a greeting. These are examples — not customer reviews.",
      viewMore: "View more examples",
    },
    how: {
      h2: "How It Works",
      steps: [
        {
          title: "Tell Santa about them",
          body: "Name, Christmas wish and a few special details.",
        },
        {
          title: "We create the message",
          body: "Santa turns those details into a personalized Christmas greeting.",
        },
        {
          title: "Share the magic",
          body: "Download or send the finished video.",
        },
      ],
    },
    personal: {
      h2: "What Can Santa Mention?",
      body: "Santa can say their name and weave in achievements, wishes, hobbies, and little details that make Christmas morning feel magical.",
    },
    proof: {
      h2: "A Magical Christmas Surprise",
      items: [
        {
          title: "Made for Christmas morning surprises",
          body: "A warm message children can watch again and again.",
        },
        {
          title: "Perfect for long-distance families",
          body: "Send Santa’s greeting when you can’t be there in person.",
        },
        {
          title: "A magical way to surprise children before Christmas",
          body: "Personal details make the moment feel real — not generic.",
        },
      ],
    },
    trust: {
      h2: "Privacy & care",
      items: [
        "Entered details are used to create the personalized Santa experience.",
        "We do not publish child names in public galleries.",
        "Share links should be treated as private gifts — only send to people you trust.",
        "Exact media retention policy: flag for founder review before launch claims.",
      ],
    },
    geo: {
      whatIs: {
        q: "What is a personalized Santa video?",
        a: "A personalized Santa video is a custom Christmas message in which Santa addresses the recipient by name and can mention personal details such as achievements, wishes or family moments.",
      },
    },
    faq: {
      h2: "Frequently Asked Questions",
      items: [
        {
          q: "Can Santa say my child’s name?",
          a: "Yes. Santa addresses the recipient by first name throughout the message.",
        },
        {
          q: "What can I personalize?",
          a: "You can include their name, optional age, something they did well, a hobby, a Christmas wish, and who the message is from.",
        },
        {
          q: "Can Santa mention a Christmas gift?",
          a: "Yes — if you share a Christmas wish, Santa can mention it warmly in the message.",
        },
        {
          q: "Can I make a video for more than one child?",
          a: "For best results today, include both names in the name field (for example “Sofia & Luca”). Dedicated multi-child scripting will expand later.",
        },
        {
          q: "Which languages are available?",
          a: "English and Romanian are supported for generation today. More languages are planned.",
        },
        {
          q: "Can I preview the message first?",
          a: "Yes. You’ll see a personalized script-style preview before unlocking generation.",
        },
        {
          q: "Can I download the video?",
          a: "Yes. When your video is ready, you can download an MP4.",
        },
        {
          q: "Can I share the video with family?",
          a: "Yes. You can share a private link or download and send the file. Treat share links as personal gifts.",
        },
        {
          q: "How long does it take?",
          a: "Personalizing takes about a minute. After unlock, video preparation can take several minutes depending on demand.",
        },
        {
          q: "Is this only for children?",
          a: "The experience is optimized for parent → child, but you can also create warm messages for family or someone special.",
        },
        {
          q: "How long is the video?",
          a: "Typically about half a minute to about a minute, depending on the details you share.",
        },
      ],
    },
  },
} as const;

export function progressLabel(current: number, total: number): string {
  return `Step ${current} of ${total}`;
}
