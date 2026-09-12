import type { ChristmasSeoSpec } from "./types";

function giftsPath(slug: string): string {
  return `/christmas/gifts-for-${slug}`;
}

function messagesPath(slug: string): string {
  return `/christmas/messages-for-${slug}`;
}

export const INTENT_CLUSTER_SPECS: ChristmasSeoSpec[] = [
  {
    cluster: "messages-intent",
    pageType: "christmas-messages-intent",
    slug: "funny-christmas-messages",
    canonicalPath: "/christmas/funny-christmas-messages",
    ctaHref: "/christmas/messages?tone=funny",
    en: {
      title: "Funny Christmas Messages",
      metaTitle: "Funny Christmas Messages (2026) | TheDigitalGifter",
      metaDescription:
        "Funny Christmas messages that still land: for dad, friends, and partners, with a last sincere line and a generator that starts on the funny tone.",
      h1: "Funny Christmas messages that still mean it",
      intro:
        "Funny Christmas messages fail when they only roast. The ones people keep have a last line that tells the truth. Tease the wrapping, the remote, the burnt rolls — then say you are glad they are at the table. This page is a lane, not a roast book. It sits next to recipient pages so you can aim the joke at dad, a friend, or a partner without using coworker or customer humor by mistake. Generate three options on the funny tone, keep the one you would actually say, and put it on a card before the group chat ruins the timing.",
      imageAlt: "Playful Christmas card with space for a funny holiday note",
      ctaText: "Write a funny Christmas message",
      benefits: [
        {
          title: "A joke with a landing",
          text: "The funny tone is built to end kind. If a draft only punches down, throw it away.",
        },
        {
          title: "Aimed at a person",
          text: "Jump from this intent page to dad, friend, or partner so the joke has a face.",
        },
        {
          title: "Safe to print",
          text: "If you would not read it in front of grandma, it is not the card draft. Keep that one in the thread.",
        },
      ],
      faq: [
        {
          question: "When is funny the wrong tone?",
          answer:
            "Grief, a fight you have not repaired, a workplace list, or anyone’s kids you do not parent. Switch to heartfelt or professional.",
        },
        {
          question: "Can funny still be romantic?",
          answer:
            "Yes, if the last line is affectionate. Do not use the card to list their flaws as entertainment for the table.",
        },
        {
          question: "How short should a funny wish be?",
          answer:
            "Two beats: setup and landing. A third paragraph is a standup set, not a Christmas card.",
        },
      ],
      sections: [
        {
          heading: "Drafts with a last honest sentence",
          body: "Steal the rhythm, not the facts. Put their actual disaster from this year in the first line.",
          items: [
            {
              title: "For dad",
              text: "Merry Christmas to the only man who can hear a drip two rooms away. The house still stands. So do we. Love you.",
            },
            {
              title: "For a friend",
              text: "Another year of bad plans and good company. Please never become responsible. Merry Christmas.",
            },
            {
              title: "For a partner",
              text: "Thank you for pretending my wrapping is a craft. I love you more than I love being right about the heat.",
            },
            {
              title: "For the group chat",
              text: "May your leftovers outlive your opinions. See you at the table. If not, see you in the thread.",
            },
            {
              title: "Self-roast",
              text: "I bought this card at the last minute and still meant every word. Merry Christmas. I will do better in March.",
            },
          ],
        },
        {
          heading: "Jokes we will not generate",
          body: "No body comments, no “Santa is watching” threats to children, no workplace humiliation, no punching at poverty or illness. The message engine already rejects harassment patterns. If you have to ask whether it is mean, it is mean.",
        },
        {
          heading: "Generate on funny, then pick a face",
          body: "Open /christmas/messages?tone=funny. Related pages for dad, friend, and short wishes keep you from using one joke everywhere. Cards can take the keeper in one click.",
        },
      ],
      relatedPages: [
        { label: "Messages for dad", url: messagesPath("dad") },
        { label: "Gifts for a friend", url: giftsPath("friend") },
        { label: "Messages for your boyfriend", url: messagesPath("boyfriend") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Mesaje amuzante de Crăciun",
      metaTitle: "Mesaje amuzante de Crăciun (2026) | TheDigitalGifter",
      metaDescription:
        "Mesaje amuzante de Crăciun care tot ajung la masă: pentru tata, prieteni și partener, cu un ultim rând sincer și un generator pornit pe tonul amuzant.",
      h1: "Mesaje amuzante de Crăciun care tot înseamnă ceva",
      intro:
        "Mesajele amuzante de Crăciun eșuează când doar ciomăgesc. Cele pe care oamenii le păstrează au un ultim rând care spune adevărul. Tachinează împachetatul, telecomanda, chiflele arse — apoi spune că te bucuri că sunt la masă. Pagina e o bandă, nu o carte de roast. Stă lângă paginile de destinatar ca să îndrepți gluma către tata, un prieten sau un partener, fără să folosești din greșeală umor de coleg sau de client. Generează trei variante pe ton amuzant, păstreaz-o pe cea pe care ai zice-o și pune-o pe felicitare înainte ca grupul să strice timing-ul.",
      imageAlt: "Felicitare jucăușă de Crăciun cu loc pentru un bilet amuzant",
      ctaText: "Scrie un mesaj amuzant de Crăciun",
      benefits: [
        {
          title: "O glumă cu aterizare",
          text: "Tonul amuzant e gândit să se încheie frumos. Dacă o ciornă doar lovește în jos, arunc-o.",
        },
        {
          title: "Îndreptată către un om",
          text: "Sari de pe intent către tata, prieten sau partener ca gluma să aibă o față.",
        },
        {
          title: "Sigură de printat",
          text: "Dacă n-ai citi-o în fața bunicii, nu e ciorna de felicitare. Pe aia ține-o în thread.",
        },
      ],
      faq: [
        {
          question: "Când e amuzantul tonul greșit?",
          answer:
            "Doliu, o ceartă nereparată, o listă de la muncă sau copiii cuiva pe care nu-i crești tu. Treci pe din suflet sau profesional.",
        },
        {
          question: "Poate fi amuzant și romantic?",
          answer:
            "Da, dacă ultimul rând e afectuos. Nu folosi felicitarea ca să le înșiri defectele pe post de divertisment pentru masă.",
        },
        {
          question: "Cât de scurtă să fie o urare amuzantă?",
          answer:
            "Două timpi: setup și aterizare. Un al treilea paragraf e un set de standup, nu o felicitare de Crăciun.",
        },
      ],
      sections: [
        {
          heading: "Ciorne cu o ultimă propoziție cinstită",
          body: "Fură ritmul, nu faptele. Pune dezastrul lor real din anul ăsta pe primul rând.",
          items: [
            {
              title: "Pentru tata",
              text: "Crăciun fericit singurului om care aude un picur din două camere. Casa tot stă. Și noi. Te iubim.",
            },
            {
              title: "Pentru un prieten",
              text: "Încă un an de planuri proaste și companie bună. Te rog să nu devii responsabil. Crăciun fericit.",
            },
            {
              title: "Pentru un partener",
              text: "Mulțumesc că te prefaci că împachetatul e o meserie. Te iubesc mai mult decât iubesc să am dreptate la căldură.",
            },
            {
              title: "Pentru grup",
              text: "Rămășițele să vă supraviețuiască opiniile. Ne vedem la masă. Dacă nu, ne vedem în thread.",
            },
            {
              title: "Auto-roast",
              text: "Am luat felicitarea în ultima clipă și tot am vrut fiecare cuvânt. Crăciun fericit. O să fac mai bine în martie.",
            },
          ],
        },
        {
          heading: "Glume pe care nu le generăm",
          body: "Fără comentarii despre corp, fără amenințări de tip „Moșul te vede” către copii, fără umilire la birou, fără lovituri la sărăcie sau boală. Motorul de mesaje respinge deja tipare de hărțuire. Dacă trebuie să întrebi dacă e răutăcios, e răutăcios.",
        },
        {
          heading: "Generează pe amuzant, apoi alege o față",
          body: "Deschide /christmas/messages?tone=funny. Paginile pentru tata, prieten și urări scurte te opresc să folosești o singură glumă peste tot. Felicitările iau varianta păstrată dintr-un click.",
        },
      ],
      relatedPages: [
        { label: "Mesaje pentru tata", url: messagesPath("dad") },
        { label: "Cadouri pentru un prieten", url: giftsPath("friend") },
        { label: "Mesaje pentru iubit", url: messagesPath("boyfriend") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "messages-intent",
    pageType: "christmas-messages-intent",
    slug: "romantic-christmas-messages",
    canonicalPath: "/christmas/romantic-christmas-messages",
    ctaHref: "/christmas/messages?tone=romantic",
    en: {
      title: "Romantic Christmas Messages",
      metaTitle: "Romantic Christmas Messages (2026) | TheDigitalGifter",
      metaDescription:
        "Romantic Christmas messages that stay specific: for a girlfriend, boyfriend, or partner, with drafts you can put on a card and a generator on romantic tone.",
      h1: "Romantic Christmas messages that sound like a real year",
      intro:
        "Romantic Christmas messages collapse when they sound like they were written for any couple in any city. The line that works names a kitchen, a delay, a joke you are not allowed to tell in public. This intent page is the cluster hub for that tone. It points to boyfriend and girlfriend recipient pages and to partner gifts when the words are only half the present. Generate on romantic, cut the clichés, and print the card. Do not debut a life plan she or he has not heard. Do not paste the note into a family group chat.",
      imageAlt: "Candlelit Christmas card for a romantic holiday message",
      ctaText: "Write a romantic Christmas message",
      benefits: [
        {
          title: "Accuracy over poetry",
          text: "A true Tuesday beats a borrowed metaphor about snow and forever.",
        },
        {
          title: "Recipient pages next door",
          text: "Boyfriend and girlfriend copy is more aimed if you already know the direction.",
        },
        {
          title: "Private by design",
          text: "Card handoff keeps the body out of the URL. The table does not need the unedited draft.",
        },
      ],
      faq: [
        {
          question: "How early in a relationship is romantic OK?",
          answer:
            "Warm and short is enough in the first months. Save forever language for a conversation you have already had.",
        },
        {
          question: "Can I be romantic and funny?",
          answer:
            "Yes — last line affectionate, first line a shared joke. If the joke needs explaining to their parents, keep it off the public card.",
        },
        {
          question: "What if we are long distance?",
          answer:
            "Write as if they will open it on a call. Ask them to call. A file plus silence is how romance turns into admin.",
        },
      ],
      sections: [
        {
          heading: "Drafts that need their details",
          body: "Put the city back in. Put the dog back in. Delete any line you have seen on a mug.",
          items: [
            {
              title: "Quiet year",
              text: "Merry Christmas. My favorite part of us this year was how ordinary Tuesdays started to feel like a plan.",
            },
            {
              title: "Hard year",
              text: "We did not get the easy version. I still choose the person who sat through it with me.",
            },
            {
              title: "Short",
              text: "You make the room quieter in the good way. I am glad it is you.",
            },
            {
              title: "Long-distance",
              text: "I set a plate anyway. Open this on the call. I want to hear the paper.",
            },
            {
              title: "After a fight you repaired",
              text: "Thank you for staying in the room when it would have been easier to leave. Merry Christmas. I am still here.",
            },
          ],
        },
        {
          heading: "What romance is not on this page",
          body: "Not a public proposal you have not discussed. Not a list of improvements. Not a guilt trip about gifts. Not language that traps someone into performing love for relatives.",
        },
        {
          heading: "Generate, then choose a face",
          body: "Tone=romantic in the message generator. Girlfriend, boyfriend, and partner gift pages complete the cluster. Funny sits beside this if humor is how you two tell the truth.",
        },
      ],
      relatedPages: [
        { label: "Messages for your girlfriend", url: messagesPath("girlfriend") },
        { label: "Messages for your boyfriend", url: messagesPath("boyfriend") },
        { label: "Gifts for your partner", url: giftsPath("partner") },
        { label: "Funny Christmas messages", url: "/christmas/funny-christmas-messages" },
      ],
    },
    ro: {
      title: "Mesaje romantice de Crăciun",
      metaTitle: "Mesaje romantice de Crăciun (2026) | TheDigitalGifter",
      metaDescription:
        "Mesaje romantice de Crăciun, ținute precise: pentru iubită, iubit sau partener, cu ciorne de pus pe felicitare și generator pe ton romantic.",
      h1: "Mesaje romantice de Crăciun care sună a un an real",
      intro:
        "Mesajele romantice de Crăciun se prăbușesc când par scrise pentru orice cuplu din orice oraș. Rândul care ține numește o bucătărie, o întârziere, o glumă pe care n-ai voie s-o spui în public. Pagina de intent e hub-ul de cluster pentru tonul ăsta. Trimite către paginile de iubit și iubită și către cadourile de partener când vorbele sunt doar jumătate din dar. Generează pe romantic, taie clișeele, printează felicitarea. Nu lansa un plan de viață pe care el sau ea nu l-a auzit. Nu lipi biletul într-un grup de familie.",
      imageAlt: "Felicitare de Crăciun la lumina lumânării pentru un mesaj romantic",
      ctaText: "Scrie un mesaj romantic de Crăciun",
      benefits: [
        {
          title: "Precizie, nu poezie împrumutată",
          text: "O marți adevărată bate o metaforă despre zăpadă și pentru totdeauna.",
        },
        {
          title: "Paginile de destinatar alături",
          text: "Copy-ul pentru iubit și iubită e mai țintit dacă știi deja direcția.",
        },
        {
          title: "Privat din construcție",
          text: "Handoff-ul către felicitare ține corpul în afara URL-ului. Masa n-are nevoie de ciorna needitată.",
        },
      ],
      faq: [
        {
          question: "Cât de devreme e ok romanticul?",
          answer:
            "Cald și scurt ajunge în primele luni. Limbajul de pentru totdeauna rămâne pentru o conversație pe care ați avut-o deja.",
        },
        {
          question: "Pot fi romantic și amuzant?",
          answer:
            "Da — ultimul rând afectuos, primul o glumă comună. Dacă gluma trebuie explicată părinților, ține-o departe de felicitarea publică.",
        },
        {
          question: "Dacă suntem la distanță?",
          answer:
            "Scrie ca și cum vor deschide pe apel. Cere-le să sune. Un fișier plus tăcere e felul în care romantismul devine admin.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care au nevoie de detaliile lor",
          body: "Pune orașul înapoi. Pune câinele înapoi. Șterge orice rând pe care l-ai văzut pe o cană.",
          items: [
            {
              title: "An liniștit",
              text: "Crăciun fericit. Partea mea preferată din noi, anul ăsta, a fost cum marțile obișnuite au început să pară un plan.",
            },
            {
              title: "An greu",
              text: "N-am primit varianta ușoară. Tot îl aleg pe omul care a stat în ea cu mine.",
            },
            {
              title: "Scurt",
              text: "Faci camera mai liniștită în felul bun. Mă bucur că ești tu.",
            },
            {
              title: "La distanță",
              text: "Am pus totuși o farfurie. Deschide pe apel. Vreau să aud hârtia.",
            },
            {
              title: "După o ceartă reparată",
              text: "Mulțumesc că ai rămas în cameră când era mai ușor să pleci. Crăciun fericit. Încă sunt aici.",
            },
          ],
        },
        {
          heading: "Ce nu e romantism pe pagina asta",
          body: "Nu o cerere în căsătorie publică nediscutată. Nu o listă de îmbunătățiri. Nu un reproș despre cadouri. Nu un limbaj care prinde pe cineva să joace iubirea pentru rude.",
        },
        {
          heading: "Generează, apoi alege o față",
          body: "Tone=romantic în generator. Paginile de iubită, iubit și cadouri de partener închid clusterul. Amuzantul stă alături dacă umorul e felul vostru de a spune adevărul.",
        },
      ],
      relatedPages: [
        { label: "Mesaje pentru iubită", url: messagesPath("girlfriend") },
        { label: "Mesaje pentru iubit", url: messagesPath("boyfriend") },
        { label: "Cadouri pentru partener", url: giftsPath("partner") },
        { label: "Mesaje amuzante de Crăciun", url: "/christmas/funny-christmas-messages" },
      ],
    },
  },
  {
    cluster: "messages-intent",
    pageType: "christmas-messages-intent",
    slug: "professional-christmas-messages",
    canonicalPath: "/christmas/professional-christmas-messages",
    ctaHref: "/christmas/messages?tone=professional",
    en: {
      title: "Professional Christmas Messages",
      metaTitle: "Professional Christmas Messages | TheDigitalGifter",
      metaDescription:
        "Professional Christmas messages for teams and clients: brief, even, no hard sell, with coworker and customer pages and a generator on professional tone.",
      h1: "Professional Christmas messages",
      intro:
        "Professional Christmas messages have one job: thank people without creating an HR ticket or a sales cringe. They are shorter than family notes and cleaner than friend jokes. Use this intent page when the list is a team, a client book, or a mixed BCC. Then step into coworker or customer recipient pages if you need the finer line between “we shipped Q4” and “thank you for the contract.” Generate on professional, keep names even, and do not attach a renewal. Checkout does not live here.",
      imageAlt: "Understated corporate-safe Christmas card for professional notes",
      ctaText: "Write a professional Christmas message",
      benefits: [
        {
          title: "Work tone is native",
          text: "You are not deleting hearts from a mom template. The lane starts clean.",
        },
        {
          title: "Splits coworkers and customers",
          text: "Two recipient pages stop you from sending desk jokes to a client BCC.",
        },
        {
          title: "Scales to a list",
          text: "Short wishes sit next door when thirty names cannot each get a custom essay.",
        },
      ],
      faq: [
        {
          question: "Merry Christmas or Happy Holidays?",
          answer:
            "Match the people. If the list is mixed or unknown, Happy Holidays or a winter note is the safer public line.",
        },
        {
          question: "Can I mention performance?",
          answer:
            "Name a project, not a rating. A Christmas note is not a review cycle and not a PIP in wrapping paper.",
        },
        {
          question: "Is a digital card cheap to clients?",
          answer:
            "Not if it is brief, specific, and free of a coupon. The cheap thing is a newsletter that only exists to sell.",
        },
      ],
      sections: [
        {
          heading: "Drafts you can send from a work address",
          body: "If you would not put it in a ticket, do not put it in a holiday card.",
          items: [
            {
              title: "Team",
              text: "Thank you for the year you put into this work. I hope the break is a break. Happy holidays.",
            },
            {
              title: "Client",
              text: "Thank you for the trust this year. Wishing you rest and a steady January — no asks attached.",
            },
            {
              title: "Vendor",
              text: "The year was easier because you were on the other side of the thread. Enjoy the quiet.",
            },
            {
              title: "Large BCC",
              text: "Grateful for everyone who built with us in 2026. Wishing you kind days and a clean start.",
            },
            {
              title: "Manager note",
              text: "I will not recap the metrics here. I will say thank you, and I mean the time you covered.",
            },
          ],
        },
        {
          heading: "Do not mix this with romance or roast",
          body: "No alcohol dares, no comments on families, no photos of children unless a parent on the team asked. No “you’re like family” to people who report to you. If the note would be awkward next to a director, it belongs in a private 1:1, not a holiday card the whole team can screenshot.",
        },
        {
          heading: "Generate on professional",
          body: "Then open coworker or customer pages for examples aimed at a desk or an invoice. Short wishes help when the list is long. Coworker gifts exist if culture also expects an object.",
        },
      ],
      relatedPages: [
        { label: "Messages for coworkers", url: messagesPath("coworkers") },
        { label: "Messages for customers", url: messagesPath("customers") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
        { label: "Gifts for coworkers", url: giftsPath("coworkers") },
      ],
    },
    ro: {
      title: "Mesaje profesionale de Crăciun",
      metaTitle: "Mesaje profesionale de Crăciun | TheDigitalGifter",
      metaDescription:
        "Mesaje profesionale de Crăciun pentru echipe și clienți: scurte, egale, fără vânzare, cu pagini de colegi și clienți și generator pe ton profesional.",
      h1: "Mesaje profesionale de Crăciun",
      intro:
        "Mesajele profesionale de Crăciun au o singură treabă: să mulțumească fără să creeze un ticket de HR sau o jenă de vânzări. Sunt mai scurte decât biletele de familie și mai curate decât glumele de prieteni. Folosește intent-ul când lista e o echipă, o carte de clienți sau un BCC amestecat. Apoi intră pe paginile de coleg sau client dacă îți trebuie linia fină dintre „am livrat Q4” și „mulțumim pentru contract”. Generează pe profesional, ține numele egale și nu atașa un renewal. Checkout-ul nu trăiește aici.",
      imageAlt: "Felicitare discretă, sigură corporatist, pentru mesaje profesionale",
      ctaText: "Scrie un mesaj profesional de Crăciun",
      benefits: [
        {
          title: "Tonul de muncă e nativ",
          text: "Nu ștergi inimioare de pe un șablon pentru mama. Banda pornește curată.",
        },
        {
          title: "Desparte colegii de clienți",
          text: "Două pagini de destinatar te opresc să trimiți glume de birou într-un BCC de client.",
        },
        {
          title: "Se scalează pe o listă",
          text: "Urările scurte stau alături când treizeci de nume nu pot primi fiecare un eseu.",
        },
      ],
      faq: [
        {
          question: "Crăciun fericit sau Sărbători fericite?",
          answer:
            "Potrivește-te după oameni. Dacă lista e amestecată sau necunoscută, Sărbători fericite sau un bilet de iarnă e linia publică mai sigură.",
        },
        {
          question: "Pot pomeni performanța?",
          answer:
            "Numește un proiect, nu un calificativ. Un bilet de Crăciun nu e ciclu de evaluare și nici PIP în hârtie de cadou.",
        },
        {
          question: "O felicitare digitală e ieftină pentru clienți?",
          answer:
            "Nu, dacă e scurtă, precisă și fără cupon. Ieftin e un newsletter care există doar ca să vândă.",
        },
      ],
      sections: [
        {
          heading: "Ciorne pe care le poți trimite de pe adresa de serviciu",
          body: "Dacă n-ai pune-o într-un ticket, n-o pune pe o felicitare de sărbători.",
          items: [
            {
              title: "Echipă",
              text: "Mulțumesc pentru anul pus în munca asta. Sper ca pauza să fie pauză. Sărbători fericite.",
            },
            {
              title: "Client",
              text: "Mulțumim pentru încrederea din anul ăsta. Odihnă și un ianuarie așezat — fără cereri atașate.",
            },
            {
              title: "Furnizor",
              text: "Anul a fost mai ușor pentru că erați de cealaltă parte a thread-ului. Bucurați-vă de liniște.",
            },
            {
              title: "BCC mare",
              text: "Mulțumim tuturor celor cu care am construit în 2026. Zile blânde și un start curat.",
            },
            {
              title: "Notă de manager",
              text: "Nu recapitulăm metricile aici. Spun mulțumesc și mă refer la timpul pe care l-ați acoperit.",
            },
          ],
        },
        {
          heading: "Nu amesteca cu romantism sau roast",
          body: "Fără provocări cu alcool, fără comentarii despre familii, fără poze cu copii dacă un părinte din echipă n-a cerut. Fără „sunteți ca o familie” către oameni care-ți raportează.",
        },
        {
          heading: "Generează pe profesional",
          body: "Apoi deschide paginile de coleg sau client pentru exemple țintite spre birou sau spre factură. Urările scurte ajută când lista e lungă. Cadourile pentru colegi există dacă cultura cere și un obiect.",
        },
      ],
      relatedPages: [
        { label: "Mesaje pentru colegi", url: messagesPath("coworkers") },
        { label: "Mesaje pentru clienți", url: messagesPath("customers") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
        { label: "Cadouri pentru colegi", url: giftsPath("coworkers") },
      ],
    },
  },
  {
    cluster: "messages-intent",
    pageType: "christmas-messages-intent",
    slug: "short-christmas-wishes",
    canonicalPath: "/christmas/short-christmas-wishes",
    ctaHref: "/christmas/messages?length=short",
    en: {
      title: "Short Christmas Wishes",
      metaTitle: "Short Christmas Wishes (2026) | TheDigitalGifter",
      metaDescription:
        "Short Christmas wishes for cards, tags, and large lists: one or two sentences, still specific, with a generator on short length and links into mom, dad, and work pages.",
      h1: "Short Christmas wishes that still sound like you",
      intro:
        "Short Christmas wishes are not lazy if they name a person. They are the right length for a gift tag, a group email, a kid learning to sign a card, and a dad who will not read a paragraph. This intent page is the cluster hub for the short length. Steal a line, swap in a name, and stop. If you owe someone a letter, do not hide on this page — go to mom, family, or romantic and write the longer thing. If you owe thirty people a note, stay here and keep it even.",
      imageAlt: "Gift tag and small card for short Christmas wishes",
      ctaText: "Write a short Christmas wish",
      benefits: [
        {
          title: "Fits a tag",
          text: "Under 140 characters is a first-class length in the generator, not an afterthought.",
        },
        {
          title: "Scales without going hollow",
          text: "A name plus one true noun beats “season’s greetings” thirty times.",
        },
        {
          title: "Hands off to a card",
          text: "Short text still deserves a designed card. The studio will not pad it into an essay.",
        },
      ],
      faq: [
        {
          question: "Is a one-line wish rude for mom?",
          answer:
            "Not if the line is hers. “I still call you first” is enough. If you owe her a year of context, write the medium note instead.",
        },
        {
          question: "How short is too short?",
          answer:
            "A name plus “Merry Christmas” with no second beat is a label, not a wish. Add one true thing.",
        },
        {
          question: "Can short still be professional?",
          answer:
            "Yes. “Thank you for the cover this year. Rest well.” is a complete coworker note.",
        },
      ],
      sections: [
        {
          heading: "Lines that fit a tag",
          body: "Say them out loud. If you need a breath in the middle, it is already too long for this page.",
          items: [
            {
              title: "Family",
              text: "Merry Christmas. Save me the corner seat. I will bring the story.",
            },
            {
              title: "Mom",
              text: "I still call you first. Merry Christmas, Mom.",
            },
            {
              title: "Dad",
              text: "Thanks for the quiet drives. Merry Christmas, Dad.",
            },
            {
              title: "Work",
              text: "Grateful for the cover. Rest well. Happy holidays.",
            },
            {
              title: "Partner",
              text: "You, a blanket, the terrible movie. That is the gift.",
            },
          ],
        },
        {
          heading: "When to leave this page",
          body: "Grief, a repair, a first Christmas after a birth or a death — those usually need more than a tag. Use family or heartfelt and take the space. Short is a craft, not a way to dodge the year.",
        },
        {
          heading: "Generate on short",
          body: "Set length=short in the message tool so the draft stays tag-sized. Mom, dad, coworkers, and funny pages show how the same brevity changes face without becoming an essay. The card studio will take the line as-is and will not pad it into a speech you did not write.",
        },
      ],
      relatedPages: [
        { label: "Messages for mom", url: messagesPath("mom") },
        { label: "Messages for dad", url: messagesPath("dad") },
        { label: "Messages for coworkers", url: messagesPath("coworkers") },
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
      ],
    },
    ro: {
      title: "Urări scurte de Crăciun",
      metaTitle: "Urări scurte de Crăciun (2026) | TheDigitalGifter",
      metaDescription:
        "Urări scurte de Crăciun pentru felicitări, etichete și liste mari: una-două propoziții, tot precise, cu generator pe lungime scurtă și legături către mama, tata și birou.",
      h1: "Urări scurte de Crăciun care tot sună a tine",
      intro:
        "Urările scurte de Crăciun nu sunt lene dacă numesc un om. Sunt lungimea potrivită pentru o etichetă, un email de grup, un copil care învață să semneze și un tată care nu citește un paragraf. Pagina de intent e hub-ul de cluster pentru lungimea scurtă. Fură un rând, pune un nume, oprește-te. Dacă datorezi cuiva o scrisoare, nu te ascunde aici — du-te la mama, familie sau romantic și scrie varianta lungă. Dacă datorezi un bilet la treizeci de oameni, rămâi aici și ține-l egal.",
      imageAlt: "Etichetă de cadou și felicitare mică pentru urări scurte de Crăciun",
      ctaText: "Scrie o urare scurtă de Crăciun",
      benefits: [
        {
          title: "Încape pe o etichetă",
          text: "Sub 140 de caractere e o lungime de primă clasă în generator, nu o idee de ultim moment.",
        },
        {
          title: "Se scalează fără să se golească",
          text: "Un nume plus un substantiv adevărat bate „sărbători fericite” de treizeci de ori.",
        },
        {
          title: "Trece pe felicitare",
          text: "Un text scurt merită tot o felicitare desenată. Studio-ul nu-l umflă într-un eseu.",
        },
      ],
      faq: [
        {
          question: "O urare pe un rând e obraznică pentru mama?",
          answer:
            "Nu, dacă rândul e al ei. „Tot ție îți sun primul” ajunge. Dacă îi datorezi contextul unui an, scrie varianta medie.",
        },
        {
          question: "Cât de scurt e prea scurt?",
          answer:
            "Un nume plus „Crăciun fericit” fără un al doilea timp e o etichetă, nu o urare. Adaugă un lucru adevărat.",
        },
        {
          question: "Poate fi scurt și profesional?",
          answer:
            "Da. „Mulțumesc pentru acoperirea din anul ăsta. Odihnește-te.” e un bilet complet de coleg.",
        },
      ],
      sections: [
        {
          heading: "Rânduri care încap pe o etichetă",
          body: "Spune-le cu voce tare. Dacă îți trebuie o respirație la mijloc, e deja prea lung pentru pagina asta.",
          items: [
            {
              title: "Familie",
              text: "Crăciun fericit. Păstrați-mi colțul. Eu aduc povestea.",
            },
            {
              title: "Mama",
              text: "Tot ție îți sun primul. Crăciun fericit, mamă.",
            },
            {
              title: "Tata",
              text: "Mulțumesc pentru drumurile tăcute. Crăciun fericit, tată.",
            },
            {
              title: "Serviciu",
              text: "Mulțumesc pentru acoperire. Odihniți-vă. Sărbători fericite.",
            },
            {
              title: "Partener",
              text: "Tu, o pătură, filmul ăla prost. Ăsta e cadoul.",
            },
          ],
        },
        {
          heading: "Când pleci de pe pagina asta",
          body: "Doliul, o reparație, primul Crăciun după o naștere sau o moarte — de obicei au nevoie de mai mult decât o etichetă. Folosește familia sau din suflet și ia-ți spațiul. Scurtul e o meserie, nu o evadare din an.",
        },
        {
          heading: "Generează pe scurt",
          body: "Pune length=short în unealta de mesaje ca ciorna să rămână de etichetă. Paginile de mama, tata, colegi și amuzant arată cum aceeași scurtime își schimbă fața fără să devină eseu. Studio-ul de felicitări ia rândul așa cum e și nu-l umflă într-un discurs pe care nu l-ai scris.",
        },
      ],
      relatedPages: [
        { label: "Mesaje pentru mama", url: messagesPath("mom") },
        { label: "Mesaje pentru tata", url: messagesPath("dad") },
        { label: "Mesaje pentru colegi", url: messagesPath("coworkers") },
        { label: "Mesaje de Crăciun pentru familie", url: "/christmas/christmas-messages-for-family" },
      ],
    },
  },
  {
    cluster: "messages-intent",
    pageType: "christmas-messages-intent",
    slug: "christmas-messages-for-family",
    canonicalPath: "/christmas/christmas-messages-for-family",
    ctaHref: "/christmas/messages?for=family&tone=heartfelt",
    en: {
      title: "Christmas Messages for Family",
      metaTitle: "Christmas Messages for Family (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas messages for family that can be read at the table: siblings, parents, in-laws, with drafts in English and Romanian and a generator on the family key.",
      h1: "Christmas messages for family",
      intro:
        "A family Christmas message has to survive being read aloud. It should not settle scores, pick a favorite child, or pretend a hard year was simple. The useful note names the table: who cooked, who traveled, who is missing, who is new. This intent page is the cluster hub for the family relationship key. It sits above mom, dad, kids, and grandparents gift guides so you can write the group card first and the individual cards second. Generate on family + heartfelt, then print one copy for the center of the table.",
      imageAlt: "Family table Christmas card for a group holiday message",
      ctaText: "Write a family Christmas message",
      benefits: [
        {
          title: "Built for the table",
          text: "Heartfelt family drafts assume more than one listener. Keep the private fights off this card.",
        },
        {
          title: "Splits into people you love differently",
          text: "Mom, dad, kids, and grandparents pages exist when one group paragraph is not enough.",
        },
        {
          title: "Romanian at the table",
          text: "If the older generation speaks Romanian, write that version. Diacritics are not optional decoration.",
        },
      ],
      faq: [
        {
          question: "Someone is missing this year. Do I mention them?",
          answer:
            "If the table already knows, a short honest line is better than fake cheer. Do not turn the card into a eulogy unless the family asked for that.",
        },
        {
          question: "In-laws will hear it. How careful should I be?",
          answer:
            "Write to the people in the room you actually share. Warm and specific beats a performance of instant intimacy.",
        },
        {
          question: "Can kids help write it?",
          answer:
            "Yes. Short wishes let a child add a sentence an adult types. Do not put a child in an open generator or a public gallery.",
        },
      ],
      sections: [
        {
          heading: "Drafts that can be read standing up",
          body: "If a sentence needs a sidebar explanation, it belongs in a one-to-one card, not the family one.",
          items: [
            {
              title: "The whole table",
              text: "Merry Christmas. Thank you for every seat you kept open and every pot you watched. I am glad we are still a table.",
            },
            {
              title: "After travel",
              text: "The trains, the cars, the late arrivals — you still made it. That is the gift. Eat first. Talk after.",
            },
            {
              title: "Blended family",
              text: "We did not start in the same house. We are in the same room tonight. That is enough to bless.",
            },
            {
              title: "With a missing seat",
              text: "We saved the story they would have told. We will not fill the quiet with noise. Merry Christmas, still.",
            },
            {
              title: "From the kids",
              text: "We see who sets the table and who drives at midnight. Sit down. We can burn the rolls without you.",
            },
          ],
        },
        {
          heading: "Do not use the family card as a court",
          body: "No ranking siblings. No comments on money, bodies, or who hosted last year as a complaint. If you need to repair something, do it off the card the whole table will pass.",
        },
        {
          heading: "Write the group note, then the personal ones",
          body: "Open the generator with for=family and keep the note readable standing up. Mom, dad, kids, and grandparents pages finish the cluster when one paragraph cannot cover everyone. Short wishes help when a child is signing. Nothing on this page opens a payment sheet.",
        },
      ],
      relatedPages: [
        { label: "Messages for mom", url: messagesPath("mom") },
        { label: "Messages for dad", url: messagesPath("dad") },
        { label: "Gifts for kids", url: giftsPath("kids") },
        { label: "Gifts for grandparents", url: giftsPath("grandparents") },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru familie",
      metaTitle: "Mesaje de Crăciun pentru familie (2026) | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru familie, de citit la masă: frați, părinți, socri, cu ciorne în română și engleză și un generator pornit pe cheia de familie.",
      h1: "Mesaje de Crăciun pentru familie",
      intro:
        "Un mesaj de Crăciun de familie trebuie să supraviețuiască citit cu voce tare. Nu trebuie să închidă socoteli, să aleagă un copil preferat sau să pretindă că un an greu a fost simplu. Biletul util numește masa: cine a gătit, cine a călătorit, cine lipsește, cine e nou. Pagina de intent e hub-ul de cluster pentru cheia de relație family. Stă deasupra ghidurilor de cadouri pentru mama, tata, copii și bunici, ca să scrii întâi felicitarea de grup și apoi pe cele individuale. Generează pe familie + din suflet, apoi printează un exemplar pentru mijlocul mesei.",
      imageAlt: "Felicitare de masă de familie pentru un mesaj de grup de Crăciun",
      ctaText: "Scrie un mesaj de Crăciun pentru familie",
      benefits: [
        {
          title: "Gândite pentru masă",
          text: "Ciornele din suflet presupun mai mulți ascultători. Ține certurile private departe de felicitarea asta.",
        },
        {
          title: "Se desparte în oameni pe care-i iubești diferit",
          text: "Paginile de mama, tata, copii și bunici există când un paragraf de grup nu ajunge.",
        },
        {
          title: "Română la masă",
          text: "Dacă generația mai în vârstă vorbește română, scrie varianta aia. Diacriticele nu sunt decorație opțională.",
        },
      ],
      faq: [
        {
          question: "Cineva lipsește anul ăsta. Îl pomenesc?",
          answer:
            "Dacă masa deja știe, un rând scurt și cinstit e mai bun decât veselia falsă. Nu transforma felicitarea în necrolog dacă familia n-a cerut asta.",
        },
        {
          question: "Socrii o să audă. Cât de atent să fiu?",
          answer:
            "Scrie către oamenii din cameră cu care chiar împarți ceva. Cald și precis bate un spectacol de intimitate instant.",
        },
        {
          question: "Pot ajuta copiii la scris?",
          answer:
            "Da. Urările scurte lasă un copil să adauge o propoziție pe care o tastează un adult. Nu pune un copil într-un generator deschis sau o galerie publică.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care se pot citi în picioare",
          body: "Dacă o propoziție are nevoie de o explicație pe o parte, e a unei felicitări unu-la-unu, nu a celei de familie.",
          items: [
            {
              title: "Toată masa",
              text: "Crăciun fericit. Mulțumesc pentru fiecare scaun ținut liber și fiecare oală păzită. Mă bucur că încă suntem o masă.",
            },
            {
              title: "După drum",
              text: "Trenurile, mașinile, întârzierile — tot ați ajuns. Ăsta e cadoul. Mâncați întâi. Vorbiți după.",
            },
            {
              title: "Familie amestecată",
              text: "N-am început în aceeași casă. Suntem în aceeași cameră diseară. Ajunge ca binecuvântare.",
            },
            {
              title: "Cu un loc gol",
              text: "Am păstrat povestea pe care ar fi spus-o. Nu umplem liniștea cu zgomot. Crăciun fericit, totuși.",
            },
            {
              title: "De la copii",
              text: "Vedem cine pune masa și cine conduce la miezul nopții. Așezați-vă. Putem arde chiflele și fără voi.",
            },
          ],
        },
        {
          heading: "Nu folosi felicitarea de familie ca tribunal",
          body: "Fără clasamente între frați. Fără comentarii despre bani, corpuri sau cine a găzduit anul trecut ca reproș. Dacă trebuie să reparați ceva, faceți-o în afara felicitării pe care o dă toată masa din mână în mână.",
        },
        {
          heading: "Scrie biletul de grup, apoi pe cele personale",
          body: "Deschide generatorul cu for=family și ține biletul citibil în picioare. Paginile de mama, tata, copii și bunici închid clusterul când un paragraf nu acoperă pe toată lumea. Urările scurte ajută când un copil semnează. Nimic pe pagina asta nu deschide o foaie de plată.",
        },
      ],
      relatedPages: [
        { label: "Mesaje pentru mama", url: messagesPath("mom") },
        { label: "Mesaje pentru tata", url: messagesPath("dad") },
        { label: "Cadouri pentru copii", url: giftsPath("kids") },
        { label: "Cadouri pentru bunici", url: giftsPath("grandparents") },
      ],
    },
  },
];
