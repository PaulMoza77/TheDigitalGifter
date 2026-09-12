import { INTENT_CLUSTER_SPECS } from "./clusterCopyIntents";
import { MESSAGE_CLUSTER_SPECS } from "./clusterCopyMessages";
import type { ChristmasSeoSpec } from "./types";

function giftsPath(slug: string): string {
  return `/christmas/gifts-for-${slug}`;
}

function messagesPath(slug: string): string {
  return `/christmas/messages-for-${slug}`;
}

const GIFT_CLUSTER_SPECS: ChristmasSeoSpec[] = [
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "mom",
    canonicalPath: giftsPath("mom"),
    ctaHref: "/christmas/gift-finder?recipient=mom",
    recipientKey: "mom",
    en: {
      title: "Christmas Gift Ideas for Mom",
      metaTitle: "Christmas Gift Ideas for Mom (2026) | TheDigitalGifter",
      metaDescription:
        "Find a Christmas gift for mom that feels chosen, not rushed: portrait keepsakes, a Santa video she will replay, cards with her name, and a guided Gift Finder.",
      h1: "Christmas gift ideas for mom that feel personal",
      intro:
        "The hardest Christmas gift for mom is the one that does not look like it came from a last-minute aisle. She already owns mugs, candles, and “world’s best mom” slogans. What she keeps is proof that you noticed her year: a portrait of the family she built, a note in her language, a Santa video that says her grandchild’s name, or a wishlist she can finally share without playing host. This guide is a shortlist of digital gifts you can finish tonight, plus the questions that stop you from buying something she will politely thank you for and never use.",
      imageAlt: "Warm Christmas living room styled for a gift guide for mom",
      ctaText: "Find a gift for mom",
      benefits: [
        {
          title: "Keepsakes she will actually display",
          text: "A Christmas portrait and a printed-at-home card beat another object that competes for drawer space.",
        },
        {
          title: "Words when you freeze at the card aisle",
          text: "Open the message generator with mom already selected, edit two lines, and drop the text onto a card.",
        },
        {
          title: "One link for the whole family",
          text: "If siblings keep buying the same scarf, share a wishlist and reserve gifts so nobody doubles up.",
        },
      ],
      faq: [
        {
          question: "What if I do not know her size, style, or Amazon list?",
          answer:
            "Skip apparel. A family portrait, a card with a specific memory, or a Santa video for her grandchild does not need a size. Start the Gift Finder with recipient set to mom and add one true detail: garden, choir, Sunday cooking, or the grandchild’s name.",
        },
        {
          question: "Is a digital gift too cheap for mom?",
          answer:
            "Cheap is generic. A portrait she can frame, a letter on a wishlist, or a Santa clip she forwards to the group chat is the opposite of a $12 object with no story. You can still add flowers or dinner on top.",
        },
        {
          question: "Can I make this in Romanian or English?",
          answer:
            "Yes. Gift Finder, messages, and cards support English and Romanian copy. Use the language she actually speaks at the table, not the language the store defaulted to.",
        },
        {
          question: "How do I avoid a thin, lookalike gift page idea?",
          answer:
            "Name one scene from this year. The factory pages exist to start you; the Gift Finder and message generator turn that scene into a gift she can open.",
        },
      ],
      sections: [
        {
          heading: "Gifts mom keeps instead of re-gifting",
          body: "Start with something she can hold up at the table. Digital does not mean disposable when the file is a portrait, a card, or a video she will watch more than once. Pair any of these with a phone call; do not let the file replace showing up.",
          items: [
            {
              title: "Family Christmas portrait",
              text: "Upload one real photo and turn it into a Christmas scene she can print. Better than a collage of screenshots from the group chat.",
            },
            {
              title: "Santa video for the grandchild she spoils",
              text: "If she is the grandmother-in-chief, a Santa message that names the child is the gift she forwards at 6 a.m.",
            },
            {
              title: "A card that mentions this year",
              text: "Write the kitchen disaster, the hospital wait, or the quiet Tuesday she carried. The message generator drafts; you add the one line only you know.",
            },
            {
              title: "A wishlist she controls",
              text: "Moms often refuse to ask. Build the list with her, then share one link so the rest of the family stops guessing.",
            },
            {
              title: "Couples portrait if dad is in the picture",
              text: "A two-person Christmas portrait is the rare gift that is about their marriage, not another appliance.",
            },
          ],
        },
        {
          heading: "How to choose in under ten minutes",
          body: "Ask two questions: will she display it, and will she feel seen? If the answer to both is no, keep looking. If she already has too much stuff, a portrait or card wins. If she is far away, a Santa video or a shared tree ornament from the family tree is the thing she can reopen in January. If siblings fight over who bought the “real” gift, put everyone on one wishlist and reserve items.",
        },
        {
          heading: "Use TheDigitalGifter without turning Christmas into checkout",
          body: "These cluster pages are guides, not storefronts. The Gift Finder suggests ideas from a live catalog of experiences we already ship: portraits, Santa video, cards, wishlist, and tree. There is no invented merchant price and no fake “buy now” button on this page. When you are ready, open the finder with mom preselected or jump straight to a portrait.",
        },
      ],
      relatedPages: [
        { label: "Christmas messages for mom", url: messagesPath("mom") },
        { label: "Gifts for dad", url: giftsPath("dad") },
        { label: "Gifts for grandparents", url: giftsPath("grandparents") },
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
        { label: "Open Gift Finder", url: "/christmas/gift-finder?recipient=mom" },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru mama",
      metaTitle: "Cadouri de Crăciun pentru mama (2026) | TheDigitalGifter",
      metaDescription:
        "Cadou de Crăciun pentru mama care nu pare luat de la casa de marcat: portret de familie, video de la Moș, felicitare cu un detaliu real și Gift Finder ghidat.",
      h1: "Cadouri de Crăciun pentru mama, alese pe bune",
      intro:
        "Cel mai greu cadou pentru mama este cel care nu arată ca o soluție de ultim moment. Are deja căni, lumânări și slogane „cea mai bună mamă”. Păstrează dovada că ai observat anul ei: un portret al familiei pe care a construit-o, un mesaj în limba ei, un video de la Moș cu numele nepotului sau o listă de dorințe pe care o poate împărtăși fără să joace gazdă. Ghidul de față e o listă scurtă de cadouri digitale pe care le poți termina diseară, plus întrebările care te opresc să cumperi ceva pentru care îți mulțumește politicos și nu folosește niciodată.",
      imageAlt: "Cameră de Crăciun caldă, gândită pentru un ghid de cadouri pentru mama",
      ctaText: "Găsește un cadou pentru mama",
      benefits: [
        {
          title: "Amintiri pe care le pune la vedere",
          text: "Un portret de Crăciun și o felicitare tipărită acasă bat încă un obiect care luptă pentru un sertar.",
        },
        {
          title: "Cuvinte când te blochezi în fața raftului",
          text: "Deschide generatorul de mesaje cu mama deja selectată, modifică două rânduri și pune textul pe felicitare.",
        },
        {
          title: "Un singur link pentru toată familia",
          text: "Dacă frații cumpără același fular, împărtășiți o listă și rezervați cadourile ca să nu se dubleze.",
        },
      ],
      faq: [
        {
          question: "Ce fac dacă nu știu mărimea, stilul sau lista ei de pe Amazon?",
          answer:
            "Evită hainele. Un portret de familie, o felicitare cu o amintire concretă sau un video de la Moș pentru nepot nu au nevoie de mărime. Pornește Gift Finder cu destinatarul „mama” și adaugă un detaliu adevărat: grădină, cor, gătit de duminică sau numele nepotului.",
        },
        {
          question: "Un cadou digital e prea ieftin pentru mama?",
          answer:
            "Ieftin înseamnă generic. Un portret pe care îl poate înrăma, o scrisoare pe listă sau un clip de la Moș pe care îl dă mai departe pe grup este opusul unui obiect de 50 de lei fără poveste. Poți adăuga flori sau o cină peste.",
        },
        {
          question: "Pot face asta în română sau în engleză?",
          answer:
            "Da. Gift Finder, mesajele și felicitările au copiere în română și engleză. Folosește limba pe care o vorbește la masă, nu limba implicită a magazinului.",
        },
        {
          question: "Cum evit un cadou care pare copiat de pe internet?",
          answer:
            "Spune o scenă din anul ăsta. Pagina de față te pornește; Gift Finder și generatorul de mesaje transformă scena într-un cadou pe care îl poate deschide.",
        },
      ],
      sections: [
        {
          heading: "Cadouri pe care mama le păstrează",
          body: "Începe cu ceva ce poate arăta la masă. Digital nu înseamnă de unică folosință când fișierul e un portret, o felicitare sau un video pe care îl revine. Leagă oricare dintre astea de un telefon; nu lăsa fișierul să înlocuiască prezența.",
          items: [
            {
              title: "Portret de familie de Crăciun",
              text: "Încarcă o poză reală și transform-o într-o scenă de sărbători pe care o poate printa. Mai bun decât un colaj de screenshot-uri din grup.",
            },
            {
              title: "Video de la Moș pentru nepotul răsfățat",
              text: "Dacă e bunica-șefă, un mesaj de la Moș care rostește numele copilului e cadoul pe care îl dă mai departe la 6 dimineața.",
            },
            {
              title: "Felicitare care pomenește anul ăsta",
              text: "Scrie dezastrul din bucătărie, așteptarea de la spital sau marțea liniștită pe care a dus-o ea. Generatorul scrie ciorna; tu adaugi rândul pe care doar tu îl știi.",
            },
            {
              title: "O listă de dorințe pe care o controlează ea",
              text: "Mamele refuză des să ceară. Faceți lista împreună, apoi trimiteți un link ca restul familiei să nu mai ghicească.",
            },
            {
              title: "Portret de cuplu dacă tata e în poză",
              text: "Un portret de Crăciun în doi e cadoul rar care e despre căsnicia lor, nu despre încă un electrocasnic.",
            },
          ],
        },
        {
          heading: "Cum alegi în mai puțin de zece minute",
          body: "Pune două întrebări: o să-l țină la vedere și o să se simtă văzută? Dacă ambele răspunsuri sunt nu, caută mai departe. Dacă are deja prea multe lucruri, portretul sau felicitarea câștigă. Dacă e departe, un video de la Moș sau un cadou pe bradul familiei e ce poate redeschide în ianuarie. Dacă frații se ceartă cine a dat „cadoul adevărat”, puneți totul pe o listă și rezervați obiectele.",
        },
        {
          heading: "Folosește TheDigitalGifter fără să transformi Crăciunul în casă de marcat",
          body: "Pagina e ghid, nu vitrină. Gift Finder propune idei din catalogul de experiențe pe care le avem deja: portrete, video de la Moș, felicitări, listă și brad. Nu inventăm prețuri de magazine și nu există un buton fals de cumpărare aici. Când ești gata, deschide finder-ul cu mama preselată sau sari direct la un portret.",
        },
      ],
      relatedPages: [
        { label: "Mesaje de Crăciun pentru mama", url: messagesPath("mom") },
        { label: "Cadouri pentru tata", url: giftsPath("dad") },
        { label: "Cadouri pentru bunici", url: giftsPath("grandparents") },
        { label: "Mesaje de familie", url: "/christmas/christmas-messages-for-family" },
        { label: "Deschide Gift Finder", url: "/christmas/gift-finder?recipient=mom" },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "dad",
    canonicalPath: giftsPath("dad"),
    ctaHref: "/christmas/gift-finder?recipient=dad",
    recipientKey: "dad",
    en: {
      title: "Christmas Gift Ideas for Dad",
      metaTitle: "Christmas Gift Ideas for Dad (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas gifts for dad that skip the novelty socks: a portrait he will actually hang, a funny card, a Santa cameo for the grandkids, and a Gift Finder that starts with him.",
      h1: "Christmas gift ideas for dad that are not another gadget",
      intro:
        "Dad will say he does not need anything. That sentence is how families end up with grill tools, flashlight keychains, and a mug that jokes about retirement. The gifts he keeps are quieter: a photo of the people he still drives across town for, a short note that does not embarrass him in public, or a Santa video he can show the grandkids without making a speech. Use this page to pick a lane — pride, humor, or memory — then finish the gift in the finder or the card studio instead of wandering a hardware aisle at 8 p.m. on the 23rd.",
      imageAlt: "Christmas gift scene styled for a dad-focused digital keepsake",
      ctaText: "Find a gift for dad",
      benefits: [
        {
          title: "Pride without a speech",
          text: "A portrait or a short video lets him feel the year without standing up at dinner to receive a toast.",
        },
        {
          title: "Humor that still lands",
          text: "Funny Christmas messages exist so the card can tease him and still say you noticed the hard parts.",
        },
        {
          title: "Something the grandkids can watch",
          text: "If he is “Papa,” a Santa clip with the child’s name is the gift he replays when the house is empty.",
        },
      ],
      faq: [
        {
          question: "He says he does not want anything. Now what?",
          answer:
            "Believe the part about objects. Do not believe the part about being forgotten. A portrait, a card with one specific sentence, or a shared wishlist he can edit is how you respect the “don’t buy junk” rule.",
        },
        {
          question: "What if he hates being on camera?",
          answer:
            "Use an existing photo for a Christmas portrait or write a card. Santa video is for the grandchild, not a demand that dad perform. The Gift Finder can stay in practical or sentimental mode without a new photoshoot.",
        },
        {
          question: "Can I keep it light and still sincere?",
          answer:
            "Yes. Start with a funny Christmas message, then add one un-jokey line at the end. That last sentence is the gift; the joke is how he lets you give it.",
        },
      ],
      sections: [
        {
          heading: "Lanes that work for most dads",
          body: "Pick one job for the gift: make him proud, make him laugh, or give him something to show the kids. Mixing all three in one object usually produces a gimmick. Digital gifts win here because they do not add another thing to the garage.",
          items: [
            {
              title: "Christmas portrait from a real photo",
              text: "Use a picture where he looks like himself, not a forced studio grin. The page is about him, not a costume.",
            },
            {
              title: "Funny card with a serious last line",
              text: "Tease the grill, the remote, or the 5 a.m. coffee. Close with the year he showed up. Print it at home.",
            },
            {
              title: "Santa video for his grandchild",
              text: "He may shrug at gifts for himself and light up when Santa says the child’s name on the living-room TV.",
            },
            {
              title: "Couples portrait with mom",
              text: "If they still sit on the same couch, a two-person scene is more honest than separate novelty shirts.",
            },
            {
              title: "A wishlist he can quietly edit",
              text: "Some dads will add one tool and delete three sweaters. That edit is useful data for everyone else.",
            },
          ],
        },
        {
          heading: "What to skip this year",
          body: "Skip licensed mugs, diet jokes, and anything that comments on his body, job loss, or age unless he started that joke first. Skip “world’s best dad” unless you add a sentence that could only be about him. If you are buying for a stepfather or father-in-law, lead with respect and a memory you actually share — the message generator can stay warm without pretending you grew up in the same house.",
        },
        {
          heading: "Finish it on TheDigitalGifter",
          body: "Open Gift Finder with dad selected, or jump to messages if you already know the gift is a card. These pages do not sell third-party gadgets or invent prices. They route you into the free tools: finder, cards, portraits, Santa, wishlist. Checkout stays off unless you later choose a paid portrait or Santa package on those product pages.",
        },
      ],
      relatedPages: [
        { label: "Christmas messages for dad", url: messagesPath("dad") },
        { label: "Gifts for mom", url: giftsPath("mom") },
        { label: "Funny Christmas messages", url: "/christmas/funny-christmas-messages" },
        { label: "Gifts for grandparents", url: giftsPath("grandparents") },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru tata",
      metaTitle: "Cadouri de Crăciun pentru tata (2026) | TheDigitalGifter",
      metaDescription:
        "Cadouri de Crăciun pentru tata fără șosete-glumă: portret pe care îl pune pe perete, felicitare amuzantă, Moș pentru nepoți și Gift Finder pornit pe el.",
      h1: "Cadouri de Crăciun pentru tata, nu încă un gadget",
      intro:
        "Tata o să zică că nu are nevoie de nimic. Din propoziția asta ies pensule de grătar, brelocuri-lanternă și o cană despre pensie. Cadourile pe care le ține sunt mai tăcute: o poză cu oamenii pentru care încă pornește mașina, un bilet scurt care nu-l pune în scenă la masă sau un video de la Moș pe care îl poate da nepoților fără discurs. Folosește pagina ca să alegi o direcție — mândrie, umor sau amintire — apoi termină cadoul în finder sau în studio de felicitări, nu pe un culoar de bricolaj pe 23 seara.",
      imageAlt: "Scenă de Crăciun gândită pentru un cadou digital pentru tata",
      ctaText: "Găsește un cadou pentru tata",
      benefits: [
        {
          title: "Mândrie fără discurs",
          text: "Un portret sau un video scurt îi arată anul fără să-l ridice în picioare ca să primească un toast.",
        },
        {
          title: "Umor care tot ajunge la el",
          text: "Mesajele amuzante există ca felicitarea să-l tachineze și totuși să recunoască părțile grele.",
        },
        {
          title: "Ceva ce pot vedea nepoții",
          text: "Dacă e „tataie”, un clip de la Moș cu numele copilului e cadoul pe care îl revede când casa e goală.",
        },
      ],
      faq: [
        {
          question: "Zice că nu vrea nimic. Și acum?",
          answer:
            "Crede partea cu obiectele. Nu crede partea că vrea să fie uitat. Un portret, o felicitare cu o propoziție anume sau o listă pe care o poate edita respectă regula „nu-mi lua gunoaie”.",
        },
        {
          question: "Dacă urăște să fie filmat?",
          answer:
            "Folosește o poză existentă pentru portret sau scrie o felicitare. Video-ul de la Moș e pentru nepot, nu o cerere ca tata să joace teatru. Gift Finder poate rămâne practic sau sentimental fără ședință foto nouă.",
        },
        {
          question: "Pot să rămân lejer și totuși sincer?",
          answer:
            "Da. Începe cu un mesaj amuzant, apoi adaugă un rând fără glumă la final. Ultima propoziție e cadoul; gluma e modul în care acceptă să-l primească.",
        },
      ],
      sections: [
        {
          heading: "Direcții care țin la cei mai mulți tați",
          body: "Alege o treabă pentru cadou: să-l facă mândru, să-l facă să râdă sau să-i dea ceva de arătat copiilor. Dacă le amesteci pe toate trei iese un obiect-gag. Cadourile digitale câștigă pentru că nu mai umplu garajul.",
          items: [
            {
              title: "Portret de Crăciun dintr-o poză reală",
              text: "Alege o imagine în care arată a el, nu un zâmbet de studio. Pagina e despre om, nu despre costum.",
            },
            {
              title: "Felicitare amuzantă cu un final serios",
              text: "Tachinează grătarul, telecomanda sau cafeaua de la 5. Închide cu anul în care a fost prezent. Printeaz-o acasă.",
            },
            {
              title: "Video de la Moș pentru nepot",
              text: "Poate dă din umeri la cadouri pentru el și se luminează când Moșul spune numele copilului la televizor.",
            },
            {
              title: "Portret de cuplu cu mama",
              text: "Dacă încă stau pe aceeași canapea, o scenă în doi e mai cinstită decât tricouri-glumă separate.",
            },
            {
              title: "O listă pe care o editează în liniște",
              text: "Unii tați adaugă o sculă și șterg trei pulovere. Editarea aia e informație utilă pentru toți ceilalți.",
            },
          ],
        },
        {
          heading: "Ce sari anul ăsta",
          body: "Sari peste căni cu licență, glume despre dietă și orice comentariu despre corp, slujbă pierdută sau vârstă, dacă nu a început el gluma. Sari peste „cel mai bun tată” dacă nu adaugi o propoziție care poate fi doar despre el. Dacă e vorba de un tată vitreg sau socru, du-te pe respect și pe o amintire comună reală — generatorul poate rămâne cald fără să pretindă că ați crescut în aceeași casă.",
        },
        {
          heading: "Termină pe TheDigitalGifter",
          body: "Deschide Gift Finder cu tata selectat sau sari la mesaje dacă știi deja că darul e o felicitare. Pagina nu vinde gadgeturi de la terți și nu inventează prețuri. Te duce în uneltele gratuite: finder, felicitări, portrete, Moș, listă. Checkout-ul rămâne oprit până alegi tu, pe paginile de produs, un pachet plătit de portret sau Santa.",
        },
      ],
      relatedPages: [
        { label: "Mesaje de Crăciun pentru tata", url: messagesPath("dad") },
        { label: "Cadouri pentru mama", url: giftsPath("mom") },
        { label: "Mesaje amuzante", url: "/christmas/funny-christmas-messages" },
        { label: "Cadouri pentru bunici", url: giftsPath("grandparents") },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "partner",
    canonicalPath: giftsPath("partner"),
    ctaHref: "/christmas/gift-finder?recipient=partner",
    recipientKey: "partner",
    en: {
      title: "Christmas Gift Ideas for Your Partner",
      metaTitle: "Christmas Gifts for Your Partner (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas gifts for a partner that feel like a date, not a receipt: couples portraits, romantic cards, private wishlist coordination, and a finder that starts with them.",
      h1: "Christmas gift ideas for your partner",
      intro:
        "A partner gift fails in two ways: it is so practical it feels like a household errand, or so performative it feels like content. The middle is a keepsake of the year you actually lived — the trip that almost did not happen, the apartment you finally made quiet, the joke only the two of you still tell. A couples Christmas portrait, a romantic card you write after the generator drafts it, or a wishlist you share in private will beat another scented candle. This page is for girlfriends, boyfriends, wives, husbands, and the person who is simply “home.”",
      imageAlt: "Couples Christmas portrait mood for a partner gift guide",
      ctaText: "Find a gift for your partner",
      benefits: [
        {
          title: "About the two of you",
          text: "Couples portraits and romantic cards are built for a pair, not a generic “someone special” placeholder.",
        },
        {
          title: "Private by default",
          text: "A shared wishlist can stay off the public internet until you both decide to loop in family.",
        },
        {
          title: "Language that matches the relationship",
          text: "English or Romanian, funny or romantic — the message tools follow the tone you already use at dinner.",
        },
      ],
      faq: [
        {
          question: "We already live together. What is left to give?",
          answer:
            "Stop shopping the apartment. Give a scene: a couples portrait from a photo you like, a card that names a fight you got through, or a Santa video if you have kids. The Gift Finder can stay in sentimental or a-little-luxurious mode without adding clutter.",
        },
        {
          question: "Is a digital gift romantic enough?",
          answer:
            "Romance is specificity. A file with your faces in a Christmas room, or a letter that could not be sent to anyone else, is more romantic than a generic jewelry SKU. Print the card. Play the video on the TV. Do not just text a link and walk away.",
        },
        {
          question: "What if we are long distance this year?",
          answer:
            "Make something they can open on a call: a portrait, a card, a message in their language. A wishlist link lets you still coordinate a physical gift without spoiling it in the group chat.",
        },
      ],
      sections: [
        {
          heading: "Gifts that feel like a date",
          body: "Aim for an evening, not a drawer. The object can be a file if the ritual is sitting together when it opens. If you have children, fold them into a family portrait or a Santa video and keep one card that is only for the two of you.",
          items: [
            {
              title: "Couples Christmas portrait",
              text: "Start from a photo where you look like yourselves. The fun is recognizing the year, not becoming illustrated strangers.",
            },
            {
              title: "Romantic card, then print it",
              text: "Use the romantic message lane, cut the clichés, add the nickname only you are allowed to use.",
            },
            {
              title: "A private wishlist for later",
              text: "If family keeps asking what to buy you as a couple, one shared list stops the duplicate air fryers.",
            },
            {
              title: "Family portrait if this is the first Christmas with kids",
              text: "A three-or-more portrait is the album page you will want in five years. Keep the partner card separate.",
            },
            {
              title: "Pet portrait if the “kid” has fur",
              text: "Plenty of couples will fight over who loves the dog more. Put the dog in a Christmas scene and end the argument.",
            },
          ],
        },
        {
          heading: "Tone checks before you hit send",
          body: "Do not joke about leaving, money stress, or an ex unless that is already your shared humor. Do not out a relationship that is still private. If you are newly together, a warm card plus a portrait can be enough; you do not need a grand public wishlist. If you have been together a decade, specificity still wins over spend.",
        },
        {
          heading: "Where to go next",
          body: "Gift Finder with recipient “partner” is the fastest start. Romantic Christmas messages and the couples portrait route are the two deepest pages if you already know the shape of the gift. Nothing on this cluster page starts a payment.",
        },
      ],
      relatedPages: [
        { label: "Romantic Christmas messages", url: "/christmas/romantic-christmas-messages" },
        { label: "Messages for your boyfriend", url: messagesPath("boyfriend") },
        { label: "Messages for your girlfriend", url: messagesPath("girlfriend") },
        { label: "Gifts for a friend", url: giftsPath("friend") },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru partener",
      metaTitle: "Cadouri de Crăciun pentru partener (2026) | TheDigitalGifter",
      metaDescription:
        "Cadouri de Crăciun pentru partener care par o întâlnire, nu o chitanță: portret de cuplu, felicitare romantică, listă privată și un finder pornit pe voi.",
      h1: "Cadouri de Crăciun pentru partenerul tău",
      intro:
        "Un cadou pentru partener eșuează în două feluri: e atât de practic încât pare treabă de casă, sau atât de pus în scenă încât pare conținut. Mijlocul e o amintire din anul pe care l-ați trăit — drumul care aproape n-a fost, apartamentul pe care l-ați făcut în sfârșit liniștit, gluma pe care doar voi o mai spuneți. Un portret de cuplu, o felicitare romantică scrisă după ciorna generatorului sau o listă împărtășită în privat bat încă o lumânare parfumată. Pagina e pentru iubite, iubiți, soții, soți și omul care e, pur și simplu, acasă.",
      imageAlt: "Atmosferă de portret de cuplu pentru un ghid de cadouri de partener",
      ctaText: "Găsește un cadou pentru partener",
      benefits: [
        {
          title: "Despre voi doi",
          text: "Portretele de cuplu și felicitările romantice sunt făcute pentru o pereche, nu pentru un „cineva special” generic.",
        },
        {
          title: "Privat din start",
          text: "O listă comună poate sta departe de internetul public până decideți amândoi să chemați familia.",
        },
        {
          title: "Limba relației voastre",
          text: "Română sau engleză, amuzant sau romantic — uneltele de mesaje urmează tonul de la cină.",
        },
      ],
      faq: [
        {
          question: "Deja locuim împreună. Ce mai poți dărui?",
          answer:
            "Nu mai cumpăra pentru apartament. Dăruiește o scenă: un portret de cuplu dintr-o poză care vă place, o felicitare care numește o ceartă trecută sau un video de la Moș dacă aveți copii. Gift Finder poate rămâne sentimental sau un pic luxos fără să umple dulapul.",
        },
        {
          question: "Un cadou digital e destul de romantic?",
          answer:
            "Romantismul e precizia. Un fișier cu fețele voastre într-o cameră de Crăciun sau o scrisoare care nu putea pleca către altcineva e mai romantic decât un SKU generic de bijuterie. Printează felicitarea. Pune video-ul pe televizor. Nu trimite doar un link și pleca.",
        },
        {
          question: "Dacă anul ăsta suntem la distanță?",
          answer:
            "Fă ceva ce pot deschide pe apel: portret, felicitare, mesaj în limba lor. Un link de listă vă lasă să coordonați și un cadou fizic fără să stricați surpriza în grup.",
        },
      ],
      sections: [
        {
          heading: "Cadouri care se simt ca o întâlnire",
          body: "Țintește o seară, nu un sertar. Obiectul poate fi un fișier dacă ritualul e să stați împreună când se deschide. Dacă aveți copii, băgați-i într-un portret de familie sau un video de la Moș și păstrați o felicitare doar pentru voi doi.",
          items: [
            {
              title: "Portret de cuplu de Crăciun",
              text: "Pornește de la o poză în care arătați a voi. Farmecul e să recunoașteți anul, nu să deveniți străini ilustrați.",
            },
            {
              title: "Felicitare romantică, apoi print",
              text: "Folosește banda romantică de mesaje, taie clișeele, adaugă porecla pe care doar tu ai voie s-o spui.",
            },
            {
              title: "O listă privată pentru mai târziu",
              text: "Dacă familia tot întreabă ce să vă ia „la comun”, o listă singură oprește air fryer-ele duble.",
            },
            {
              title: "Portret de familie dacă e primul Crăciun cu copii",
              text: "Un portret cu trei sau mai mulți e pagina de album pe care o veți vrea în cinci ani. Felicitarea de cuplu rămâne separat.",
            },
            {
              title: "Portret de animal dacă „copilul” are blană",
              text: "Multe cupluri se ceartă cine iubește mai mult câinele. Pune câinele într-o scenă de Crăciun și închide discuția.",
            },
          ],
        },
        {
          heading: "Verificări de ton înainte să trimiți",
          body: "Nu glumi despre plecare, bani sau un fost partener dacă ăsta nu e umorul vostru. Nu scoate la vedere o relație încă privată. Dacă sunteți la început, o felicitare caldă plus un portret pot ajunge; nu-ți trebuie o listă publică. Dacă sunt zece ani împreună, precizia tot bate suma de pe bon.",
        },
        {
          heading: "Încotro de aici",
          body: "Gift Finder cu destinatarul „partener” e startul cel mai rapid. Mesajele romantice și ruta de portret de cuplu sunt paginile cele mai adânci dacă știi deja forma cadoului. Nimic pe pagina asta nu pornește o plată.",
        },
      ],
      relatedPages: [
        { label: "Mesaje romantice de Crăciun", url: "/christmas/romantic-christmas-messages" },
        { label: "Mesaje pentru iubit", url: messagesPath("boyfriend") },
        { label: "Mesaje pentru iubită", url: messagesPath("girlfriend") },
        { label: "Cadouri pentru un prieten", url: giftsPath("friend") },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "friend",
    canonicalPath: giftsPath("friend"),
    ctaHref: "/christmas/gift-finder?recipient=friend",
    recipientKey: "friend",
    en: {
      title: "Christmas Gift Ideas for a Friend",
      metaTitle: "Christmas Gift Ideas for a Friend (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas gifts for a friend that do not feel like obligation: inside-joke cards, portraits from a real night out, a shared tree, and a Gift Finder that starts with friend.",
      h1: "Christmas gift ideas for a friend you actually like",
      intro:
        "Friend gifts die when they try to look expensive. The friendship already has the expensive part: time. What lands is proof you remember the year — the move, the new job, the dog, the joke that got both of you in trouble. A card with an inside joke, a portrait from a photo you already have, or a spot on a shared Christmas tree will beat a candle they will re-gift in March. This page is for the friend who is almost family and the friend you only see twice a year but still text first.",
      imageAlt: "Festive table scene for a friend-to-friend Christmas gift guide",
      ctaText: "Find a gift for a friend",
      benefits: [
        {
          title: "Inside jokes, not catalog jokes",
          text: "Funny and warm message lanes exist so you can start from a draft and swap in the nickname only your thread knows.",
        },
        {
          title: "No awkward price signaling",
          text: "A made card or portrait avoids the “did I spend enough?” spiral that ruins friend exchanges.",
        },
        {
          title: "Easy to send far away",
          text: "Digital files travel. You can still mail a print; you do not need their new apartment code tonight.",
        },
      ],
      faq: [
        {
          question: "We do a Secret Santa with a tight budget. Is this useful?",
          answer:
            "Yes. A card plus a short message is a complete gift at zero product price on this page. If your group allows it, add a portrait. Do not invent a store receipt to look generous.",
        },
        {
          question: "What if I do not have a good photo of us?",
          answer:
            "Write the card. The message generator does not need a photo. If you have any clear picture of them — even a cropped group shot — the portrait tools can still work.",
        },
        {
          question: "Is it weird to give a digital gift to a friend?",
          answer:
            "It is weird to give a generic object with no sentence attached. A file with a specific memory is normal in 2026. Print it if your friend is the kind of person who puts things on the fridge.",
        },
      ],
      sections: [
        {
          heading: "Gifts that sound like your thread",
          body: "If you would not text it, do not print it. Start from a real line you have already said this year, then let the generator clean the grammar. Keep the meanness out unless that is the friendship — and even then, end kind.",
          items: [
            {
              title: "A funny card that only you two understand",
              text: "Open funny Christmas messages, then replace the generic punchline with the story from July.",
            },
            {
              title: "Portrait from a night you survived together",
              text: "Concert, wedding, hospital waiting room — any photo where you both look alive is enough.",
            },
            {
              title: "A spot on a shared Christmas tree",
              text: "Hang a message or a small digital gift on a tree you both can reopen in January.",
            },
            {
              title: "Pet portrait if you have been the emergency sitter",
              text: "If you know the dog’s name and the vet’s neighborhood, you are already family. Put the pet in a Christmas scene.",
            },
            {
              title: "A wishlist they can keep private",
              text: "Useful when a whole friend group wants to coordinate without a 40-message poll.",
            },
          ],
        },
        {
          heading: "When the friendship is uneven this year",
          body: "If you disappeared, a long apology card is better than a loud gift. If they disappeared, a short warm note plus no demand for a reply is enough. Do not use Santa-is-watching language with anyone’s kids unless a parent asked. Do not put a friend’s new relationship on a public wishlist.",
        },
        {
          heading: "Make it in one sitting",
          body: "Gift Finder with friend selected, or jump to messages if you already know you are writing. Related pages for coworkers exist if this is an office friend — keep the tone one notch more careful there. No checkout on this guide.",
        },
      ],
      relatedPages: [
        { label: "Funny Christmas messages", url: "/christmas/funny-christmas-messages" },
        { label: "Gifts for coworkers", url: giftsPath("coworkers") },
        { label: "Gifts for your partner", url: giftsPath("partner") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru un prieten",
      metaTitle: "Cadouri de Crăciun pentru un prieten (2026) | TheDigitalGifter",
      metaDescription:
        "Cadouri de Crăciun pentru un prieten fără aer de obligație: felicitări cu glume interne, portrete dintr-o noapte reală, brad comun și Gift Finder pe prieten.",
      h1: "Cadouri de Crăciun pentru un prieten pe care chiar îl placi",
      intro:
        "Cadourile de prietenie mor când încearcă să pară scumpe. Prietenia are deja partea scumpă: timpul. Ce prinde e dovada că ții minte anul — mutarea, slujba nouă, câinele, gluma care v-a băgat pe amândoi în bucluc. O felicitare cu o glumă internă, un portret dintr-o poză pe care o aveți deja sau un loc pe un brad comun bat o lumânare pe care o vor redărui în martie. Pagina e pentru prietenul care e aproape familie și pentru cel pe care-l vezi de două ori pe an, dar îi scrii primul.",
      imageAlt: "Masă de sărbători pentru un ghid de cadouri de la prieten la prieten",
      ctaText: "Găsește un cadou pentru un prieten",
      benefits: [
        {
          title: "Glume interne, nu glume de catalog",
          text: "Benzile amuzante și calde există ca să pornești dintr-o ciornă și să pui porecla pe care doar thread-ul vostru o știe.",
        },
        {
          title: "Fără semnal jenant de preț",
          text: "O felicitare sau un portret evită spirala „am dat destui bani?” care strică schimburile între prieteni.",
        },
        {
          title: "Ușor de trimis departe",
          text: "Fișierele digitale circulă. Poți totuși să trimiți un print; nu-ți trebuie diseară codul noului apartament.",
        },
      ],
      faq: [
        {
          question: "Avem Secret Santa cu buget mic. Ajută pagina?",
          answer:
            "Da. O felicitare plus un mesaj scurt e un cadou complet, fără preț de produs pe pagina asta. Dacă grupul permite, adaugă un portret. Nu inventa un bon de magazin ca să pari generos.",
        },
        {
          question: "Nu am o poză bună cu noi. Ce fac?",
          answer:
            "Scrie felicitarea. Generatorul de mesaje n-are nevoie de foto. Dacă ai orice imagine clară cu ei — chiar un grup decupat — uneltele de portret tot pot merge.",
        },
        {
          question: "E ciudat să dai un cadou digital unui prieten?",
          answer:
            "Ciudat e să dai un obiect generic fără nicio propoziție. Un fișier cu o amintire anume e normal în 2026. Printează-l dacă prietenul e genul care pune lucruri pe frigider.",
        },
      ],
      sections: [
        {
          heading: "Cadouri care sună a conversația voastră",
          body: "Dacă n-ai scrie asta pe chat, nu o printa. Pornește de la un rând pe care l-ai zis anul ăsta, apoi lasă generatorul să curățe gramatica. Ține răutatea afară dacă asta nu e prietenia — și chiar atunci, închide frumos.",
          items: [
            {
              title: "Felicitare amuzantă pe care doar voi o înțelegeți",
              text: "Deschide mesajele amuzante, apoi înlocuiește poanta generică cu povestea din iulie.",
            },
            {
              title: "Portret dintr-o noapte pe care ați dus-o împreună",
              text: "Concert, nuntă, sala de așteptare — orice poză în care arătați vii e de ajuns.",
            },
            {
              title: "Un loc pe un brad de Crăciun comun",
              text: "Atârnă un mesaj sau un cadou digital mic pe un brad pe care-l puteți redeschide în ianuarie.",
            },
            {
              title: "Portret de animal dacă ai fost babysitter de urgență",
              text: "Dacă știi numele câinelui și cartierul veterinarului, ești deja familie. Pune animalul într-o scenă de Crăciun.",
            },
            {
              title: "O listă pe care o pot ține privată",
              text: "Util când tot grupul vrea să se coordoneze fără un sondaj de 40 de mesaje.",
            },
          ],
        },
        {
          heading: "Când prietenia a fost inegală anul ăsta",
          body: "Dacă tu ai dispărut, o felicitare lungă de scuze e mai bună decât un cadou zgomotos. Dacă ei au dispărut, un bilet scurt și cald, fără cerere de răspuns, ajunge. Nu folosi limbaj de „Moșul te vede” cu copiii nimănui dacă un părinte n-a cerut. Nu pune relația nouă a unui prieten pe o listă publică.",
        },
        {
          heading: "Fă-l dintr-o ședere",
          body: "Gift Finder cu prieten selectat, sau sari la mesaje dacă știi că scrii. Există și pagina pentru colegi dacă e un prieten de la birou — ține tonul un pic mai atent acolo. Fără checkout pe ghidul ăsta.",
        },
      ],
      relatedPages: [
        { label: "Mesaje amuzante de Crăciun", url: "/christmas/funny-christmas-messages" },
        { label: "Cadouri pentru colegi", url: giftsPath("coworkers") },
        { label: "Cadouri pentru partener", url: giftsPath("partner") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "kids",
    canonicalPath: giftsPath("kids"),
    ctaHref: "/christmas/gift-finder?recipient=child",
    recipientKey: "child",
    en: {
      title: "Christmas Gift Ideas for Kids",
      metaTitle: "Christmas Gift Ideas for Kids (2026) | TheDigitalGifter",
      metaDescription:
        "Kid-safe Christmas gift ideas: a Santa video that says their name, a family portrait, a wishlist parents control, and no creepy “Santa is watching” copy.",
      h1: "Christmas gift ideas for kids that stay kind",
      intro:
        "Gifts for kids fail when they either dump more plastic into the house or turn Santa into a surveillance threat. TheDigitalGifter lane is the opposite: a Santa video a parent requested, a family portrait from a real photo, a wishlist the adult owns, and cards that sound like love instead of a warning. Kids Christmas generation products stay privacy-first and unfinished on purpose until those controls are ready. This page is a parent-facing guide, not a kids’ funnel and not a way to upload a child’s photo into an open generator.",
      imageAlt: "Soft Christmas scene for a parent-facing kids gift guide",
      ctaText: "Find a family gift",
      benefits: [
        {
          title: "Parent-owned, not child-account",
          text: "Wishlists, Santa, and portraits are started by an adult. There is no kids’ login and no public gallery of children.",
        },
        {
          title: "Santa without threats",
          text: "Scripts stay warm. We do not tell a child that Santa is watching them or that gifts depend on being quiet.",
        },
        {
          title: "Something they can rewatch",
          text: "A named Santa video and a family portrait last longer than another toy that dies on the 26th.",
        },
      ],
      faq: [
        {
          question: "Can I generate a kids Christmas portrait here?",
          answer:
            "Not as an open kids product. /christmas/kids remains coming-soon until privacy controls are ready. Use a family portrait started by a parent, or a Santa video the parent fills in. Do not upload a child’s photo into a tool that was not built for kids.",
        },
        {
          question: "Is Santa video appropriate for young children?",
          answer:
            "When a parent or guardian starts it and the script stays kind, yes. Keep wishes modest, skip fear, and never ask a child for an address or a secret. The adult stays in the loop for checkout if that product is used later.",
        },
        {
          question: "How do I stop relatives from doubling gifts?",
          answer:
            "Create a wishlist the parent owns, share one link, and let relatives reserve items. The shared view is for coordination, not for putting a child on a public internet profile.",
        },
      ],
      sections: [
        {
          heading: "Gifts a parent can finish this week",
          body: "Stay in adult tools. The child receives the result — a video, a print, a morning at the tree — without needing an account. If you are a relative, ask the parent before you start a Santa video or a wishlist in the child’s name.",
          items: [
            {
              title: "Santa video with their first name",
              text: "A parent-started Santa message they can watch on the TV. No naughty-list threats, no public posting.",
            },
            {
              title: "Family Christmas portrait",
              text: "The kid is in the picture because the family is. Start from a photo a parent already likes.",
            },
            {
              title: "A wishlist the adult edits",
              text: "Grandparents stop guessing. Reservations keep surprises intact. The child does not manage tokens.",
            },
            {
              title: "A card from a sibling or cousin",
              text: "Short Christmas wishes work when a child is learning to write. An adult can type; the kid can sign.",
            },
            {
              title: "A shared family tree",
              text: "Hang messages and small digital gifts on a tree relatives can visit with a link, not a public search listing.",
            },
          ],
        },
        {
          heading: "Safety rules we will not break for SEO",
          body: "No “Santa is watching” copy. No asking children for photos in a comment box. No indexable pages that claim a live kids generator. If a product needs extra privacy work, it stays shelled. This cluster page exists to route adults to finished, safer surfaces.",
        },
        {
          heading: "Start in Gift Finder as a parent",
          body: "The finder recipient maps “kids” to the child key. You will still land on adult tools. Pair this guide with family Christmas messages if the gift is words around the table, not a file.",
        },
      ],
      relatedPages: [
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
        { label: "Gifts for mom", url: giftsPath("mom") },
        { label: "Gifts for dad", url: giftsPath("dad") },
        { label: "Gifts for grandparents", url: giftsPath("grandparents") },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru copii",
      metaTitle: "Cadouri de Crăciun pentru copii (2026) | TheDigitalGifter",
      metaDescription:
        "Idei de cadouri de Crăciun sigure pentru copii: video de la Moș cu numele lor, portret de familie, listă controlată de părinte, fără „Moșul te vede”.",
      h1: "Cadouri de Crăciun pentru copii, rămase blânde",
      intro:
        "Cadourile pentru copii eșuează când fie umplu casa de plastic, fie transformă Moșul într-o amenințare de supraveghere. Direcția TheDigitalGifter e inversul: un video de la Moș cerut de un părinte, un portret de familie dintr-o poză reală, o listă deținută de adult și felicitări care sună a iubire, nu a avertisment. Produsele de generare „kids” rămân privacy-first și nefinalizate până sunt gata controalele. Pagina e un ghid pentru părinți, nu un funnel pentru copii și nu o cale de a urca poza unui copil într-un generator deschis.",
      imageAlt: "Scenă blândă de Crăciun pentru un ghid de cadouri pentru copii, văzut de părinte",
      ctaText: "Găsește un cadou de familie",
      benefits: [
        {
          title: "Cont de adult, nu de copil",
          text: "Listele, Moșul și portretele sunt pornite de un adult. Nu există login pentru copii și nicio galerie publică cu copii.",
        },
        {
          title: "Moș fără amenințări",
          text: "Textele rămân calde. Nu spunem unui copil că Moșul îl privește sau că darurile depind de cât de tăcut e.",
        },
        {
          title: "Ceva ce pot revedea",
          text: "Un video de la Moș cu numele lor și un portret de familie țin mai mult decât o jucărie care moare pe 26.",
        },
      ],
      faq: [
        {
          question: "Pot genera aici un portret de Crăciun pentru copii?",
          answer:
            "Nu ca produs deschis pentru copii. /christmas/kids rămâne coming-soon până sunt gata controalele de intimitate. Folosește un portret de familie pornit de un părinte sau un video de la Moș completat de adult. Nu urca poza unui copil într-o unealtă care n-a fost făcută pentru copii.",
        },
        {
          question: "E potrivit video-ul de la Moș pentru copii mici?",
          answer:
            "Când îl pornește un părinte sau tutore și textul rămâne blând, da. Ține dorințele modeste, evită frica și nu cere unui copil adresă sau secrete. Adultul rămâne în buclă dacă mai târziu se folosește un checkout pe acel produs.",
        },
        {
          question: "Cum opresc rudele să dubleze cadourile?",
          answer:
            "Creează o listă deținută de părinte, trimite un singur link și lasă rudele să rezerve. Vederea partajată e pentru coordonare, nu pentru a pune un copil pe un profil public de internet.",
        },
      ],
      sections: [
        {
          heading: "Cadouri pe care un părinte le poate termina saptămâna asta",
          body: "Rămâi în uneltele de adult. Copilul primește rezultatul — un video, un print, o dimineață la brad — fără să aibă nevoie de cont. Dacă ești rudă, întreabă părintele înainte să pornești un video de la Moș sau o listă pe numele copilului.",
          items: [
            {
              title: "Video de la Moș cu prenumele lor",
              text: "Un mesaj pornit de părinte, pe care-l pot vedea la televizor. Fără lista obraznicilor ca amenințare, fără postare publică.",
            },
            {
              title: "Portret de familie de Crăciun",
              text: "Copilul e în poză pentru că familia e în poză. Pornește de la o fotografie pe care părintele o place deja.",
            },
            {
              title: "O listă pe care o editează adultul",
              text: "Bunicii nu mai ghicesc. Rezervările păstrează surpriza. Copilul nu gestionează tokeni.",
            },
            {
              title: "O felicitare de la un frate sau văr",
              text: "Urările scurte merg când un copil învață să scrie. Adultul poate tasta; copilul semnează.",
            },
            {
              title: "Un brad de familie partajat",
              text: "Atârnă mesaje și cadouri digitale mici pe un brad pe care rudele îl vizitează cu link, nu dintr-o listă publică de căutare.",
            },
          ],
        },
        {
          heading: "Reguli de siguranță pe care nu le încălcăm pentru SEO",
          body: "Fără texte de tip „Moșul te vede”. Fără să cerem poze de copii într-o casetă de comentarii. Fără pagini indexabile care pretind un generator live pentru copii. Dacă un produs mai are nevoie de intimitate, rămâne în shell. Pagina de cluster duce adulții către suprafețe gata și mai sigure.",
        },
        {
          heading: "Pornește Gift Finder ca părinte",
          body: "Finder-ul mapează „kids” pe cheia de copil. Tot ajungi în unelte de adult. Leagă ghidul ăsta de mesajele de familie dacă darul sunt cuvintele de la masă, nu un fișier.",
        },
      ],
      relatedPages: [
        { label: "Mesaje de Crăciun pentru familie", url: "/christmas/christmas-messages-for-family" },
        { label: "Cadouri pentru mama", url: giftsPath("mom") },
        { label: "Cadouri pentru tata", url: giftsPath("dad") },
        { label: "Cadouri pentru bunici", url: giftsPath("grandparents") },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "coworkers",
    canonicalPath: giftsPath("coworkers"),
    ctaHref: "/christmas/gift-finder?recipient=coworker",
    recipientKey: "coworker",
    en: {
      title: "Christmas Gift Ideas for Coworkers",
      metaTitle: "Christmas Gifts for Coworkers (2026) | TheDigitalGifter",
      metaDescription:
        "Office-safe Christmas gifts for coworkers: professional messages, customer-safe cards, no awkward romance, and a Gift Finder that stays at work tone.",
      h1: "Christmas gift ideas for coworkers that keep their job",
      intro:
        "Office Christmas gifts fail when they get too intimate, too cheap-looking, or too loud about money. You want something a person can open at a desk without the whole Slack channel leaning in. A short professional message, a clean card, or a small digital keepsake from a team photo is enough. This page stays on the work side of the line: no romantic copy, no alcohol jokes, no “you’re like family” unless you actually are. If you manage people, read the customer and professional message guides before you hit send.",
      imageAlt: "Quiet desk-safe Christmas card scene for coworker gifts",
      ctaText: "Find a coworker gift",
      benefits: [
        {
          title: "Desk-safe by default",
          text: "Professional Christmas messages are written to be read in an open office, not a group chat with friends.",
        },
        {
          title: "Same quality for the whole team",
          text: "Generate once, adjust names, keep the tone even so nobody gets the joke version and somebody else gets a paragraph.",
        },
        {
          title: "No invented shop prices",
          text: "This guide does not push last-minute merch. It routes you to cards and messages you can finish today.",
        },
      ],
      faq: [
        {
          question: "What is safe if I am their manager?",
          answer:
            "Keep it short, even, and free of comments on bodies, relationships, religion, or performance. A professional card for everyone on the team beats a “fun” gift for your favorite person. Do not require anyone to appear in a portrait.",
        },
        {
          question: "We have clients in the same thread. Can I reuse this?",
          answer:
            "Use the customer message page for anyone outside the company. Coworker copy can be warmer; customer copy should stay grateful and brief.",
        },
        {
          question: "Is a digital card cheap in a corporate Secret Santa?",
          answer:
            "Not if the words are specific and the card is printed or sent as a clean file. Pair it with a small physical item if your culture expects one. Do not pretend a digital card is a €200 voucher.",
        },
      ],
      sections: [
        {
          heading: "What works at a desk",
          body: "Think of the open-plan test: if they opened this next to a director, would anyone flinch? If yes, rewrite. Humor is allowed when it is about the year (the migration, the launch), not about the person.",
          items: [
            {
              title: "Professional Christmas card",
              text: "One paragraph, their name, one project you can name without leaking. Print or send as PNG.",
            },
            {
              title: "Team portrait from a real offsite photo",
              text: "Only with consent. A Christmas scene of the people who shipped Q4 is better than a stock snowman.",
            },
            {
              title: "Short wishes for a large distribution list",
              text: "When you are writing to thirty people, short Christmas wishes keep you from pasting the same essay.",
            },
            {
              title: "A shared tree for a remote team",
              text: "Optional and opt-in. Nobody should have to hang a public note to look festive.",
            },
            {
              title: "Customer-safe variant for mixed lists",
              text: "If the same email goes to vendors, switch to the customer guide instead of coworker jokes.",
            },
          ],
        },
        {
          heading: "Lines you should not cross",
          body: "No romance, no comments on who got promoted, no religious pressure, no photos of children unless a parent on the team asked. Do not put salaries, targets, or client secrets in a “fun” card. If your workplace is not celebrating Christmas, offer a winter note or skip the seasonal frame.",
        },
        {
          heading: "Finish without a checkout surprise",
          body: "Cards and messages are free acquisition tools. Gift Finder can start with coworker selected. This cluster page does not open Apple Pay or a Christmas SKU. If someone later wants a paid portrait, they do that on the portrait funnel, not here.",
        },
      ],
      relatedPages: [
        { label: "Professional Christmas messages", url: "/christmas/professional-christmas-messages" },
        { label: "Messages for coworkers", url: messagesPath("coworkers") },
        { label: "Messages for customers", url: messagesPath("customers") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru colegi",
      metaTitle: "Cadouri de Crăciun pentru colegi (2026) | TheDigitalGifter",
      metaDescription:
        "Cadouri de Crăciun sigure la birou: mesaje profesionale, felicitări pentru clienți, fără romantism stânjenitor și Gift Finder pe ton de serviciu.",
      h1: "Cadouri de Crăciun pentru colegi, care nu le pun jobul în pericol",
      intro:
        "Cadourile de birou eșuează când sunt prea intime, prea ieftine la privire sau prea zgomotoase despre bani. Vrei ceva ce un om poate deschide la birou fără să se aplece tot canalul de Slack. Un mesaj profesional scurt, o felicitare curată sau o amintire digitală dintr-o poză de echipă ajung. Pagina stă pe partea de muncă a liniei: fără copy romantic, fără glume cu alcool, fără „sunteți ca o familie” dacă nu sunteți. Dacă ai oameni în subordine, citește ghidurile de clienți și mesaje profesionale înainte să trimiți.",
      imageAlt: "Felicitare de Crăciun discreta, gândită pentru birou",
      ctaText: "Găsește un cadou pentru colegi",
      benefits: [
        {
          title: "Sigur la birou din start",
          text: "Mesajele profesionale sunt scrise să fie citite într-un open space, nu într-un grup de prieteni.",
        },
        {
          title: "Aceeași calitate pentru toată echipa",
          text: "Generează o dată, ajustează numele, ține tonul egal ca nimeni să nu primească varianta-glumă și altcineva un eseu.",
        },
        {
          title: "Fără prețuri inventate de magazin",
          text: "Ghidul nu împinge marfă de ultim moment. Te duce la felicitări și mesaje pe care le termini azi.",
        },
      ],
      faq: [
        {
          question: "Ce e sigur dacă sunt managerul lor?",
          answer:
            "Ține-l scurt, egal și fără comentarii despre corp, relații, religie sau performanță. O felicitare profesională pentru toată echipa bate un cadou „haios” pentru favorit. Nu obliga pe nimeni să apară într-un portret.",
        },
        {
          question: "Avem clienți pe același thread. Pot refolosi textul?",
          answer:
            "Folosește pagina de mesaje pentru clienți pentru oricine e în afara firmei. Copy-ul de coleg poate fi mai cald; cel de client rămâne recunoscător și scurt.",
        },
        {
          question: "O felicitare digitală e ieftină la un Secret Santa corporatist?",
          answer:
            "Nu, dacă vorbele sunt precise și felicitarea e printată sau trimisă ca fișier curat. Poți să o legi de un obiect mic dacă cultura voastră cere asta. Nu pretinde că o felicitare digitală e un voucher de 200 de euro.",
        },
      ],
      sections: [
        {
          heading: "Ce funcționează la birou",
          body: "Testul open-space: dacă ar deschide asta lângă un director, s-ar strâmba cineva? Dacă da, rescrie. Umorul e permis când e despre an (migrarea, lansarea), nu despre persoană.",
          items: [
            {
              title: "Felicitare profesională de Crăciun",
              text: "Un paragraf, numele lor, un proiect pe care-l poți numi fără să scapi informații. Print sau PNG.",
            },
            {
              title: "Portret de echipă dintr-o poză reală de offsite",
              text: "Doar cu acord. O scenă de Crăciun cu oamenii care au dus Q4 e mai bună decât un om de zăpadă de stoc.",
            },
            {
              title: "Urări scurte pentru o listă mare",
              text: "Când scrii către treizeci de oameni, urările scurte te opresc să lipești același eseu.",
            },
            {
              title: "Un brad comun pentru o echipă remote",
              text: "Opțional și cu acord. Nimeni n-ar trebui să atârne un bilet public ca să pară festiv.",
            },
            {
              title: "Variantă pentru clienți pe liste amestecate",
              text: "Dacă același email pleacă și către furnizori, treci pe ghidul de clienți, nu pe glume de colegi.",
            },
          ],
        },
        {
          heading: "Linii pe care nu le treci",
          body: "Fără romantism, fără comentarii despre cine a fost promovat, fără presiune religioasă, fără poze cu copii dacă un părinte din echipă n-a cerut. Nu pune salarii, targete sau secrete de client într-o felicitare „haiosă”. Dacă locul de muncă nu serbează Crăciunul, oferă un bilet de iarnă sau sari peste cadrul de sezon.",
        },
        {
          heading: "Termină fără surprize de plată",
          body: "Felicitările și mesajele sunt unelte gratuite de acquisition. Gift Finder poate porni cu coleg selectat. Pagina de cluster nu deschide Apple Pay și nici un SKU de Crăciun. Dacă cineva vrea mai târziu un portret plătit, o face pe funnel-ul de portret, nu aici.",
        },
      ],
      relatedPages: [
        { label: "Mesaje profesionale de Crăciun", url: "/christmas/professional-christmas-messages" },
        { label: "Mesaje pentru colegi", url: messagesPath("coworkers") },
        { label: "Mesaje pentru clienți", url: messagesPath("customers") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "gifts-for",
    pageType: "christmas-gifts-for",
    slug: "grandparents",
    canonicalPath: giftsPath("grandparents"),
    ctaHref: "/christmas/gift-finder?recipient=grandparent",
    recipientKey: "grandparent",
    en: {
      title: "Christmas Gift Ideas for Grandparents",
      metaTitle: "Christmas Gifts for Grandparents (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas gifts for grandma and grandpa: family portraits they can print, Santa videos for the grandchildren, cards in their language, and a finder that starts with them.",
      h1: "Christmas gift ideas for grandparents",
      intro:
        "Grandparents keep paper. They keep the photo that made it onto the fridge and the card they can reread in January. They do not need another gadget they did not ask for. The strongest gifts this year are a family portrait they can hold, a Santa video starring the grandchild they brag about, and a message in the language they actually speak at the table — including Romanian with real diacritics. This page covers grandma, grandpa, and the pair of them together, without turning either of them into a joke about age.",
      imageAlt: "Printed Christmas portrait mood for a grandparents gift guide",
      ctaText: "Find a gift for grandparents",
      benefits: [
        {
          title: "Made to print",
          text: "Portraits and cards are designed so someone can put them on a table, not only a phone they pinch-zoom.",
        },
        {
          title: "The grandchild is the star",
          text: "Santa video and family scenes give them a story to show neighbors without making them perform on camera.",
        },
        {
          title: "Their language, not the default",
          text: "Write in Romanian or English the way they talk. A translated slogan is how cards get left in the envelope.",
        },
      ],
      faq: [
        {
          question: "They do not use apps. Is a digital gift pointless?",
          answer:
            "Only if you leave it on your phone. Print the portrait. Play the Santa video on the TV. Read the card out loud. The file is the master; the ritual is the gift.",
        },
        {
          question: "Can I make one gift for both grandparents?",
          answer:
            "Yes. A family portrait or a card addressed to both names works. If they live apart or one of them is gone, write to the person who is here and do not force a cheerful dual greeting.",
        },
        {
          question: "What if I am far away this year?",
          answer:
            "Send the file and schedule a call when they open it. A wishlist link is for relatives coordinating around them, not something you should expect a grandparent to administer.",
        },
      ],
      sections: [
        {
          heading: "Gifts that earn fridge space",
          body: "If it cannot sit next to a magnet, have a plan for how they will see it. TV, printed card, or a neighbor’s help opening a link are all valid. Avoid gifts that need a new password.",
          items: [
            {
              title: "Family Christmas portrait",
              text: "The whole table in one Christmas scene. Print two copies if both houses want one.",
            },
            {
              title: "Santa video the grandchild can star in",
              text: "Grandparents will tolerate any technology if the child’s name is in the first ten seconds.",
            },
            {
              title: "A card in their language",
              text: "Family Christmas messages plus your one memory from this summer. Large type if you print it.",
            },
            {
              title: "Couples portrait of the two of them",
              text: "If you have a photo from a wedding anniversary or a quiet Sunday, that is the one to transform.",
            },
            {
              title: "Messages separately for grandma and grandpa",
              text: "Sometimes the right gift is two cards, because their years were not identical.",
            },
          ],
        },
        {
          heading: "Respect over nostalgia cosplay",
          body: "Do not write as if they are already gone. Do not joke about forgetting names or “being old.” If faith matters at their table, the religious tone exists in the message tool — use it only if it is theirs, not yours performed at them.",
        },
        {
          heading: "Start the finder on grandparent",
          body: "Gift Finder maps to the grandparent key. From there you can move to portraits, Santa, or cards. This page does not charge for a guide. Related message pages for mom and dad help if you are also writing “from the kids.”",
        },
      ],
      relatedPages: [
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
        { label: "Gifts for mom", url: giftsPath("mom") },
        { label: "Gifts for dad", url: giftsPath("dad") },
        { label: "Gifts for kids", url: giftsPath("kids") },
      ],
    },
    ro: {
      title: "Idei de cadouri de Crăciun pentru bunici",
      metaTitle: "Cadouri de Crăciun pentru bunici (2026) | TheDigitalGifter",
      metaDescription:
        "Cadouri de Crăciun pentru bunica și bunica: portrete de familie de printat, video de la Moș cu nepoții, felicitări în limba lor și un finder pornit pe ei.",
      h1: "Cadouri de Crăciun pentru bunici",
      intro:
        "Bunicii păstrează hârtia. Păstrează poza care a ajuns pe frigider și felicitarea pe care o recitesc în ianuarie. N-au nevoie de încă un gadget pe care nu l-au cerut. Cele mai tari cadouri anul ăsta sunt un portret de familie pe care-l pot ține în mână, un video de la Moș cu nepotul de care se laudă și un mesaj în limba pe care o vorbesc la masă — inclusiv română cu diacritice adevărate. Pagina acoperă bunica, bunica și pe amândoi, fără să-i transforme într-o glumă despre vârstă.",
      imageAlt: "Portret de Crăciun tipărit, gândit pentru un ghid de cadouri pentru bunici",
      ctaText: "Găsește un cadou pentru bunici",
      benefits: [
        {
          title: "Gândite să se printeze",
          text: "Portretele și felicitările sunt făcute să stea pe o masă, nu doar pe un telefon ciupit cu degetele.",
        },
        {
          title: "Nepotul e vedeta",
          text: "Video-ul de la Moș și scenele de familie le dau o poveste de arătat vecinilor fără să-i pună pe ei în fața camerei.",
        },
        {
          title: "Limba lor, nu cea implicită",
          text: "Scrie română sau engleză cum vorbesc ei. Un slogan tradus e motivul pentru care felicitările rămân în plic.",
        },
      ],
      faq: [
        {
          question: "Nu folosesc aplicații. Un cadou digital n-are rost?",
          answer:
            "Doar dacă-l lași pe telefonul tău. Printează portretul. Pune video-ul de la Moș pe televizor. Citește felicitarea cu voce tare. Fișierul e masterul; ritualul e cadoul.",
        },
        {
          question: "Pot face un singur cadou pentru amândoi?",
          answer:
            "Da. Un portret de familie sau o felicitare cu ambele nume merge. Dacă stau separat sau unul dintre ei nu mai e, scrie către omul care e aici și nu forța o urare veselă la dublu.",
        },
        {
          question: "Dacă anul ăsta sunt departe?",
          answer:
            "Trimite fișierul și programează un apel când îl deschid. Un link de listă e pentru rudele care se coordonează în jurul lor, nu ceva ce te aștepți să administreze un bunic.",
        },
      ],
      sections: [
        {
          heading: "Cadouri care merită loc pe frigider",
          body: "Dacă nu poate sta lângă un magnet, ai un plan despre cum îl văd. Televizor, felicitare printată sau un vecin care deschide un link sunt toate valide. Evită cadourile care cer o parolă nouă.",
          items: [
            {
              title: "Portret de familie de Crăciun",
              text: "Toată masa într-o scenă de sărbători. Printează două copii dacă ambele case vor una.",
            },
            {
              title: "Video de la Moș cu nepotul în rol principal",
              text: "Bunicii acceptă orice tehnologie dacă numele copilului e în primele zece secunde.",
            },
            {
              title: "O felicitare în limba lor",
              text: "Mesaje de familie plus o amintire de-a ta din vara asta. Litere mari dacă printezi.",
            },
            {
              title: "Portret de cuplu cu ei doi",
              text: "Dacă ai o poză de la o aniversare sau o duminică liniștită, pe aia o transformi.",
            },
            {
              title: "Mesaje separate pentru bunica și pentru bunica",
              text: "Uneori cadoul potrivit sunt două felicitări, pentru că anii lor n-au fost identici.",
            },
          ],
        },
        {
          heading: "Respect, nu teatru de nostalgie",
          body: "Nu scrie ca și cum ar fi deja plecați. Nu glumi despre uitarea numelor sau „că sunt bătrâni”. Dacă credința contează la masa lor, tonul religios există în unealta de mesaje — folosește-l doar dacă e al lor, nu al tău jucat pe seama lor.",
        },
        {
          heading: "Pornește finder-ul pe bunic",
          body: "Gift Finder mapează pe cheia de grandparent. De acolo poți trece la portrete, Moș sau felicitări. Pagina nu taxează un ghid. Paginile de mesaje pentru mama și tata ajută dacă scrii și „de la copii”.",
        },
      ],
      relatedPages: [
        { label: "Mesaje de Crăciun pentru familie", url: "/christmas/christmas-messages-for-family" },
        { label: "Cadouri pentru mama", url: giftsPath("mom") },
        { label: "Cadouri pentru tata", url: giftsPath("dad") },
        { label: "Cadouri pentru copii", url: giftsPath("kids") },
      ],
    },
  },
];

export const CLUSTER_SPECS: ChristmasSeoSpec[] = [
  ...GIFT_CLUSTER_SPECS,
  ...MESSAGE_CLUSTER_SPECS,
  ...INTENT_CLUSTER_SPECS,
];


