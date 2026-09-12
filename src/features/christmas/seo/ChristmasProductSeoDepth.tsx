import { Link } from "react-router-dom";

type SeoBlock = {
  geo: { h2: string; body: string };
  sections: Array<{
    h2: string;
    body: string;
    list?: string[];
    linkHref?: string;
    linkLabel?: string;
  }>;
  faqs: Array<{ q: string; a: string }>;
};

function ListItems({ list }: { list?: string[] }) {
  if (!list?.length) return null;
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm opacity-90">
      {list.map((item) => {
        const parts = item.includes(" → ") ? item.split(" → ") : null;
        if (parts && parts[1]?.startsWith("/")) {
          return (
            <li key={item}>
              <Link className="underline underline-offset-2" to={parts[1]}>
                {parts[0]}
              </Link>
            </li>
          );
        }
        return <li key={item}>{item}</li>;
      })}
    </ul>
  );
}

/** Shared lower-page editorial block for Tree / Advent / Messages. */
export function ChristmasProductSeoDepth({
  content,
  tone = "dark",
}: {
  content: SeoBlock;
  tone?: "dark" | "light";
}) {
  const text = tone === "dark" ? "text-amber-50" : "text-slate-900";
  const muted = tone === "dark" ? "text-amber-100/75" : "text-slate-600";

  return (
    <div className={`mt-14 space-y-10 ${text}`} data-tdg-client-depth="p2b">
      {content.sections.map((section) => (
        <section key={section.h2} aria-labelledby={`seo-${section.h2}`}>
          <h2 id={`seo-${section.h2}`} className="font-serif text-2xl">
            {section.h2}
          </h2>
          <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{section.body}</p>
          <ListItems list={section.list} />
          {section.linkHref && section.linkLabel ? (
            <p className="mt-3">
              <Link className="underline underline-offset-2" to={section.linkHref}>
                {section.linkLabel}
              </Link>
            </p>
          ) : null}
        </section>
      ))}

      <section aria-labelledby="seo-geo">
        <h2 id="seo-geo" className="font-serif text-2xl">
          {content.geo.h2}
        </h2>
        <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{content.geo.body}</p>
      </section>

      <section aria-labelledby="seo-faq">
        <h2 id="seo-faq" className="font-serif text-2xl">
          Frequently Asked Questions
        </h2>
        <dl className="mt-4 space-y-4">
          {content.faqs.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold">{item.q}</dt>
              <dd className={`mt-1 text-sm leading-relaxed ${muted}`}>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export const TREE_SEO_DEPTH: SeoBlock = {
  geo: {
    h2: "What is a digital Christmas tree?",
    body:
      "A digital Christmas tree is an interactive online Christmas tree you can customize and share. Choose a tree look, add decorations, place gift boxes with personal messages underneath, and share a private link so someone special can open the gifts — without indexing the share page for search engines.",
  },
  sections: [
    {
      h2: "Build a Digital Christmas Tree",
      body:
        "Create a free interactive Christmas tree in your browser. Customize the style (Classic, Snowy, Gold, Cozy, Minimal, or Magical), lights, snow, toppers, and ornaments, then place gift boxes beneath it.",
    },
    {
      h2: "What Can You Put Under Your Tree?",
      body:
        "Today you can add gift boxes that hold personal Christmas messages, with festive box styles such as red, gold, green, blue, or snow.",
      list: [
        "Personal Christmas messages inside gift boxes",
        "Festive box styles (red, gold, green, blue, snow)",
      ],
    },
    {
      h2: "Share Your Christmas Tree",
      body:
        "Turn sharing on and send one link. Recipients open the tree to unwrap gifts. Shared tree links are meant for people you trust and are not indexed for search engines.",
    },
    {
      h2: "A Christmas Gift Made to Be Opened",
      body:
        "Recipients can tap gifts under the tree to reveal the messages you left — a digital moment meant to feel like opening something placed there for them.",
    },
    {
      h2: "How It Works",
      body: "A simple path from blank tree to a shareable Christmas surprise.",
      list: [
        "Create and style your digital Christmas tree",
        "Add gift boxes with messages",
        "Turn sharing on and send the link",
        "They open gifts under the tree",
      ],
    },
  ],
  faqs: [
    {
      q: "What is a digital Christmas tree?",
      a: "An interactive online Christmas tree you customize, fill with message gifts, and share so someone can open them on their device.",
    },
    {
      q: "What can I add to it?",
      a: "Today you can add gift boxes with personal Christmas messages and choose festive box styles.",
    },
    {
      q: "Can I share it with someone?",
      a: "Yes. Enable sharing and send the link. Treat it like a personal gift link.",
    },
    {
      q: "Can recipients open the gifts?",
      a: "Yes. Recipients can tap gifts under the tree to reveal the messages you added.",
    },
    {
      q: "Can I add a Santa video or Christmas photo under the tree?",
      a: "Not as a dedicated gift type in the current tree creator. You can still create those experiences separately and mention them in a message gift.",
    },
    {
      q: "Is the shared tree public?",
      a: "Shared trees are reachable by people with the link, but share pages are noindex and not meant for search engines.",
    },
  ],
};

export const ADVENT_SEO_DEPTH: SeoBlock = {
  geo: {
    h2: "What is an online Advent calendar?",
    body:
      "An online Advent calendar is a digital version of the traditional Advent calendar: a new door unlocks each day in December leading up to Christmas. On TheDigitalGifter, you open today’s door on a 1–24 calendar (Europe/Bucharest time). Past doors stay closed after the day passes.",
  },
  sections: [
    {
      h2: "A Little Christmas Magic Every Day",
      body:
        "The Advent calendar is a countdown experience with twenty-four doors — a small ritual of opening something new as Christmas approaches.",
    },
    {
      h2: "Open a New Door Every Day",
      body:
        "Doors follow the calendar day in the Europe/Bucharest timezone. Only today’s door is available to open. Future doors stay locked. Missed days do not reopen for catch-up.",
    },
    {
      h2: "What Can Be Behind the Doors?",
      body:
        "Door rewards are Christmas moments configured for the season — such as a surprise claim when production claims are enabled. Availability can depend on season settings and whether you are signed in.",
    },
    {
      h2: "Before December 1",
      body:
        "Before the Advent window begins, doors show as coming soon. Come back when December starts to open day one.",
    },
    {
      h2: "How the Advent Calendar Works",
      body: "Simple steps for the digital Advent experience.",
      list: [
        "Open the Advent calendar page",
        "Find today’s door (1–24 in December)",
        "Open it when available",
        "Sign in if a claim requires an account",
      ],
    },
  ],
  faqs: [
    {
      q: "When does the Advent calendar start?",
      a: "Doors are for December days 1–24. Before December 1, doors appear as coming soon.",
    },
    {
      q: "When does each door unlock?",
      a: "Each door unlocks on its calendar day in the Europe/Bucharest timezone.",
    },
    {
      q: "Can I open earlier doors?",
      a: "No. Missed days stay closed — only today’s door is available.",
    },
    {
      q: "Is the calendar free?",
      a: "Browsing the calendar experience is free. Some reward claims may require an account when claims are live for the season.",
    },
    {
      q: "What can I find behind a door?",
      a: "Seasonal Christmas surprises configured for that day when claims are enabled — not a guarantee of cash prizes or shop credits every day.",
    },
    {
      q: "Do I need an account?",
      a: "You can view the calendar without one. Claiming certain door rewards may require signing in.",
    },
    {
      q: "Can I use it on mobile?",
      a: "Yes. The Advent calendar is designed to work on phones as well as desktops.",
    },
  ],
};

export const MESSAGES_SEO_DEPTH: SeoBlock = {
  geo: {
    h2: "What is a Christmas message generator?",
    body:
      "A Christmas message generator helps you write Christmas wishes by choosing who the message is for and the tone you want — then generating editable message options in English or Romanian that you can copy or continue into a Christmas card.",
  },
  sections: [
    {
      h2: "Find the Perfect Christmas Message",
      body:
        "Choose a recipient, pick a tone, set a length (short, medium, or long), optionally add one personal detail, and generate Christmas message options you can edit and use.",
    },
    {
      h2: "Christmas Messages by Recipient",
      body:
        "The generator supports common Christmas relationships. Dedicated recipient landing pages are not live yet — choose the recipient in the tool.",
      list: ["Mom", "Dad", "Wife", "Husband", "Girlfriend", "Boyfriend", "Family", "Friend", "Coworker"],
    },
    {
      h2: "Christmas Messages by Tone",
      body:
        "Tone options available today include warm, funny, romantic, heartfelt, short and sweet, professional, and religious.",
    },
    {
      h2: "Christmas Message Examples",
      body: "Demonstration directions for the kinds of wishes the tool can help you draft — edit anything to sound like you.",
      list: [
        "Heartfelt note to Mom thanking her for another year of quiet kindness",
        "Short warm wish for a friend you don’t see enough",
        "Romantic Christmas line for a partner’s first Christmas together",
        "Light funny coworker message that stays workplace-friendly",
      ],
    },
    {
      h2: "How to Write a Meaningful Christmas Message",
      body:
        "Address the person by name or relationship, mention one shared memory or quality when it fits, express one clear feeling, keep the wording natural, and close personally. The generator is a starting point — your edit makes it real.",
    },
    {
      h2: "Use Your Message in a Christmas Card",
      body: "When you find words you like, continue into the Christmas Card Maker.",
      linkHref: "/christmas/cards",
      linkLabel: "Put this Christmas message on a card",
    },
  ],
  faqs: [
    {
      q: "How does the Christmas message generator work?",
      a: "Choose recipient, tone, and length, optionally add a detail, then generate message options you can copy or edit.",
    },
    {
      q: "Can I write a message for my partner?",
      a: "Yes. Choose girlfriend, boyfriend, partner, wife, or husband and a romantic or warm tone.",
    },
    {
      q: "Can it create funny Christmas messages?",
      a: "Yes. Select the funny tone — keep workplace messages professional when writing to coworkers.",
    },
    {
      q: "Can I edit generated messages?",
      a: "Yes. Treat generated text as a draft and rewrite freely before you send or use it on a card.",
    },
    {
      q: "Can it create short Christmas wishes?",
      a: "Yes. Choose short length or the short-and-sweet tone.",
    },
    {
      q: "Can I use a message in a Christmas card?",
      a: "Yes. Continue into the Christmas Card Maker with message handoff.",
    },
    {
      q: "Which languages are supported?",
      a: "English and Romanian are supported today.",
    },
  ],
};
