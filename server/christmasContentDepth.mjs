/**
 * Christmas P2A content depth for money pages.
 * Node-safe (no React). Consumed by christmasSeo.mjs SSR shells.
 * Keep claims aligned with real product behavior — no fake inventory, ratings, or languages.
 */

/** @typedef {{ h2: string, body: string, linkHref?: string, linkLabel?: string, list?: string[] }} DepthSection */
/** @typedef {{ q: string, a: string }} DepthFaq */
/** @typedef {{
 *   path: string,
 *   geo: { h2: string, body: string },
 *   sections: DepthSection[],
 *   faqs: DepthFaq[],
 *   markers: string[],
 * }} DepthPage */

/** @type {Record<string, DepthPage>} */
export const CHRISTMAS_CONTENT_DEPTH = {
  "/christmas": {
    path: "/christmas",
    geo: {
      h2: "What can you create with TheDigitalGifter for Christmas?",
      body:
        "TheDigitalGifter is a Christmas creation hub. You can find gift ideas with the Gift Finder, turn a photo into a Christmas portrait for family, couples, or pets, create a personalized Santa video that can include a recipient’s name, build a shareable Christmas wishlist, design a Christmas card with your photo and message, write Christmas wishes, decorate a digital Christmas tree, and open daily Advent surprises. Start from one room and jump into the experience that fits the person you’re celebrating.",
    },
    sections: [
      {
        h2: "Find the Perfect Christmas Gift",
        body:
          "Not sure what to buy? The Christmas Gift Finder asks who you’re shopping for, what they like, how they show up in life, and what you want to spend. You get thoughtful gift ideas with a short reason each one fits — including options for someone who seems to have everything. Save favorites to a wishlist when you’re ready.",
        linkHref: "/christmas/gift-finder",
        linkLabel: "Find a Christmas gift they’ll actually love",
      },
      {
        h2: "Create Magical Christmas Photos",
        body:
          "Upload a clear photo and transform it into a festive Christmas portrait. Create looks for families, couples, and pets — including dedicated paths for dogs and cats — then download privately or carry a portrait into a Christmas card.",
        linkHref: "/christmas/photo-generator",
        linkLabel: "Turn your photo into Christmas magic",
      },
      {
        h2: "Get a Personalized Message From Santa",
        body:
          "Create a personalized Christmas video from Santa. Tell Santa the recipient’s name and optional details such as age, something they did well, a hobby, or a Christmas wish. Review the message, then create a video you can download and share.",
        linkHref: "/christmas/santa-video",
        linkLabel: "Create a personalized Santa video",
      },
      {
        h2: "Create & Share a Christmas Wishlist",
        body:
          "Build a Christmas wishlist with product links or free-written wishes. Share one simple link with family and friends. Viewers can reserve a gift so others don’t buy the same thing — without spoiling who bought it for the wishlist owner.",
        linkHref: "/christmas/wishlist",
        linkLabel: "Create a Christmas wishlist",
      },
      {
        h2: "Create a Personalized Christmas Card",
        body:
          "Combine a photo, a festive card design, and a personal message into a Christmas card you can download or share digitally. Use your own photo or a Christmas portrait you already created.",
        linkHref: "/christmas/cards",
        linkLabel: "Create a Christmas card they’ll want to keep",
      },
      {
        h2: "More Christmas experiences",
        body:
          "You can also build a digital Christmas tree with surprises, open Advent doors through December, and find the right Christmas words with the message generator.",
        list: [
          "Digital Christmas Tree → /christmas/tree",
          "Advent Calendar → /christmas/advent",
          "Christmas Messages → /christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "What can I create for Christmas with TheDigitalGifter?",
        a: "Gift ideas, Christmas portraits for families, couples and pets, a personalized Santa video, a shareable wishlist, Christmas cards, Christmas messages, a digital tree, and an Advent calendar.",
      },
      {
        q: "Can Santa say my child’s name?",
        a: "Yes. Start with their first name on the Christmas page or Santa Video experience, then add optional details before creating the video.",
      },
      {
        q: "Do I need design skills?",
        a: "No. Each Christmas experience is guided — upload a photo, answer a few questions, or start with a name.",
      },
      {
        q: "Is this for digital gifts, physical gifts, or both?",
        a: "Both. Use the Gift Finder and wishlist for shopping anywhere, and create digital portraits, cards, and Santa videos to send.",
      },
      {
        q: "Will this work on my phone?",
        a: "Yes. The Christmas hub and product experiences are designed to work on phones as well as desktops.",
      },
    ],
    markers: [
      "What can you create with TheDigitalGifter for Christmas?",
      "Find the Perfect Christmas Gift",
      "Create Magical Christmas Photos",
      "Get a Personalized Message From Santa",
      "Create & Share a Christmas Wishlist",
      "Create a Personalized Christmas Card",
    ],
  },

  "/christmas/gift-finder": {
    path: "/christmas/gift-finder",
    geo: {
      h2: "What is a Christmas Gift Finder?",
      body:
        "A Christmas Gift Finder is a guided tool that recommends Christmas gift ideas based on who you’re shopping for, their interests and personality, and your budget. On TheDigitalGifter, you answer a short set of questions and receive curated ideas with clear reasons they may fit — then you can refine or save ideas to a wishlist.",
    },
    sections: [
      {
        h2: "How the Christmas Gift Finder Works",
        body:
          "Choose the recipient, share their interests and personality, set a budget, and optionally add one personal detail. The finder returns ranked gift ideas with short explanations. You can refine answers, restart, or save ideas to your Christmas Wishlist.",
        list: [
          "Who you’re shopping for",
          "Interests and personality",
          "Budget range",
          "Personalized gift ideas with reasons",
        ],
      },
      {
        h2: "Find Gifts by Recipient",
        body:
          "The Gift Finder supports common Christmas shopping relationships so recommendations stay appropriate. Use the tool for Mom, Dad, wife, husband, girlfriend, boyfriend, kids, teens, grandparents, friends, coworkers, and more. Recipient-specific landing pages are not live yet — start the finder and choose the recipient there.",
        list: [
          "Mom",
          "Dad",
          "Wife",
          "Husband",
          "Girlfriend",
          "Boyfriend",
          "Kids",
          "Teens",
          "Grandparents",
          "Friends",
          "Coworkers",
        ],
      },
      {
        h2: "Find Christmas Gifts by Budget",
        body:
          "Pick a spending range such as under $25, $25–$50, $50–$100, $100–$200, $200+, or no strict budget. Recommendations are gift ideas with typical price ranges — not live retailer inventory or guaranteed stock.",
      },
      {
        h2: "Gifts for Someone Who Has Everything",
        body:
          "When someone already owns “all the things,” useful Christmas gifts usually lean toward experiences, personalized keepsakes, hobby upgrades, sentimental moments, or practical premium items. Choosing a “has everything” personality steers the finder toward those directions instead of generic clutter.",
      },
      {
        h2: "Save ideas to your wishlist",
        body:
          "Like an idea? Save it to your Christmas Wishlist and share one list with family so shopping stays coordinated.",
        linkHref: "/christmas/wishlist",
        linkLabel: "Open the Christmas Wishlist Maker",
      },
    ],
    faqs: [
      {
        q: "How does the Christmas Gift Finder work?",
        a: "You answer a few quick questions about who you’re shopping for, their interests, personality, and budget. Then you see curated gift ideas with a clear reason each one fits.",
      },
      {
        q: "Can I search by budget?",
        a: "Yes. Budget ranges are a core step in the finder.",
      },
      {
        q: "Can I find gifts for someone who has everything?",
        a: "Yes. Personality options include “Has everything,” which steers ideas toward experiences, personalization, and meaningful keepsakes.",
      },
      {
        q: "Can I use it for kids or teenagers?",
        a: "Yes. Choose Child or Teen (or Daughter/Son with an age range) so ideas stay age-appropriate.",
      },
      {
        q: "Can I save ideas to my wishlist?",
        a: "Yes. Use Save to Wishlist on an idea to add it to /christmas/wishlist.",
      },
      {
        q: "Are recommendations personalized?",
        a: "Yes. Recommendations use recipient, age, interests, personality, budget, and an optional personal detail.",
      },
      {
        q: "Does it show real products?",
        a: "Today the finder shows curated gift ideas with typical price ranges. Live retailer prices, availability, and shop feeds are not connected yet — we do not invent exact stock or merchant prices.",
      },
    ],
    markers: [
      "What is a Christmas Gift Finder?",
      "How the Christmas Gift Finder Works",
      "Find Gifts by Recipient",
      "Find Christmas Gifts by Budget",
      "Gifts for Someone Who Has Everything",
    ],
  },

  "/christmas/photo-generator": {
    path: "/christmas/photo-generator",
    geo: {
      h2: "What is an AI Christmas photo generator?",
      body:
        "An AI Christmas photo generator turns a real photo you upload into a festive Christmas portrait. On TheDigitalGifter, you choose who is in the photo, pick a Christmas style, and create a downloadable portrait for family, couples, people, or pets — private by default.",
    },
    sections: [
      {
        h2: "Turn Your Photo Into a Christmas Portrait",
        body:
          "Upload a favorite photo, choose the subject type, pick a Christmas look, and create a festive portrait you can download. The goal is a holiday image that still feels like the people or pets you love.",
      },
      {
        h2: "Christmas Photo Examples",
        body:
          "Demo examples show common Christmas portrait directions. They are inspiration samples, not customer photos.",
        list: [
          "Family Christmas Photo — a group portrait in a cozy Christmas scene",
          "Couple Christmas Portrait — a romantic holiday portrait of two people",
          "Dog Christmas Portrait — a festive portrait focused on a dog",
          "Cat Christmas Portrait — a festive portrait focused on a cat",
          "Family + Pet — people and a pet sharing one Christmas frame",
        ],
      },
      {
        h2: "Christmas Photo Styles",
        body:
          "Available Christmas styles include Cozy Christmas, Winter Wonderland, Luxury Christmas, Christmas Morning, Snowy Cabin, Classic Christmas, Elegant White Christmas, and Christmas Market. Choose the look that matches the memory you want.",
      },
      {
        h2: "What Photos Work Best?",
        body:
          "Use a clear photo with visible faces (or a clear pet), decent lighting, and enough sharpness that everyone you want in the portrait is recognizable. Avoid extreme blur, heavy crop-outs, or photos where key people are hidden.",
      },
      {
        h2: "Christmas Photos for Families, Couples and Pets",
        body:
          "Need a more specific starting point? Use the dedicated Christmas portrait routes for family, couples, pets, dogs, and cats — or continue here for the full photo generator.",
        list: [
          "Family Christmas Portraits → /christmas/family",
          "Couple Christmas Portraits → /christmas/couples",
          "Pet Christmas Portraits → /christmas/pets",
          "Christmas Dog Portraits → /christmas/dogs",
          "Christmas Cat Portraits → /christmas/cats",
          "Turn a portrait into a Christmas Card → /christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "How does the Christmas photo generator work?",
        a: "Upload a photo, choose who is in it, pick a Christmas style, then create your portrait after checkout when required by the product flow.",
      },
      {
        q: "What photo should I upload?",
        a: "A clear photo with visible faces or a clear pet works best. Good lighting helps. Avoid extreme blur.",
      },
      {
        q: "Can I create a family Christmas photo?",
        a: "Yes. Choose family as the subject, or start from the Family Christmas route.",
      },
      {
        q: "Can I create a Christmas portrait of my dog or cat?",
        a: "Yes. Pet subjects are supported, with dedicated dog and cat routes for a clearer start.",
      },
      {
        q: "Can multiple people be included?",
        a: "Yes for family and couple flows. Upload a photo that includes everyone who should appear.",
      },
      {
        q: "Can I try different styles?",
        a: "Yes. Pick from the enabled Christmas styles listed on the page before you create.",
      },
      {
        q: "Can I download the result?",
        a: "Yes. When your portrait is ready, download it from the result screen.",
      },
      {
        q: "What happens to my uploaded photo?",
        a: "Uploads and results are private by default. There is no public gallery. Access is through your order/result flow.",
      },
    ],
    markers: [
      "What is an AI Christmas photo generator?",
      "Turn Your Photo Into a Christmas Portrait",
      "Christmas Photo Examples",
      "Christmas Photo Styles",
      "What Photos Work Best?",
    ],
  },

  "/christmas/santa-video": {
    path: "/christmas/santa-video",
    geo: {
      h2: "What is a personalized Santa video?",
      body:
        "A personalized Santa video is a Christmas message video from Santa that can include the recipient’s name and other details you provide. On TheDigitalGifter, you answer a short guided form, review the message, then create a video you can download and share.",
    },
    sections: [
      {
        h2: "A Personalized Message From Santa",
        body:
          "Create a Christmas video from Santa for a child, siblings, family, or someone special. Santa can say their name and weave in optional details you share — then you download or share the finished video.",
      },
      {
        h2: "What Can Santa Mention?",
        body:
          "You can personalize with the recipient’s name, optional age, something they did well this year, a Christmas wish, an extra detail (like a pet or hobby), and Santa’s language. Supported languages today are English and Romanian.",
        list: [
          "Recipient name",
          "Optional age",
          "Something they did well",
          "Christmas wish",
          "Extra personal detail",
          "Language: English or Romanian",
        ],
      },
      {
        h2: "Personalized Santa Video Examples",
        body:
          "Demo examples show how a personalized Santa message can feel. They are product demonstrations for inspiration, not customer testimonials.",
      },
      {
        h2: "How It Works",
        body:
          "Tell Santa who the message is for, add the details you want mentioned, review the message preview, create the video, then download or share it when it’s ready.",
        list: [
          "Tell Santa about them",
          "Review the message",
          "Create the video",
          "Download or share",
        ],
      },
      {
        h2: "More Christmas magic",
        body: "After Santa, many families also create a Christmas portrait or card for the same person.",
        linkHref: "/christmas",
        linkLabel: "Back to Christmas at TheDigitalGifter",
      },
    ],
    faqs: [
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
    ],
    markers: [
      "What is a personalized Santa video?",
      "A Personalized Message From Santa",
      "What Can Santa Mention?",
      "Personalized Santa Video Examples",
      "How It Works",
    ],
  },

  "/christmas/wishlist": {
    path: "/christmas/wishlist",
    geo: {
      h2: "What is an online Christmas wishlist?",
      body:
        "An online Christmas wishlist is a shareable list of gifts or experiences someone would like to receive. On TheDigitalGifter, you create a list, add wishes from product links or free text, share one link with family and friends, and let people reserve gifts so shopping stays coordinated without spoiling the surprise.",
    },
    sections: [
      {
        h2: "Create a Christmas Wishlist Online",
        body:
          "Name your list, add wishes, and keep every Christmas idea in one place instead of scattering links across chats. You can start quickly and keep editing anytime.",
      },
      {
        h2: "Add Anything You Wish For",
        body:
          "Paste a product URL from almost any store, write a manual wish, add notes, and include experiences or handmade ideas. If a link can’t be read automatically, you can still save the wish by hand.",
      },
      {
        h2: "Share One Simple Link",
        body:
          "Turn sharing on and send one wishlist link via copy, WhatsApp, email, or your device’s share sheet. Shared lists are reachable by people with the link and are not meant for search engines.",
      },
      {
        h2: "Avoid Duplicate Christmas Gifts",
        body:
          "Viewers can tap “I’m getting this” to reserve a gift. Reservations stay anonymous to the wishlist owner, so the surprise stays intact while family avoids buying the same thing twice.",
      },
      {
        h2: "Christmas Wishlists for Kids and Families",
        body:
          "Create a list for yourself, your child, or someone else, then share it with grandparents and friends. Pair it with the Gift Finder when you’re not sure what to ask for.",
        linkHref: "/christmas/gift-finder",
        linkLabel: "Try the Christmas Gift Finder",
      },
    ],
    faqs: [
      {
        q: "How do I create a Christmas wishlist?",
        a: "Open the Christmas Wishlist page, choose a title, and create your list. Then add wishes right away.",
      },
      {
        q: "Can I add gifts from any store?",
        a: "Yes. Paste a normal product web link, or add the gift manually if the page can’t be read automatically.",
      },
      {
        q: "Can I add wishes without a link?",
        a: "Yes. Write any wish — experiences, handmade ideas, or a simple “Surprise me.”",
      },
      {
        q: "Can I share one wishlist link?",
        a: "Yes. Enable sharing and send the link to family and friends.",
      },
      {
        q: "Can people reserve gifts?",
        a: "Yes. Viewers can reserve a gift so others know it’s covered.",
      },
      {
        q: "Will I know who bought something?",
        a: "No. Reservations stay anonymous so the surprise stays intact.",
      },
      {
        q: "Can I create one for my child?",
        a: "Yes. Choose who the list is for when creating it, then share the link with relatives.",
      },
      {
        q: "Can I edit it after sharing?",
        a: "Yes. Add, edit, reorder, or remove wishes anytime. People with the link see the updates.",
      },
    ],
    markers: [
      "What is an online Christmas wishlist?",
      "Create a Christmas Wishlist Online",
      "Add Anything You Wish For",
      "Share One Simple Link",
      "Avoid Duplicate Christmas Gifts",
    ],
  },

  "/christmas/cards": {
    path: "/christmas/cards",
    geo: {
      h2: "What is an online Christmas card maker?",
      body:
        "An online Christmas card maker lets you create a personalized Christmas card with a photo, a festive design, and your own message. On TheDigitalGifter, you can upload a photo or use a Christmas portrait, choose a style, write or get message help, then download a PNG or share the card digitally.",
    },
    sections: [
      {
        h2: "Create a Personalized Christmas Card",
        body:
          "Choose a Christmas card style, add your photo, write a message, and create a digital card you can download or share. Some messages deserve more than a text — this is for those.",
      },
      {
        h2: "Christmas Card Examples",
        body:
          "Explore directions such as family, couple, pet, elegant, funny, and classic Christmas cards. Examples are design inspiration for the styles available in the maker.",
        list: ["Family", "Couple", "Pet", "Elegant", "Funny", "Classic"],
      },
      {
        h2: "Use Your Christmas Portrait",
        body:
          "If you already created a Christmas portrait, you can bring it into the card maker and finish with a message. Portrait handoff is supported from the Christmas Photo Generator flow.",
        linkHref: "/christmas/photo-generator",
        linkLabel: "Create a Christmas portrait first",
      },
      {
        h2: "Christmas Card Messages",
        body:
          "Write your own words, or use built-in message help for a starting point. For more guided wishes, the Christmas Message Generator can help you find the right tone.",
        linkHref: "/christmas/messages",
        linkLabel: "Find a Christmas message",
      },
      {
        h2: "How to Make a Christmas Card Online",
        body: "A simple path from blank page to a shareable Christmas card.",
        list: [
          "Choose a Christmas card style",
          "Upload a photo or use a Christmas portrait",
          "Write your message (or get help)",
          "Download the PNG or share digitally",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I upload my own photo?",
        a: "Yes. Upload a photo as the centerpiece of your Christmas card.",
      },
      {
        q: "Can I use a Christmas portrait?",
        a: "Yes. If you created a portrait in the Christmas Photo Generator, you can hand it off into the card maker.",
      },
      {
        q: "Can you help write the message?",
        a: "Yes. Use built-in message help, or visit the Christmas Message Generator for more options.",
      },
      {
        q: "Can I make a family card?",
        a: "Yes. Family-friendly styles and photo layouts are part of the maker.",
      },
      {
        q: "Can I make a pet card?",
        a: "Yes. Pet photos work well in several Christmas card styles.",
      },
      {
        q: "Can I download the card?",
        a: "Yes. Download a high-resolution PNG for personal use.",
      },
      {
        q: "Can I share it digitally?",
        a: "Yes. Share with your device’s share options, WhatsApp, email, or by copying a link where available.",
      },
      {
        q: "Which card styles are available?",
        a: "Styles include classic, elegant gold, cozy, winter wonderland, minimal, vintage, playful, and romantic Christmas looks.",
      },
    ],
    markers: [
      "What is an online Christmas card maker?",
      "Create a Personalized Christmas Card",
      "Christmas Card Examples",
      "Use Your Christmas Portrait",
      "How to Make a Christmas Card Online",
    ],
  },
};

export const CONTENT_DEPTH_PATHS = Object.keys(CHRISTMAS_CONTENT_DEPTH);

/** @returns {DepthPage | null} */
export function getChristmasContentDepth(pathname) {
  const path = String(pathname || "")
    .split("?")[0]
    .replace(/\/+$/, "") || "/";
  return CHRISTMAS_CONTENT_DEPTH[path] ?? null;
}
