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
    message: {
      h2: "A Personalized Message From Santa",
      body: "Create a Christmas video from Santa for a child, siblings, family, or someone special. Santa can say their name and weave in optional details you share — then you download or share the finished video.",
    },
    mention: {
      h2: "What Can Santa Mention?",
      body: "Personalization fields available today:",
      items: [
        "Recipient name",
        "Optional age",
        "Something they did well",
        "Christmas wish",
        "Extra personal detail (pet, hobby, sibling)",
        "Language: English or Romanian",
      ],
    },
    examples: {
      h2: "Personalized Santa Video Examples",
      intro:
        "Demo messages that show how Santa can personalize a greeting. These are product demonstrations — not customer reviews.",
    },
    how: {
      h2: "How It Works",
      steps: [
        {
          title: "Tell Santa about them",
          body: "Name, Christmas wish and a few special details.",
        },
        {
          title: "Review the message",
          body: "Check the personalized preview before you create the video.",
        },
        {
          title: "Create the video",
          body: "Santa turns those details into a personalized Christmas greeting.",
        },
        {
          title: "Download or share",
          body: "Save the MP4 or send a private share link when it’s ready.",
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
        "Uploads and results stay private by default; they are not shown in a public gallery.",
      ],
    },
    geo: {
      whatIs: {
        q: "What is a personalized Santa video?",
        a: "A personalized Santa video is a Christmas message video from Santa that can include the recipient’s name and other details you provide. On TheDigitalGifter, you answer a short guided form, review the message, then create a video you can download and share.",
      },
    },
    faq: {
      h2: "Frequently Asked Questions",
      items: [
        {
          q: "Can Santa say my child’s name?",
          a: "Yes. The recipient’s name is a core personalization field and Santa says it in the video.",
        },
        {
          q: "What can I personalize?",
          a: "Name, optional age, something they did well, Christmas wish, an extra detail, and language (English or Romanian).",
        },
        {
          q: "Can Santa mention a Christmas gift?",
          a: "Yes — you can include a Christmas wish, and Santa can mention it when you provide one.",
        },
        {
          q: "Can I make a video for siblings?",
          a: "Yes. Choose the siblings option and include their names in the name step. A dedicated multi-child flow may expand later.",
        },
        {
          q: "Which languages are supported?",
          a: "English and Romanian are supported today.",
        },
        {
          q: "Can I preview the message first?",
          a: "Yes. You can review the message before creating the video.",
        },
        {
          q: "Can I download or share the video?",
          a: "Yes. When the video is ready, you can download the MP4 and share it.",
        },
        {
          q: "Is this only for children?",
          a: "The experience is optimized for parent → child, but you can also create warm messages for family or someone special.",
        },
      ],
    },
  },
} as const;

export function progressLabel(current: number, total: number): string {
  return `${current} of ${total}`;
}
