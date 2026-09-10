/**
 * Translation-ready Santa Video copy.
 * Prefer full templates over string concatenation for names.
 */

export type SantaRecipientType = "child" | "siblings" | "family" | "special";

export const SANTA_COPY = {
  brand: "The Digital Gifter",
  productName: "Personalized Santa Video",
  seo: {
    title: "Personalized Santa Video | Santa Says Your Child’s Name",
    description:
      "Create a personalized Christmas video from Santa that can include the recipient’s name and other supported personal details.",
    canonical: "https://www.thedigitalgifter.com/christmas/santa-video",
  },
  hero: {
    h1: "Create a Personalized Video From Santa",
    h1Alt: "A Personal Christmas Message From Santa",
    support:
      "Create a personalized Santa video with their name, Christmas wishes and special moments from the year.",
    ctaDirect: "Create Their Santa Video",
    ctaPrefill: (name: string) => `Continue ${name}’s Santa Message`,
    handoffHeadline: (name: string) => `Let’s make ${name}’s Christmas magical.`,
    handoffSupport: (name: string) =>
      `Tell Santa a few things about ${name} and we’ll create a personalized Christmas message just for them.`,
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
      title: "What’s their name?",
      placeholder: "Emma",
      cta: "Continue",
      helper: "Santa will say their name in the video.",
    },
    age: {
      title: (name: string) => `How old is ${name}?`,
      helper: "This helps Santa make the message feel more natural. Optional.",
      skip: "Skip",
      cta: "Continue",
    },
    achievement: {
      title: (name: string) => `What made you proud of ${name} this year?`,
      placeholder: "She learned how to ride her bike without training wheels.",
      chips: [
        "you did well at school",
        "you learned something new",
        "you helped others",
        "you were brave",
        "you were kind",
      ],
      cta: "Continue",
    },
    wish: {
      title: (name: string) => `What is ${name} hoping for this Christmas?`,
      placeholder: "A pink bicycle",
      helper: "Santa can mention it in the video. Optional.",
      skip: "Skip for now",
      cta: "Continue",
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
      eyebrow: "Message preview",
      title: (name: string) => `${name}’s Santa Message`,
      change: "Make a change",
      perfect: "This is perfect",
      cta: (name: string) => `Create ${name}’s Santa Video`,
      mentionsTitle: "Santa will mention:",
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
        "Details you enter are used only to create this private personalized video. Founder review: confirm retention policy copy before launch.",
      emailLabel: "Email for receipt / recovery (optional)",
      checkoutSoon:
        "Personalization is ready. Purchase unlocks when production pricing is configured.",
      ctaPay: "Unlock Santa Video",
    },
    progress: {
      title: (name: string) => `Creating ${name}’s Santa video`,
      stages: [
        (name: string) => `Santa is reading ${name}’s letter…`,
        "The elves are preparing the message…",
        "Adding a little Christmas magic…",
        (name: string) => `${name}’s video is almost ready…`,
      ],
    },
    result: {
      title: (name: string) => `${name}’s Santa message is ready`,
      download: "Download",
      share: "Share",
      another: "Create Another",
      crossSellCard: "Turn this into a Christmas Card",
      crossSellTree: "Put it under a Digital Christmas Tree",
      crossSellPortrait: "Create a Christmas Portrait",
    },
  },
  sections: {
    examples: {
      h2: "See Personalized Santa Video Examples",
      intro: "Demo messages that show how Santa can personalize a greeting. These are examples — not customer reviews.",
    },
    how: {
      h2: "How Personalized Santa Videos Work",
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
      h2: "Make Santa’s Message Personal",
      body: "Santa can say their name and weave in achievements, wishes, and little details that make Christmas morning feel magical.",
    },
    proof: {
      h2: "Made for Christmas morning surprises",
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
          a: "You can include their name, optional age, something they did well, a Christmas wish, and an extra detail like a pet or hobby.",
        },
        {
          q: "Can Santa mention a Christmas gift?",
          a: "Yes — if you share a Christmas wish, Santa can mention it warmly in the message.",
        },
        {
          q: "Can I make a video for more than one child?",
          a: "You can start with siblings as the recipient type. For best results today, include both names in the name field (for example “Sofia & Luca”). Dedicated multi-child scripting will expand later.",
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
  return `${current} of ${total}`;
}
