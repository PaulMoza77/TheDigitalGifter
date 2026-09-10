/**
 * Christmas P2B content depth for adjacent indexable product pages.
 * Merged into christmasContentDepth.mjs. Keep claims product-true.
 */

/** @typedef {import('./christmasContentDepth.mjs').DepthPage} DepthPage */

/** @type {Record<string, DepthPage>} */
export const CHRISTMAS_CONTENT_DEPTH_P2B = {
  "/christmas/family": {
    path: "/christmas/family",
    wave: "p2b",
    geo: {
      h2: "What is a family Christmas photo generator?",
      body:
        "A family Christmas photo generator turns one uploaded family photo into a festive group Christmas portrait. On TheDigitalGifter, you upload a clear photo of your family, choose a Christmas style made for multiple people, and create a downloadable portrait — private by default, with an option to continue into a Christmas card.",
    },
    sections: [
      {
        h2: "Create a Family Christmas Portrait",
        body:
          "This experience is built specifically for families — not a generic one-person Christmas look. Upload a group photo, pick a Christmas atmosphere, and create a portrait that aims to keep everyone in the frame.",
      },
      {
        h2: "Family Christmas Photo Examples",
        body:
          "Demo examples show family Christmas portrait directions. They are inspiration samples, not customer photos.",
        list: [
          "Parents with children in a cozy Christmas living room",
          "Family of three or four by a decorated tree",
          "Larger family gathering in a festive scene",
          "Multi-generation portraits including grandparents",
          "Family plus a clearly visible pet in the same frame",
        ],
      },
      {
        h2: "Christmas Styles for Families",
        body:
          "Family styles available today include Classic Family Christmas, Cozy Fireplace, Winter Wonderland, Elegant Christmas, Christmas Morning, Luxury Christmas, Christmas Movie, and Vintage Family Christmas.",
      },
      {
        h2: "What Family Photos Work Best?",
        body:
          "Use a clear group photo where faces are visible, lighting is decent, and everyone you want in the portrait is recognizable. Avoid extreme blur, heavy crop-outs, or photos where key people are hidden.",
      },
      {
        h2: "Family Christmas Cards",
        body:
          "When your family portrait is ready, you can continue into the Christmas Card Maker and finish with a message.",
        linkHref: "/christmas/cards",
        linkLabel: "Turn your family portrait into a Christmas card",
      },
      {
        h2: "More Christmas portraits",
        body: "Looking for a different subject? Start from the full photo generator or jump to couples and pets.",
        list: [
          "AI Christmas Photo Generator → /christmas/photo-generator",
          "Couple Christmas Portraits → /christmas/couples",
          "Pet Christmas Portraits → /christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I create a Christmas portrait from one family photo?",
        a: "Yes. Upload one clear family photo, choose a Christmas style, and create your family portrait.",
      },
      {
        q: "Can multiple people be included?",
        a: "Yes. This route is designed for groups. Keep everyone clearly visible in the original photo.",
      },
      {
        q: "Can grandparents be included?",
        a: "Yes. Multi-generation photos — including grandparents and babies — are welcome when faces are visible.",
      },
      {
        q: "Can I include a family pet?",
        a: "Yes when the pet is clearly visible in the family photo. For pet-only portraits, use the Pets, Dogs, or Cats experiences.",
      },
      {
        q: "Which photos work best?",
        a: "Clear photos with visible faces, decent lighting, and everyone you want included. Avoid extreme blur.",
      },
      {
        q: "Can I try multiple Christmas styles?",
        a: "Yes. Choose from the family Christmas styles listed on the page, and you can try another style after creating a portrait.",
      },
      {
        q: "Can I download the finished portrait?",
        a: "Yes. When your portrait is ready, download it from the result screen.",
      },
      {
        q: "Can I use it in a Christmas card?",
        a: "Yes. Portrait handoff into the Christmas Card Maker is supported.",
      },
    ],
    markers: [
      "What is a family Christmas photo generator?",
      "Create a Family Christmas Portrait",
      "Family Christmas Photo Examples",
      "Christmas Styles for Families",
      "What Family Photos Work Best?",
    ],
  },

  "/christmas/couples": {
    path: "/christmas/couples",
    wave: "p2b",
    geo: {
      h2: "What is a couple Christmas photo generator?",
      body:
        "A couple Christmas photo generator turns a photo of two people into a romantic or cozy Christmas couple portrait. On TheDigitalGifter, you upload one photo that includes both of you, choose a couple Christmas style, and create a downloadable portrait you can share privately or use in a Christmas card.",
    },
    sections: [
      {
        h2: "Create a Christmas Portrait Together",
        body:
          "This experience is for two people — partners, engaged couples, husband and wife, or boyfriend and girlfriend. Upload one photo with both of you clearly visible, pick a Christmas look, and create a portrait made for the two of you.",
      },
      {
        h2: "Christmas Couple Photo Ideas",
        body:
          "Use cases this portrait often fits — as inspiration, not separate product modes:",
        list: [
          "First Christmas together",
          "Engaged couple Christmas portrait",
          "Husband and wife holiday portrait",
          "Boyfriend and girlfriend Christmas photo",
          "Long-distance Christmas surprise to share digitally",
          "Couple Christmas card photo",
        ],
      },
      {
        h2: "Romantic Christmas Styles",
        body:
          "Couple styles available today include Romantic Snowfall, Cozy Fireplace, Christmas Movie, Elegant Christmas, Winter City, Christmas Market, Classic Portrait, and Vintage Christmas.",
      },
      {
        h2: "What Couple Photos Work Best?",
        body:
          "Use one clear photo where both faces are visible and neither person is heavily cropped out. Good lighting helps. Selfies can work when both people are recognizable.",
      },
      {
        h2: "Make It a Christmas Card",
        body:
          "After you create a couple portrait, you can bring it into the Christmas Card Maker.",
        linkHref: "/christmas/cards",
        linkLabel: "Turn your couple portrait into a Christmas card",
      },
      {
        h2: "Related Christmas portraits",
        body: "Need a family or pet portrait instead?",
        list: [
          "Family Christmas Portraits → /christmas/family",
          "AI Christmas Photo Generator → /christmas/photo-generator",
          "Pet Christmas Portraits → /christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I use a selfie?",
        a: "Yes, when both people are clearly visible and recognizable in the same photo.",
      },
      {
        q: "Can both people stay recognizable?",
        a: "That’s the goal. Start with a clear photo of both faces — avoid extreme blur or one person mostly out of frame.",
      },
      {
        q: "Can I create a romantic Christmas portrait?",
        a: "Yes. Choose romantic or cozy couple styles such as Romantic Snowfall, Cozy Fireplace, or Elegant Christmas.",
      },
      {
        q: "Can I try different styles?",
        a: "Yes. Pick from the couple Christmas styles on the page before you create.",
      },
      {
        q: "Can I use the result as a Christmas card?",
        a: "Yes. Portrait handoff into the Christmas Card Maker is supported.",
      },
      {
        q: "Can I download it?",
        a: "Yes. Download the finished couple portrait from the result screen when it’s ready.",
      },
      {
        q: "What kind of photo should I upload?",
        a: "One clear photo that includes both of you. Faces should be visible; JPEG, PNG, or WebP works.",
      },
    ],
    markers: [
      "What is a couple Christmas photo generator?",
      "Create a Christmas Portrait Together",
      "Christmas Couple Photo Ideas",
      "Romantic Christmas Styles",
      "What Couple Photos Work Best?",
    ],
  },

  "/christmas/pets": {
    path: "/christmas/pets",
    wave: "p2b",
    geo: {
      h2: "What is a Christmas pet photo generator?",
      body:
        "A Christmas pet photo generator turns a photo of a dog, cat, or other pet into a festive Christmas pet portrait. On TheDigitalGifter, the Pets page is the hub for animal Christmas portraits, with specialized routes for dogs and cats, downloadable results, and an optional handoff into a Christmas card.",
    },
    sections: [
      {
        h2: "Turn Your Pet Into Christmas Magic",
        body:
          "Upload a clear pet photo, choose a Christmas pet style, and create a festive portrait of the animal you love. This is the general pet hub — not a Secret Life comic pack.",
      },
      {
        h2: "Christmas Portraits for Dogs and Cats",
        body:
          "Want a clearer start for one species? Use the specialized dog or cat routes — they help validate the photo and keep the experience dog- or cat-focused.",
        list: [
          "Christmas Dog Photo Generator → /christmas/dogs",
          "Christmas Cat Photo Generator → /christmas/cats",
        ],
      },
      {
        h2: "Pet Christmas Photo Examples",
        body:
          "Demo directions for pet Christmas portraits. Samples are inspiration, not customer photos.",
        list: [
          "Dog Christmas portrait in a festive scene",
          "Cat Christmas portrait by a tree or fireplace look",
          "Cozy sweater or Santa-inspired pet portrait styles",
        ],
      },
      {
        h2: "Christmas Styles for Pets",
        body:
          "Pet styles available today include Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
      },
      {
        h2: "What Pet Photos Work Best?",
        body:
          "Choose a clear photo with the pet’s face and eyes visible, decent lighting, and without extreme blur. If more than one pet should appear, make sure each animal is visible in the upload.",
      },
      {
        h2: "Pet Christmas Cards",
        body: "You can carry a finished pet portrait into the Christmas Card Maker.",
        linkHref: "/christmas/cards",
        linkLabel: "Turn your pet portrait into a Christmas card",
      },
    ],
    faqs: [
      {
        q: "Can I create a Christmas portrait of my dog?",
        a: "Yes. Start here or go to the dedicated Christmas dog portrait page for a dog-focused path.",
      },
      {
        q: "Can I create one for my cat?",
        a: "Yes. Use this Pets hub or the dedicated Christmas cat portrait page.",
      },
      {
        q: "Can I include more than one pet?",
        a: "If multiple pets are clearly visible in one photo, you can try that upload. Results are best when each animal’s face is easy to see.",
      },
      {
        q: "Can I include myself with my pet?",
        a: "This route is optimized for the pet as the star. For people-plus-pet family frames, the Family Christmas experience is often a better start.",
      },
      {
        q: "Which photos work best?",
        a: "Clear pet photos with visible eyes and face, good lighting, and limited blur.",
      },
      {
        q: "Can I download the image?",
        a: "Yes. Download from the result screen when your pet portrait is ready.",
      },
      {
        q: "Can I use it on a Christmas card?",
        a: "Yes. Portrait handoff into the Christmas Card Maker is supported.",
      },
    ],
    markers: [
      "What is a Christmas pet photo generator?",
      "Turn Your Pet Into Christmas Magic",
      "Christmas Portraits for Dogs and Cats",
      "Christmas Styles for Pets",
      "What Pet Photos Work Best?",
    ],
  },

  "/christmas/dogs": {
    path: "/christmas/dogs",
    wave: "p2b",
    geo: {
      h2: "What is a Christmas dog photo generator?",
      body:
        "A Christmas dog photo generator creates a festive Christmas portrait from a photo of your dog. On TheDigitalGifter, you upload a clear dog photo, choose a Christmas pet style, and download a dog-focused holiday portrait — with an optional path into a Christmas card.",
    },
    sections: [
      {
        h2: "Create a Christmas Portrait of Your Dog",
        body:
          "This page is dog-specific. Upload a photo of your dog, pick a Christmas style, and create a holiday portrait that keeps the dog as the clear subject. If the photo looks like a cat, you’ll be guided to the cat experience.",
      },
      {
        h2: "Christmas Dog Portrait Examples",
        body:
          "Demonstration directions for dog Christmas portraits — inspiration samples, not customer photos.",
        list: [
          "Dog beside a decorated Christmas tree look",
          "Cozy fireplace dog Christmas portrait",
          "Snowy Christmas dog portrait",
          "Santa-inspired or sweater-style dog Christmas portrait",
        ],
      },
      {
        h2: "Christmas Styles for Dogs",
        body:
          "Dog portraits use the Christmas pet style set: Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
      },
      {
        h2: "How to Choose a Good Dog Photo",
        body:
          "Pick a photo where your dog’s eyes and face are visible, the head isn’t heavily cropped, and blur is minimal. For more than one dog, make sure every dog you want in the portrait is clearly in the frame.",
      },
      {
        h2: "Christmas Cards With Your Dog",
        body: "Finished dog portraits can continue into the Christmas Card Maker.",
        linkHref: "/christmas/cards",
        linkLabel: "Make a Christmas card with your dog portrait",
      },
      {
        h2: "Related pet Christmas portraits",
        body: "Exploring other animals or the general pet hub?",
        list: [
          "Christmas Pet Portraits → /christmas/pets",
          "Christmas Cat Photo Generator → /christmas/cats",
          "AI Christmas Photo Generator → /christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I create a Christmas portrait of my dog?",
        a: "Yes. Upload a clear dog photo on this page, choose a Christmas style, and create the portrait.",
      },
      {
        q: "What if I upload a cat photo by mistake?",
        a: "You’ll get a prompt to switch to the Christmas cat portrait experience.",
      },
      {
        q: "Can I include more than one dog?",
        a: "Yes if every dog is clearly visible in the same photo. Faces and eyes should be easy to see.",
      },
      {
        q: "Which dog photos work best?",
        a: "Clear face and eyes, limited blur, and avoid cropping off the ears or head.",
      },
      {
        q: "Can I try different Christmas styles for my dog?",
        a: "Yes. Choose from the dog-ready Christmas pet styles listed on the page.",
      },
      {
        q: "Can I download the dog portrait?",
        a: "Yes. Download it from the result screen when ready.",
      },
      {
        q: "Can I put my dog on a Christmas card?",
        a: "Yes. Use the Christmas Card Maker handoff after your portrait is ready.",
      },
    ],
    markers: [
      "What is a Christmas dog photo generator?",
      "Create a Christmas Portrait of Your Dog",
      "Christmas Dog Portrait Examples",
      "How to Choose a Good Dog Photo",
      "Christmas Cards With Your Dog",
    ],
  },

  "/christmas/cats": {
    path: "/christmas/cats",
    wave: "p2b",
    geo: {
      h2: "What is a Christmas cat photo generator?",
      body:
        "A Christmas cat photo generator creates a festive Christmas portrait from a photo of your cat. On TheDigitalGifter, you upload a clear cat photo, choose a Christmas pet style, and download a cat-focused holiday portrait you can also use in a Christmas card.",
    },
    sections: [
      {
        h2: "Create a Magical Christmas Portrait of Your Cat",
        body:
          "This page is cat-specific. Upload a photo of your cat, choose a Christmas look, and create a holiday portrait with the cat as the star. Dog photos are redirected toward the dog experience.",
      },
      {
        h2: "Christmas Cat Portrait Examples",
        body:
          "Demonstration directions featuring cats — inspiration samples, not customer photos.",
        list: [
          "Cat by a Christmas tree look",
          "Fireplace cozy cat Christmas portrait",
          "Snowy or elegant Christmas cat portrait",
          "Royal or vintage Christmas cat portrait styles",
        ],
      },
      {
        h2: "Christmas Styles for Cats",
        body:
          "Cat portraits use the Christmas pet style set: Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
      },
      {
        h2: "How to Choose a Good Cat Photo",
        body:
          "Choose a photo where your cat’s eyes and face are sharp and visible. Avoid extreme blur, heavy shadow across the face, or tight crops that cut off the ears and whiskers.",
      },
      {
        h2: "Turn Your Cat Portrait Into a Christmas Card",
        body: "After creating a cat Christmas portrait, you can continue into the Christmas Card Maker.",
        linkHref: "/christmas/cards",
        linkLabel: "Make a Christmas card with your cat portrait",
      },
      {
        h2: "Related pet Christmas portraits",
        body: "Need dogs or the general pet hub instead?",
        list: [
          "Christmas Pet Portraits → /christmas/pets",
          "Christmas Dog Photo Generator → /christmas/dogs",
          "AI Christmas Photo Generator → /christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I create a Christmas portrait of my cat?",
        a: "Yes. Upload a clear cat photo here, choose a Christmas style, and create the portrait.",
      },
      {
        q: "What if I upload a dog photo?",
        a: "You’ll be guided to switch to the Christmas dog portrait page.",
      },
      {
        q: "Do whiskers and face detail matter?",
        a: "Yes. Clear face and eye detail usually produce a stronger cat Christmas portrait.",
      },
      {
        q: "Can I try elegant or cozy looks for my cat?",
        a: "Yes. Styles include Cozy Christmas, Royal Christmas, Vintage Christmas, Snow Portrait, and more.",
      },
      {
        q: "Can I download the cat portrait?",
        a: "Yes. Download from the result screen when it’s ready.",
      },
      {
        q: "Can I use my cat portrait on a Christmas card?",
        a: "Yes. Card Maker handoff is supported after the portrait is created.",
      },
      {
        q: "Is this different from the Pets page?",
        a: "Yes. Pets is the general animal hub; this page is specifically for cats.",
      },
    ],
    markers: [
      "What is a Christmas cat photo generator?",
      "Create a Magical Christmas Portrait of Your Cat",
      "Christmas Cat Portrait Examples",
      "How to Choose a Good Cat Photo",
      "Turn Your Cat Portrait Into a Christmas Card",
    ],
  },

  "/christmas/tree": {
    path: "/christmas/tree",
    wave: "p2b",
    geo: {
      h2: "What is a digital Christmas tree?",
      body:
        "A digital Christmas tree is an interactive online Christmas tree you can customize and share. On TheDigitalGifter, you choose a tree look, add decorations, place gift boxes with personal messages underneath, and share a private link so someone special can open the gifts on their screen — without turning the share page into a public search result.",
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
          "Today you can add gift boxes that hold personal Christmas messages. Each gift can use a festive box style such as red, gold, green, blue, or snow. Additional gift types may expand later — the current creator focuses on message gifts.",
        list: [
          "Personal Christmas messages inside gift boxes",
          "Festive box styles (red, gold, green, blue, snow)",
        ],
      },
      {
        h2: "Share Your Christmas Tree",
        body:
          "When you’re ready, turn sharing on and send one link. Recipients open the tree to see decorations and unwrap gifts. Shared tree links are meant for people you trust and are not indexed for search engines.",
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
      {
        h2: "More Christmas magic",
        body: "Pair your tree with other Christmas creations when you want something extra under the holiday mood.",
        list: [
          "Christmas hub → /christmas",
          "Personalized Santa Video → /christmas/santa-video",
          "Online Advent Calendar → /christmas/advent",
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
        q: "Do I need an account?",
        a: "You can start creating a tree without a complex setup — ownership is handled for the creator session so you can keep editing.",
      },
      {
        q: "Is the shared tree public?",
        a: "Shared trees are reachable by people with the link, but share pages are noindex and not meant for search engines.",
      },
    ],
    markers: [
      "What is a digital Christmas tree?",
      "Build a Digital Christmas Tree",
      "What Can You Put Under Your Tree?",
      "Share Your Christmas Tree",
      "How It Works",
    ],
  },

  "/christmas/advent": {
    path: "/christmas/advent",
    wave: "p2b",
    geo: {
      h2: "What is an online Advent calendar?",
      body:
        "An online Advent calendar is a digital version of the traditional Advent calendar: a new door unlocks each day in December leading up to Christmas. On TheDigitalGifter, you open today’s door on a 1–24 calendar (Europe/Bucharest time). Past doors stay closed after the day passes, and some rewards may require signing in when claims are live.",
    },
    sections: [
      {
        h2: "A Little Christmas Magic Every Day",
        body:
          "The Advent calendar is a countdown experience with twenty-four doors. Each day in December has its own door — a small ritual of opening something new as Christmas approaches.",
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
      {
        h2: "More Christmas magic",
        body: "Continue the season with a digital tree or the Christmas hub.",
        list: [
          "Digital Christmas Tree → /christmas/tree",
          "Christmas hub → /christmas",
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
      {
        q: "Can I share it?",
        a: "You can share the Advent calendar page link so others can open their own daily doors.",
      },
    ],
    markers: [
      "What is an online Advent calendar?",
      "A Little Christmas Magic Every Day",
      "Open a New Door Every Day",
      "Before December 1",
      "How the Advent Calendar Works",
    ],
  },

  "/christmas/messages": {
    path: "/christmas/messages",
    wave: "p2b",
    geo: {
      h2: "What is a Christmas message generator?",
      body:
        "A Christmas message generator helps you write Christmas wishes by choosing who the message is for and the tone you want — then generating editable message options. On TheDigitalGifter, you can create heartfelt, funny, romantic, warm, short, professional, or religious Christmas messages in English or Romanian, then copy them or continue into a Christmas card.",
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
          "The generator supports common Christmas relationships. Start the tool and choose who you’re writing to — dedicated recipient landing pages are not live yet.",
        list: [
          "Mom",
          "Dad",
          "Wife",
          "Husband",
          "Girlfriend",
          "Boyfriend",
          "Family",
          "Friend",
          "Coworker",
        ],
      },
      {
        h2: "Christmas Messages by Tone",
        body:
          "Tone options available today include warm, funny, romantic, heartfelt, short and sweet, professional, and religious.",
      },
      {
        h2: "Christmas Message Examples",
        body:
          "Demonstration directions for the kinds of wishes the tool can help you draft — edit anything to sound like you.",
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
        body:
          "When you find words you like, continue into the Christmas Card Maker and pair the message with a photo and design.",
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
    markers: [
      "What is a Christmas message generator?",
      "Find the Perfect Christmas Message",
      "Christmas Messages by Recipient",
      "Christmas Messages by Tone",
      "How to Write a Meaningful Christmas Message",
    ],
  },
};
