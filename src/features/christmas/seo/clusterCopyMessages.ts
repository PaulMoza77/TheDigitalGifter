import type { ChristmasSeoSpec } from "./types";

function giftsPath(slug: string): string {
  return `/christmas/gifts-for-${slug}`;
}

function messagesPath(slug: string): string {
  return `/christmas/messages-for-${slug}`;
}

export const MESSAGE_CLUSTER_SPECS: ChristmasSeoSpec[] = [
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "mom",
    canonicalPath: messagesPath("mom"),
    ctaHref: "/christmas/messages?for=mom",
    recipientKey: "mom",
    en: {
      title: "Christmas Messages for Mom",
      metaTitle: "Christmas Messages for Mom (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas messages for mom that mention this year: heartfelt, short, and funny options, plus a generator that starts with her and a card you can print tonight.",
      h1: "Christmas messages for mom",
      intro:
        "A Christmas message for mom should sound like you after a long year, not like a card aisle. The line she keeps is the one that names a real Tuesday: the soup she sent over, the call she answered on the second ring, the way she still asks if you ate. Use the examples below as a start, then open the message generator with mom selected and add the detail only your family knows. When the words settle, drop them onto a Christmas card or read them at the table. English and Romanian both work; pick the language she uses when she is tired.",
      imageAlt: "Handwritten-style Christmas card for a message to mom",
      ctaText: "Write a message for mom",
      benefits: [
        {
          title: "Starts on mom, not a blank form",
          text: "The generator already knows the recipient key. You choose tone and length instead of fighting a generic prompt.",
        },
        {
          title: "Three drafts, then your edit",
          text: "Pick the one that sounds least like a template. Keep the sentence that could only be about her.",
        },
        {
          title: "Straight onto a card",
          text: "Use-in-card handoff keeps the message out of the URL so you are not leaking a private note in analytics.",
        },
      ],
      faq: [
        {
          question: "How long should a Christmas message for mom be?",
          answer:
            "Long enough to name one scene, short enough that she can read it standing up. Short wishes work on a tag; a medium note works on a card; a long letter is for when you owe her more than a season’s greeting.",
        },
        {
          question: "What if we had a hard year?",
          answer:
            "Do not fake cheer. Thank her for a concrete thing and skip the performance review of the family. Heartfelt tone plus one honest sentence beats a funny draft that pretends nothing happened.",
        },
        {
          question: "Can I write this in Romanian?",
          answer:
            "Yes. Switch the generator to Romanian and keep the diacritics. A message without ă/î/ș/ț will look like it was typed by a tourist.",
        },
      ],
      sections: [
        {
          heading: "Lines you can steal and then ruin (in a good way)",
          body: "Copy one draft, delete the polished parts, and put back the nickname, the city, or the dish she still makes. If it could be printed in a stranger’s card, it is not done.",
          items: [
            {
              title: "Heartfelt",
              text: "Mom — thank you for the night you waited up when the flight was late. This year I am trying to be as steady as you were in that kitchen.",
            },
            {
              title: "Short",
              text: "Merry Christmas, Mom. I still call you first. I hope the house smells like yours tonight.",
            },
            {
              title: "Funny",
              text: "Merry Christmas to the woman who still reminds me to take a coat. I packed one. I will still be cold. I love you.",
            },
            {
              title: "From the kids",
              text: "We see how you hold the whole table together. Sit down this year. We will burn the rolls without you.",
            },
            {
              title: "If you live far away",
              text: "I cannot be in your doorway, so I wrote this down. Play it at the table anyway. I am raising a glass from here.",
            },
          ],
        },
        {
          heading: "What to leave out",
          body: "Skip comments on her body, her dating life, or how she “worries too much.” Skip comparing her to other mothers. If you need to apologize, do it in a sentence that does not demand instant forgiveness on Christmas morning.",
        },
        {
          heading: "Make the card after the words",
          body: "Open /christmas/messages?for=mom, generate three options, then send the keeper to cards. Related gift ideas for mom exist if the message is only half of what you are giving. Nothing on this page starts a payment.",
        },
      ],
      relatedPages: [
        { label: "Gifts for mom", url: giftsPath("mom") },
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
        { label: "Messages for dad", url: messagesPath("dad") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru mama",
      metaTitle: "Mesaje de Crăciun pentru mama (2026) | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru mama care pomenesc anul ăsta: variante din suflet, scurte și amuzante, plus un generator pornit pe ea și o felicitare de printat.",
      h1: "Mesaje de Crăciun pentru mama",
      intro:
        "Un mesaj de Crăciun pentru mama trebuie să sune a tine după un an lung, nu a raft de felicitări. Rândul pe care-l păstrează e cel care numește o marți reală: ciorba pe care ți-a trimis-o, telefonul la care a răspuns din a doua sonerie, felul în care încă întreabă dacă ai mâncat. Folosește exemplele de mai jos ca start, apoi deschide generatorul cu mama selectată și adaugă detaliul pe care doar familia voastră îl știe. Când se așază cuvintele, pune-le pe o felicitare sau citește-le la masă. Merge și româna, și engleza; alege limba pe care o folosește când e obosită.",
      imageAlt: "Felicitare de Crăciun scrisă de mână, pentru un mesaj către mama",
      ctaText: "Scrie un mesaj pentru mama",
      benefits: [
        {
          title: "Pornește pe mama, nu pe un formular gol",
          text: "Generatorul știe deja cheia de destinatar. Tu alegi tonul și lungimea, nu te lupți cu un prompt generic.",
        },
        {
          title: "Trei ciorne, apoi corectura ta",
          text: "Alege varianta care sună cel mai puțin a șablon. Păstrează propoziția care poate fi doar despre ea.",
        },
        {
          title: "Direct pe felicitare",
          text: "Handoff-ul către card ține mesajul în afara URL-ului, ca să nu scurgi un bilet privat în analytics.",
        },
      ],
      faq: [
        {
          question: "Cât de lung să fie un mesaj de Crăciun pentru mama?",
          answer:
            "Destul cât să numească o scenă, destul de scurt cât să-l poată citi în picioare. Urările scurte țin pe un bilețel; un text mediu ține pe felicitare; o scrisoare lungă e pentru când îi datorezi mai mult decât o urare de sezon.",
        },
        {
          question: "Dacă am avut un an greu?",
          answer:
            "Nu fabrica veselie. Mulțumește-i pentru un lucru concret și sari peste evaluarea familiei. Tonul din suflet plus o propoziție cinstită bat o ciornă amuzantă care pretinde că n-s-a întâmplat nimic.",
        },
        {
          question: "Pot scrie în română?",
          answer:
            "Da. Pune generatorul pe română și păstrează diacriticele. Un mesaj fără ă/î/ș/ț arată ca scris de un turist.",
        },
      ],
      sections: [
        {
          heading: "Rânduri pe care le poți fura și apoi strica (în bine)",
          body: "Copiază o ciornă, șterge părțile lustruite și pune înapoi porecla, orașul sau mâncarea pe care încă o face. Dacă ar putea fi tipărită în felicitarea unui străin, nu e gata.",
          items: [
            {
              title: "Din suflet",
              text: "Mamă — mulțumesc pentru noaptea în care ai așteptat când avionul a întârziat. Anul ăsta încerc să fiu la fel de așezat cum ai fost tu în bucătăria aia.",
            },
            {
              title: "Scurt",
              text: "Crăciun fericit, mamă. Tot ție îți sun primul. Sper ca diseară casa să miroasă a a ta.",
            },
            {
              title: "Amuzant",
              text: "Crăciun fericit femeii care încă îmi spune să-mi iau geacă. Am luat-o. Tot o să-mi fie frig. Te iubesc.",
            },
            {
              title: "De la copii",
              text: "Vedem cum ții toată masa în picioare. Așază-te anul ăsta. O să ardem chiflele și fără tine.",
            },
            {
              title: "Dacă ești departe",
              text: "Nu pot fi în pragul tău, de-aia am scris. Citește totuși la masă. Ridic un pahar de-aici.",
            },
          ],
        },
        {
          heading: "Ce lași afară",
          body: "Sari peste comentarii despre corp, viața ei amoroasă sau că „se îngrijorează prea tare”. Sari peste comparații cu alte mame. Dacă trebuie să-ți ceri iertare, fă-o într-o propoziție care nu cere iertare instant în dimineața de Crăciun.",
        },
        {
          heading: "Fă felicitarea după cuvinte",
          body: "Deschide /christmas/messages?for=mom, generează trei variante, apoi trimite păstrătoarea către felicitări. Există și idei de cadouri pentru mama dacă mesajul e doar jumătate din dar. Nimic pe pagina asta nu pornește o plată.",
        },
      ],
      relatedPages: [
        { label: "Cadouri pentru mama", url: giftsPath("mom") },
        { label: "Mesaje de familie", url: "/christmas/christmas-messages-for-family" },
        { label: "Mesaje pentru tata", url: messagesPath("dad") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "dad",
    canonicalPath: messagesPath("dad"),
    ctaHref: "/christmas/messages?for=dad",
    recipientKey: "dad",
    en: {
      title: "Christmas Messages for Dad",
      metaTitle: "Christmas Messages for Dad (2026) | TheDigitalGifter",
      metaDescription:
        "Christmas messages for dad that he can take: funny last lines, short pride notes, and heartfelt drafts you can drop onto a card without making him give a speech.",
      h1: "Christmas messages for dad",
      intro:
        "Dad will shrug at a paragraph and remember a single sentence. The sentence that works names a ride he gave, a thing he fixed, or the way he still checks the locks. Humor is allowed if the last line is sincere. This page gives you drafts in that shape, then sends you to the generator with dad already selected so you are not staring at a blank box in a supermarket. When you have the words, put them on a card or say them once and sit down. You do not need him to answer with a speech.",
      imageAlt: "Simple Christmas card layout for a note to dad",
      ctaText: "Write a message for dad",
      benefits: [
        {
          title: "Pride without a podium",
          text: "Short and heartfelt lanes keep you from writing an essay he will not read out loud.",
        },
        {
          title: "A joke with a landing",
          text: "Funny drafts exist so you can tease the remote and still say you noticed the year.",
        },
        {
          title: "Works if he is a stepfather too",
          text: "Warm copy does not pretend you share a childhood. Name the years you do share.",
        },
      ],
      faq: [
        {
          question: "He hates mushy cards. Should I skip this?",
          answer:
            "Write six honest words and stop. “Thanks for coming to get me” is a Christmas message. The generator’s short length is built for that.",
        },
        {
          question: "Can I combine funny and serious?",
          answer:
            "Yes. Start funny, end serious. Do not bury the thanks in so many jokes that he thinks you are only performing.",
        },
        {
          question: "What if we barely talk?",
          answer:
            "Do not invent a closer relationship. Wish him rest, name one neutral good thing, and leave the door open. A professional-warm tone is closer than a fake childhood memoir.",
        },
      ],
      sections: [
        {
          heading: "Drafts that sound like a person",
          body: "If you would not say it in the driveway, do not print it. Keep tools, sports, and weather as texture, not as the whole note.",
          items: [
            {
              title: "Short",
              text: "Merry Christmas, Dad. Thanks for every quiet drive. I learned more there than I said.",
            },
            {
              title: "Funny",
              text: "Merry Christmas to the man who can hear a drip two rooms away. The house is still standing. So am I. Love you.",
            },
            {
              title: "Heartfelt",
              text: "I know you do not want a scene. I just want you to know this year I understood how much you carried.",
            },
            {
              title: "From the grandkids",
              text: "They still think you can fix anything. They are not wrong. Merry Christmas, Grandpa — from all of us.",
            },
            {
              title: "If you are not blood",
              text: "You did not have to show up the way you did. I noticed. Merry Christmas.",
            },
          ],
        },
        {
          heading: "Leave the cheap shots out",
          body: "No jokes about his job, his weight, his hair, or “getting old” unless he opened that door this week. No comparing him to mom. If you need to talk about a fight, do it after the meal, not on the card the whole table will pass around.",
        },
        {
          heading: "Generate, then put it on paper",
          body: "Messages for dad open with his key. Funny Christmas messages help if humor is the only way he lets you in. Gift ideas for dad sit next door if the card is not the whole gift.",
        },
      ],
      relatedPages: [
        { label: "Gifts for dad", url: giftsPath("dad") },
        { label: "Funny Christmas messages", url: "/christmas/funny-christmas-messages" },
        { label: "Messages for mom", url: messagesPath("mom") },
        { label: "Family Christmas messages", url: "/christmas/christmas-messages-for-family" },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru tata",
      metaTitle: "Mesaje de Crăciun pentru tata (2026) | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru tata pe care le poate primi: poante cu final serios, note scurte de mândrie și ciorne din suflet, gata de pus pe felicitare.",
      h1: "Mesaje de Crăciun pentru tata",
      intro:
        "Tata o să dea din umeri la un paragraf și o să țină minte o singură propoziție. Propoziția care prinde numește o drumetie pe care a făcut-o, ceva ce a reparat sau felul în care tot verifică yala. Umorul e permis dacă ultimul rând e sincer. Pagina îți dă ciorne în forma asta, apoi te duce în generator cu tata deja selectat, ca să nu te uiți la o casetă goală într-un supermarket. Când ai cuvintele, pune-le pe o felicitare sau spune-le o dată și așază-te. Nu trebuie să răspundă cu un discurs.",
      imageAlt: "Felicitare simplă de Crăciun pentru un bilet către tata",
      ctaText: "Scrie un mesaj pentru tata",
      benefits: [
        {
          title: "Mândrie fără podium",
          text: "Benzile scurte și din suflet te opresc să scrii un eseu pe care nu-l va citi cu voce tare.",
        },
        {
          title: "O glumă cu aterizare",
          text: "Ciornele amuzante există ca să tachinezi telecomanda și totuși să spui că ai văzut anul.",
        },
        {
          title: "Merge și dacă e tată vitreg",
          text: "Copy-ul cald nu pretinde că ați avut aceeași copilărie. Numește anii pe care îi aveți împreună.",
        },
      ],
      faq: [
        {
          question: "Urăște felicitările moi. Să sar peste?",
          answer:
            "Scrie șase cuvinte cinstite și oprește-te. „Mulțumesc că ai venit să mă iei” e un mesaj de Crăciun. Lungimea scurtă a generatorului e făcută pentru asta.",
        },
        {
          question: "Pot amesteca amuzant cu serios?",
          answer:
            "Da. Începe amuzant, închide serios. Nu îngropa mulțumirea în atâtea glume încât să creadă că doar joci teatru.",
        },
        {
          question: "Dacă abia vorbim?",
          answer:
            "Nu inventa o relație mai apropiată. Urărește-i odihnă, numește un lucru bun și neutru și lasă ușa deschisă. Un ton profesional-cald e mai aproape decât un memoir fals de copilărie.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care sună a om",
          body: "Dacă n-ai zice-o în fața porții, n-o printa. Ține sculele, sportul și vremea ca textură, nu ca tot biletul.",
          items: [
            {
              title: "Scurt",
              text: "Crăciun fericit, tată. Mulțumesc pentru fiecare drum tăcut. Am învățat mai mult acolo decât am zis.",
            },
            {
              title: "Amuzant",
              text: "Crăciun fericit omului care aude un picur din două camere. Casa încă stă. Și eu. Te iubesc.",
            },
            {
              title: "Din suflet",
              text: "Știu că nu vrei scenă. Vreau doar să știi că anul ăsta am înțeles cât ai dus.",
            },
            {
              title: "De la nepoți",
              text: "Încă cred că poți repara orice. N-au dreptate greșită. Crăciun fericit, tataie — de la toți.",
            },
            {
              title: "Dacă nu e sânge",
              text: "N-aveai obligația să te arăți cum te-ai arătat. Am văzut. Crăciun fericit.",
            },
          ],
        },
        {
          heading: "Lasă ieftinătățile afară",
          body: "Fără glume despre slujbă, greutate, păr sau „că îmbătrânește”, dacă n-a deschis el ușa saptămâna asta. Fără comparații cu mama. Dacă trebuie să vorbiți despre o ceartă, faceți-o după masă, nu pe felicitarea pe care o dă toată masa din mână în mână.",
        },
        {
          heading: "Generează, apoi pune pe hârtie",
          body: "Mesajele pentru tata se deschid pe cheia lui. Mesajele amuzante ajută dacă umorul e singura cale pe care te lasă aproape. Ideile de cadouri pentru tata sunt alături dacă felicitarea nu e tot darul.",
        },
      ],
      relatedPages: [
        { label: "Cadouri pentru tata", url: giftsPath("dad") },
        { label: "Mesaje amuzante de Crăciun", url: "/christmas/funny-christmas-messages" },
        { label: "Mesaje pentru mama", url: messagesPath("mom") },
        { label: "Mesaje de familie", url: "/christmas/christmas-messages-for-family" },
      ],
    },
  },
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "boyfriend",
    canonicalPath: messagesPath("boyfriend"),
    ctaHref: "/christmas/messages?for=boyfriend&tone=romantic",
    recipientKey: "boyfriend",
    en: {
      title: "Christmas Messages for Your Boyfriend",
      metaTitle: "Christmas Messages for Your Boyfriend | TheDigitalGifter",
      metaDescription:
        "Christmas messages for your boyfriend: romantic without a script, funny without mean, short enough for a card, and a generator that starts on him.",
      h1: "Christmas messages for your boyfriend",
      intro:
        "A Christmas note for a boyfriend should sound like the person he dates, not like a movie quote. Mention a morning, a trip that almost went wrong, or the way he shows up when you are tired. Romance works when it is accurate; humor works when it is not a public roast. Use the drafts, then open the generator on boyfriend plus romantic or funny, and cut anything you would not say to his face. When it is done, put it on a card — do not bury a love note in a group chat screenshot.",
      imageAlt: "Romantic Christmas card still for a boyfriend message",
      ctaText: "Write a message for him",
      benefits: [
        {
          title: "Romantic or funny on purpose",
          text: "Pick a tone instead of mixing a roast with a marriage speech in the same paragraph.",
        },
        {
          title: "Private handoff to a card",
          text: "The message body stays out of the query string when you move into the card studio.",
        },
        {
          title: "Pairs with a couples portrait",
          text: "If the words are half the gift, the partner gift guide sits one click away.",
        },
      ],
      faq: [
        {
          question: "We just started dating. How big should this be?",
          answer:
            "Warm and short. Do not write a forever vow on the second Christmas. A specific kind sentence plus a card is enough.",
        },
        {
          question: "His family will read it. What then?",
          answer:
            "Keep the nickname and the private jokes for a second note. The card that sits on their table can be affectionate and clean.",
        },
        {
          question: "Can I write in Romanian?",
          answer:
            "Yes. If that is the language you fight and make up in, use it. The generator keeps diacritics.",
        },
      ],
      sections: [
        {
          heading: "Drafts that do not sound like a billboard",
          body: "Replace every “babe” with the name you actually use. If you only call him by a last name, keep that.",
          items: [
            {
              title: "Romantic",
              text: "Merry Christmas. My favorite part of this year was the ordinary Tuesdays you made feel like a plan.",
            },
            {
              title: "Short",
              text: "You, a blanket, the terrible movie. That is the gift. Merry Christmas.",
            },
            {
              title: "Funny",
              text: "Thank you for pretending my wrapping is a skill. I love you more than I love being right about the thermostat.",
            },
            {
              title: "Long-distance",
              text: "I hate that I cannot lean on you in the kitchen tonight. I am still yours. Open this on the call.",
            },
            {
              title: "After a hard year",
              text: "We did not get the easy version of this year. I still choose the person who sat through it with me.",
            },
          ],
        },
        {
          heading: "Do not write the fight on the card",
          body: "A Christmas message is not the place to reopen who forgot a date. If you need to repair something, do it in a conversation, then write a shorter card that tells the truth without a courtroom.",
        },
        {
          heading: "Generate and pair",
          body: "Start at /christmas/messages?for=boyfriend. Romantic Christmas messages and the partner gift guide are the two sibling pages. Girlfriend copy lives next door if you are writing the other direction.",
        },
      ],
      relatedPages: [
        { label: "Romantic Christmas messages", url: "/christmas/romantic-christmas-messages" },
        { label: "Messages for your girlfriend", url: messagesPath("girlfriend") },
        { label: "Gifts for your partner", url: giftsPath("partner") },
        { label: "Funny Christmas messages", url: "/christmas/funny-christmas-messages" },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru iubitul tău",
      metaTitle: "Mesaje de Crăciun pentru iubit | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru iubit: romantice fără scenariu, amuzante fără răutate, destul de scurte pentru o felicitare, cu generator pornit pe el.",
      h1: "Mesaje de Crăciun pentru iubitul tău",
      intro:
        "Un bilet de Crăciun pentru un iubit trebuie să sune a omul cu care iese, nu a citat de film. Pomenește o dimineață, o călătorie care aproape a mers prost sau felul în care apare când ești obosită. Romantismul ține când e precis; umorul ține când nu e un roast public. Folosește ciornele, apoi deschide generatorul pe iubit plus romantic sau amuzant și taie tot ce n-ai zice în față. Când e gata, pune-l pe felicitare — nu îngropa un bilet de dragoste într-un screenshot de grup.",
      imageAlt: "Felicitare romantică de Crăciun pentru un mesaj către iubit",
      ctaText: "Scrie un mesaj pentru el",
      benefits: [
        {
          title: "Romantic sau amuzant dinadins",
          text: "Alege un ton în loc să amesteci un roast cu un discurs de căsătorie în același paragraf.",
        },
        {
          title: "Handoff privat către felicitare",
          text: "Corpul mesajului stă în afara query string-ului când treci în studio-ul de carduri.",
        },
        {
          title: "Se leagă de un portret de cuplu",
          text: "Dacă vorbele sunt jumătate din cadou, ghidul de cadouri pentru partener e la un click.",
        },
      ],
      faq: [
        {
          question: "Abia am început să ne vedem. Cât de mare să fie?",
          answer:
            "Cald și scurt. Nu scrie un jurământ pe al doilea Crăciun. O propoziție bună și o felicitare ajung.",
        },
        {
          question: "Familia lui o să citească. Atunci?",
          answer:
            "Ține porecla și glumele private pentru un al doilea bilet. Felicitarea de pe masa lor poate fi afectuoasă și curată.",
        },
        {
          question: "Pot scrie în română?",
          answer:
            "Da. Dacă asta e limba în care vă certați și vă împăcați, folosește-o. Generatorul păstrează diacriticele.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care nu sună a panou publicitar",
          body: "Înlocuiește fiecare „iubi” cu numele pe care-l folosești. Dacă-i spui doar pe numele de familie, păstrează-l.",
          items: [
            {
              title: "Romantic",
              text: "Crăciun fericit. Partea mea preferată din anul ăsta au fost marțile obișnuite pe care le-ai făcut să pară un plan.",
            },
            {
              title: "Scurt",
              text: "Tu, o pătură, filmul ăla prost. Ăsta e cadoul. Crăciun fericit.",
            },
            {
              title: "Amuzant",
              text: "Mulțumesc că te prefaci că am talent la împachetat. Te iubesc mai mult decât iubesc să am dreptate la termostat.",
            },
            {
              title: "La distanță",
              text: "Urăsc că nu pot să mă sprijin de tine în bucătărie diseară. Tot a ta sunt. Deschide asta pe apel.",
            },
            {
              title: "După un an greu",
              text: "N-am primit varianta ușoară a anului. Tot îl aleg pe omul care a stat în ea cu mine.",
            },
          ],
        },
        {
          heading: "Nu scrie cearta pe felicitare",
          body: "Un mesaj de Crăciun nu e locul în care redeschizi cine a uitat o întâlnire. Dacă trebuie să reparați ceva, faceți-o într-o conversație, apoi scrie o felicitare mai scurtă care spune adevărul fără tribunal.",
        },
        {
          heading: "Generează și leagă",
          body: "Pornește de la /christmas/messages?for=boyfriend. Mesajele romantice și ghidul de cadouri pentru partener sunt paginile-soră. Copy-ul pentru iubită e alături dacă scrii pe cealaltă direcție.",
        },
      ],
      relatedPages: [
        { label: "Mesaje romantice de Crăciun", url: "/christmas/romantic-christmas-messages" },
        { label: "Mesaje pentru iubită", url: messagesPath("girlfriend") },
        { label: "Cadouri pentru partener", url: giftsPath("partner") },
        { label: "Mesaje amuzante de Crăciun", url: "/christmas/funny-christmas-messages" },
      ],
    },
  },
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "girlfriend",
    canonicalPath: messagesPath("girlfriend"),
    ctaHref: "/christmas/messages?for=girlfriend&tone=romantic",
    recipientKey: "girlfriend",
    en: {
      title: "Christmas Messages for Your Girlfriend",
      metaTitle: "Christmas Messages for Your Girlfriend | TheDigitalGifter",
      metaDescription:
        "Christmas messages for your girlfriend that sound like you: romantic, funny, or short, with a generator that starts on her and a card you can print.",
      h1: "Christmas messages for your girlfriend",
      intro:
        "The Christmas card that works for a girlfriend is specific. It remembers the concert, the bad week at work, the way she laughs when the wrapping goes wrong. Grand promises without a Tuesday behind them read as panic. Use these drafts, then generate three options with girlfriend selected and keep the sentence you would still send in July. Print the card or read it before the paper comes off the box. If her family will see it, keep a second, more private note for later.",
      imageAlt: "Soft Christmas stationery for a girlfriend holiday note",
      ctaText: "Write a message for her",
      benefits: [
        {
          title: "Tone you choose on purpose",
          text: "Romantic, funny, or short — do not mash them into a paragraph that apologizes and jokes at the same time.",
        },
        {
          title: "Card studio next",
          text: "Move the keeper into a Christmas card without putting the love note in a query parameter.",
        },
        {
          title: "Same cluster as partner gifts",
          text: "If you also want a couples portrait, the partner gift guide is built for that half of the present.",
        },
      ],
      faq: [
        {
          question: "I am not good with words. Is the generator cheating?",
          answer:
            "A draft is a start. The gift is the edit: her name, the trip, the joke. If you send the first output unchanged, it will read like a first output.",
        },
        {
          question: "Should I mention the future?",
          answer:
            "Only if you already talk about it. A Christmas card is a bad place to spring a life plan she has not heard.",
        },
        {
          question: "What if we are on and off?",
          answer:
            "Write to the year you actually had. Warm and short beats a dramatic forever line you cannot stand behind in January.",
        },
      ],
      sections: [
        {
          heading: "Drafts worth ruining with her details",
          body: "Put back the city, the dog, the song. Delete every line that could sit on a stranger’s Instagram caption.",
          items: [
            {
              title: "Romantic",
              text: "Merry Christmas. I still replay the night you waited with me when the news was bad. That is the year I keep.",
            },
            {
              title: "Short",
              text: "You make the room quieter in the good way. Merry Christmas. I am glad it is you.",
            },
            {
              title: "Funny",
              text: "Thank you for loving me after you saw how I pack a suitcase. I will work on the suitcase. I will not work on loving you less.",
            },
            {
              title: "From a shy person",
              text: "I am better on paper. Here it is: I chose you again this year. Merry Christmas.",
            },
            {
              title: "Long-distance",
              text: "I set a plate for you anyway. Call me when you open this. I want to hear the paper.",
            },
          ],
        },
        {
          heading: "Keep it off the group chat",
          body: "A screenshot of a love note in a family thread is how private language dies. Give her the card in person or on a call. Do not ask her to perform gratitude in front of relatives.",
        },
        {
          heading: "Write it, then decide the rest of the gift",
          body: "Open the generator at /christmas/messages?for=girlfriend and keep the sentence you would still send in July. Romantic Christmas messages and the boyfriend page sit beside this one if you need the other direction. Partner gifts cover portraits and wishlists when the card is only half of what you are giving. Nothing on this page starts a payment.",
        },
      ],
      relatedPages: [
        { label: "Romantic Christmas messages", url: "/christmas/romantic-christmas-messages" },
        { label: "Messages for your boyfriend", url: messagesPath("boyfriend") },
        { label: "Gifts for your partner", url: giftsPath("partner") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru iubita ta",
      metaTitle: "Mesaje de Crăciun pentru iubită | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru iubită care sună a tine: romantice, amuzante sau scurte, cu generator pornit pe ea, felicitare de printat și fără un scenariu de film.",
      h1: "Mesaje de Crăciun pentru iubita ta",
      intro:
        "Felicitarea de Crăciun care ține pentru o iubită e precisă. Ține minte concertul, saptămâna proastă de la muncă, râsul ei când împachetatul merge prost. Promisiunile mari fără o marți în spate sună a panică. Folosește ciornele, apoi generează trei variante cu iubita selectată și păstrează propoziția pe care ai trimite-o și în iulie. Printează felicitarea sau citește-o înainte să cadă hârtia de pe cutie. Dacă familia ei o vede, ține un al doilea bilet, mai privat, pentru mai târziu.",
      imageAlt: "Papetărie blândă de Crăciun pentru un bilet către iubită",
      ctaText: "Scrie un mesaj pentru ea",
      benefits: [
        {
          title: "Ton ales dinadins",
          text: "Romantic, amuzant sau scurt — nu le amesteca într-un paragraf care își cere iertare și glumește în același timp.",
        },
        {
          title: "Apoi studio-ul de felicitări",
          text: "Mută varianta păstrată pe o felicitare fără să pui biletul de dragoste într-un parametru de URL.",
        },
        {
          title: "Același cluster cu cadourile de partener",
          text: "Dacă vrei și un portret de cuplu, ghidul de cadouri pentru partener e făcut pentru jumătatea aia de dar.",
        },
      ],
      faq: [
        {
          question: "Nu sunt bun la vorbe. E trișat generatorul?",
          answer:
            "O ciornă e un început. Cadoul e editarea: numele ei, drumul, gluma. Dacă trimiți prima variantă neschimbată, o să sune a prima variantă.",
        },
        {
          question: "Să pomenesc viitorul?",
          answer:
            "Doar dacă deja vorbiți despre el. O felicitare de Crăciun e un loc prost să arunci un plan de viață pe care ea nu l-a auzit.",
        },
        {
          question: "Dacă suntem on and off?",
          answer:
            "Scrie despre anul pe care l-ați avut. Cald și scurt bate un rând dramatic de „pentru totdeauna” pe care nu-l poți susține în ianuarie.",
        },
      ],
      sections: [
        {
          heading: "Ciorne pe care merită să le strici cu detaliile ei",
          body: "Pune înapoi orașul, câinele, melodia. Șterge fiecare rând care ar putea sta pe caption-ul unui străin.",
          items: [
            {
              title: "Romantic",
              text: "Crăciun fericit. Tot recitesc noaptea în care ai așteptat cu mine când veștile erau proaste. Ăsta e anul pe care-l țin.",
            },
            {
              title: "Scurt",
              text: "Faci camera mai liniștită în felul bun. Crăciun fericit. Mă bucur că ești tu.",
            },
            {
              title: "Amuzant",
              text: "Mulțumesc că m-ai iubit după ce-ai văzut cum îmi fac geamantanul. O să lucrez la geamantan. N-o să lucrez la a te iubi mai puțin.",
            },
            {
              title: "De la un om timid",
              text: "Sunt mai bun pe hârtie. Uite: te-am ales din nou anul ăsta. Crăciun fericit.",
            },
            {
              title: "La distanță",
              text: "Ți-am pus totuși o farfurie. Sună-mă când deschizi. Vreau să aud hârtia.",
            },
          ],
        },
        {
          heading: "Ține-l departe de grupul familiei",
          body: "Un screenshot cu un bilet de dragoste într-un thread de familie e felul în care moare limba privată. Dă-i felicitarea în persoană sau pe apel. Nu-i cere să joace recunoștință în fața rudelor.",
        },
        {
          heading: "Scrie, apoi decide restul cadoului",
          body: "Deschide generatorul la /christmas/messages?for=girlfriend și păstrează propoziția pe care ai trimite-o și în iulie. Mesajele romantice și pagina pentru iubit stau alături dacă ai nevoie de cealaltă direcție. Cadourile de partener acoperă portrete și liste când felicitarea e doar jumătate din dar. Nimic pe pagina asta nu pornește o plată.",
        },
      ],
      relatedPages: [
        { label: "Mesaje romantice de Crăciun", url: "/christmas/romantic-christmas-messages" },
        { label: "Mesaje pentru iubit", url: messagesPath("boyfriend") },
        { label: "Cadouri pentru partener", url: giftsPath("partner") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "coworkers",
    canonicalPath: messagesPath("coworkers"),
    ctaHref: "/christmas/messages?for=coworker&tone=professional",
    recipientKey: "coworker",
    en: {
      title: "Christmas Messages for Coworkers",
      metaTitle: "Christmas Messages for Coworkers | TheDigitalGifter",
      metaDescription:
        "Desk-safe Christmas messages for coworkers: professional, short, even across the team, with a generator that stays on work tone and a card you can send today.",
      h1: "Christmas messages for coworkers",
      intro:
        "A coworker Christmas message should survive an open laptop. Name a project, thank them for coverage, wish them rest — then stop. The danger is warmth that sounds like a performance review or a joke that only the inner circle gets. This page keeps you on the professional side of the taxonomy, with drafts you can send to one person or lightly customize for a whole team. If clients sit on the same list, switch to the customer page. If you manage the person, keep the note even shorter and skip favorites.",
      imageAlt: "Clean professional Christmas card for a coworker note",
      ctaText: "Write a coworker message",
      benefits: [
        {
          title: "Professional tone is a first-class lane",
          text: "You do not have to sand the romance off a family template. The generator already knows work.",
        },
        {
          title: "Easy to keep even",
          text: "One structure, many names. Nobody gets a novel while someone else gets “happy holidays.”",
        },
        {
          title: "Printable or pasteable",
          text: "Drop the text on a card or into an email. Either way it stays short enough for a standup.",
        },
      ],
      faq: [
        {
          question: "Is “Merry Christmas” OK if the team is mixed?",
          answer:
            "If you are not sure, “Happy holidays” or a winter note is safer. Do not debate religion in the last Slack of the year.",
        },
        {
          question: "Can I be funny?",
          answer:
            "About the year, not the person. A joke about the migration is fine. A joke about someone’s dating life is not.",
        },
        {
          question: "What if I am the intern?",
          answer:
            "Shorter is better. Thank them for time they did not have to give you. Skip gifts-of-flattery that sound like a LinkedIn comment.",
        },
      ],
      sections: [
        {
          heading: "Drafts that pass the open-plan test",
          body: "Read them out loud as if a director is two desks away. If you wince, cut.",
          items: [
            {
              title: "Peer",
              text: "Merry Christmas — thank you for every time you unblocked me without making it a ticket. Rest well.",
            },
            {
              title: "Manager to report",
              text: "Thank you for the year you put into this team. I hope the break is actually a break. Happy holidays.",
            },
            {
              title: "Report to manager",
              text: "Thank you for the clarity and the cover. Wishing you a quiet week and a good start to January.",
            },
            {
              title: "Large list",
              text: "Grateful to have built this year with you. Wishing you rest and a kind January — TheDigitalGifter team style: short.",
            },
            {
              title: "Remote teammate",
              text: "The timezone math never got easier. The work did, because you were there. Happy holidays from here.",
            },
          ],
        },
        {
          heading: "Do not write HR’s problem",
          body: "No comments on bodies, babies, leave, or who got promoted. No alcohol dares. No photos of children unless a parent asked. No client secrets dressed up as nostalgia.",
        },
        {
          heading: "Generate at work tone",
          body: "Open messages with coworker + professional. Customer messages and short wishes are the siblings when the list gets mixed or long. The coworker gift guide is next if you also owe a physical token.",
        },
      ],
      relatedPages: [
        { label: "Professional Christmas messages", url: "/christmas/professional-christmas-messages" },
        { label: "Messages for customers", url: messagesPath("customers") },
        { label: "Gifts for coworkers", url: giftsPath("coworkers") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru colegi",
      metaTitle: "Mesaje de Crăciun pentru colegi | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun sigure la birou: profesionale, scurte, egale pe toată echipa, cu generator pe ton de serviciu și felicitare de trimis azi.",
      h1: "Mesaje de Crăciun pentru colegi",
      intro:
        "Un mesaj de Crăciun pentru un coleg trebuie să supraviețuiască unui laptop deschis. Numește un proiect, mulțumește pentru acoperire, urărește odihnă — apoi oprește-te. Pericolul e o căldură care sună a evaluare sau o glumă pe care o înțelege doar cercul mic. Pagina te ține pe partea profesională a taxonomiei, cu ciorne pe care le poți trimite unui om sau le poți ajusta ușor pentru toată echipa. Dacă pe listă sunt și clienți, treci pe pagina de clienți. Dacă ești șeful omului, ține biletul și mai scurt și sari peste favoriți.",
      imageAlt: "Felicitare profesională, curată, pentru un mesaj de coleg",
      ctaText: "Scrie un mesaj pentru colegi",
      benefits: [
        {
          title: "Tonul profesional e o bandă proprie",
          text: "Nu trebuie să șlefuiești romantismul de pe un șablon de familie. Generatorul știe deja serviciul.",
        },
        {
          title: "Ușor de ținut egal",
          text: "O structură, multe nume. Nimeni nu primește un roman în timp ce altcineva primește „sărbători fericite”.",
        },
        {
          title: "De printat sau de lipit",
          text: "Pune textul pe felicitare sau în email. Oricum rămâne destul de scurt pentru un standup.",
        },
      ],
      faq: [
        {
          question: "„Crăciun fericit” e ok dacă echipa e amestecată?",
          answer:
            "Dacă nu ești sigur, „sărbători fericite” sau un bilet de iarnă e mai sigur. Nu dezbate religia în ultimul Slack al anului.",
        },
        {
          question: "Pot fi amuzant?",
          answer:
            "Despre an, nu despre persoană. O glumă despre migrare e în regulă. O glumă despre viața amoroasă a cuiva nu e.",
        },
        {
          question: "Dacă sunt internul?",
          answer:
            "Mai scurt e mai bine. Mulțumește pentru timpul pe care n-aveau de ce să ți-l dea. Sari peste lingușeli care sună a comentariu de LinkedIn.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care trec testul open-space",
          body: "Citește-le cu voce tare ca și cum un director e la două birouri. Dacă te strâmbi, taie.",
          items: [
            {
              title: "Coleg",
              text: "Crăciun fericit — mulțumesc de fiecare dată când m-ai deblocat fără să faci din asta un ticket. Odihnește-te.",
            },
            {
              title: "Manager către raport",
              text: "Mulțumesc pentru anul pe care l-ai pus în echipa asta. Sper ca pauza să fie pauză. Sărbători fericite.",
            },
            {
              title: "Raport către manager",
              text: "Mulțumesc pentru claritate și pentru acoperire. Îți doresc o saptămână liniștită și un ianuarie bun.",
            },
            {
              title: "Listă mare",
              text: "Mă bucur că am construit anul ăsta cu voi. Odihnă și un ianuarie blând — scurt, în stilul echipei.",
            },
            {
              title: "Coleg remote",
              text: "Matematica fuselor n-a devenit mai ușoară. Munca da, pentru că erai acolo. Sărbători fericite de-aici.",
            },
          ],
        },
        {
          heading: "Nu scrie problema HR-ului",
          body: "Fără comentarii despre corp, bebeluși, concedii sau cine a fost promovat. Fără provocări cu alcool. Fără poze cu copii dacă un părinte n-a cerut. Fără secrete de client îmbrăcate în nostalgie.",
        },
        {
          heading: "Generează pe ton de serviciu",
          body: "Deschide mesajele cu coleg + profesional. Mesajele pentru clienți și urările scurte sunt surorile când lista se amestecă sau se lungește. Ghidul de cadouri pentru colegi e alături dacă mai datorezi și un obiect.",
        },
      ],
      relatedPages: [
        { label: "Mesaje profesionale de Crăciun", url: "/christmas/professional-christmas-messages" },
        { label: "Mesaje pentru clienți", url: messagesPath("customers") },
        { label: "Cadouri pentru colegi", url: giftsPath("coworkers") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
      ],
    },
  },
  {
    cluster: "messages-for",
    pageType: "christmas-messages-for",
    slug: "customers",
    canonicalPath: messagesPath("customers"),
    ctaHref: "/christmas/messages?for=customer&tone=professional",
    recipientKey: "customer",
    en: {
      title: "Christmas Messages for Customers",
      metaTitle: "Christmas Messages for Customers | TheDigitalGifter",
      metaDescription:
        "Christmas messages for customers that stay grateful and brief: no fake intimacy, no hard sell, professional drafts you can send without opening a checkout.",
      h1: "Christmas messages for customers",
      intro:
        "A customer Christmas note is a thank-you, not a campaign. The people who paid you this year do not owe you a reply, a review, or another invoice before January. Keep the message short, name the work if you can do it without leaking, and skip the hard sell. This page sits on the professional / customer keys so you are not borrowing coworker jokes or family warmth. When the draft is clean, put it on a simple card or into a plain email. Do not attach a coupon that looks like the whole point.",
      imageAlt: "Minimal professional holiday card for a customer thank-you",
      ctaText: "Write a customer message",
      benefits: [
        {
          title: "Grateful, not clingy",
          text: "Professional drafts thank them for the year without pretending you spent Christmas Eve together.",
        },
        {
          title: "Safe for a mixed BCC",
          text: "Short wishes scale. You can still customize the first line when the account is large enough to deserve it.",
        },
        {
          title: "No checkout on this page",
          text: "The factory page is a writing guide. It does not open Apple Pay or a Christmas SKU.",
        },
      ],
      faq: [
        {
          question: "Can I mention a renewal?",
          answer:
            "Not in the Christmas note. Send a separate, clearly labeled business email in January. Mixing “merry” with “your contract lapses” is how people mute you.",
        },
        {
          question: "Is humor OK with clients?",
          answer:
            "Only if you already joke that way in working hours. Default to warm-professional. Never joke about their outage, their board, or their family.",
        },
        {
          question: "Do I write Merry Christmas or Happy Holidays?",
          answer:
            "Match how they write to you. If you do not know, Happy Holidays is the safer public line.",
        },
      ],
      sections: [
        {
          heading: "Drafts that do not ask for anything",
          body: "If a sentence could be read as a nudge to buy, cut it. The gift is the pause.",
          items: [
            {
              title: "Core thank-you",
              text: "Thank you for the trust you placed with us this year. Wishing you a restful holiday and a steady January.",
            },
            {
              title: "After a hard delivery",
              text: "We know this year asked a lot. We are grateful you stayed in it with us. Rest well — we will pick up cleanly in the new year.",
            },
            {
              title: "Small account, same respect",
              text: "Whether the project was large or brief, we noticed the care you brought. Happy holidays.",
            },
            {
              title: "Vendor / partner",
              text: "The year was easier because you were on the other side of the thread. Thank you. Enjoy the break.",
            },
            {
              title: "No-name broadcast",
              text: "Grateful for everyone who built with us in 2026. Wishing you quiet days and a kind start to the year.",
            },
          ],
        },
        {
          heading: "Compliance and taste",
          body: "Do not include personal data you would not put in a ticket. Do not attach faces of their employees without asking. Do not imply a religious requirement to keep the contract. If your brand is not a Christmas brand, a winter note is enough.",
        },
        {
          heading: "Write it, then stop selling",
          body: "Generator: customer + professional. Coworker messages are warmer and should not be reused here. The professional intent page is the cluster sibling for non-customer work notes.",
        },
      ],
      relatedPages: [
        { label: "Professional Christmas messages", url: "/christmas/professional-christmas-messages" },
        { label: "Messages for coworkers", url: messagesPath("coworkers") },
        { label: "Short Christmas wishes", url: "/christmas/short-christmas-wishes" },
        { label: "Gifts for coworkers", url: giftsPath("coworkers") },
      ],
    },
    ro: {
      title: "Mesaje de Crăciun pentru clienți",
      metaTitle: "Mesaje de Crăciun pentru clienți | TheDigitalGifter",
      metaDescription:
        "Mesaje de Crăciun pentru clienți, recunoscătoare și scurte: fără intimitate falsă, fără vânzare agresivă, ciorne profesionale fără checkout.",
      h1: "Mesaje de Crăciun pentru clienți",
      intro:
        "Un bilet de Crăciun către un client e un mulțumesc, nu o campanie. Oamenii care v-au plătit anul ăsta nu vă datorează un răspuns, un review sau încă o factură înainte de ianuarie. Ține mesajul scurt, numește munca dacă poți fără să scapi informații și sari peste vânzarea agresivă. Pagina stă pe cheile profesional / client ca să nu împrumuți glume de coleg sau căldură de familie. Când ciorna e curată, pune-o pe o felicitare simplă sau într-un email fără floricele. Nu atașa un cupon care pare tot scopul.",
      imageAlt: "Felicitare minimală de sărbători pentru un mulțumesc către client",
      ctaText: "Scrie un mesaj pentru clienți",
      benefits: [
        {
          title: "Recunoscător, nu agățat",
          text: "Ciornele profesionale mulțumesc pentru an fără să pretindă că ați petrecut Ajunul împreună.",
        },
        {
          title: "Sigur pentru un BCC amestecat",
          text: "Urările scurte se scalează. Poți totuși personaliza primul rând când contul merită.",
        },
        {
          title: "Fără checkout pe pagina asta",
          text: "Pagina de factory e un ghid de scris. Nu deschide Apple Pay și nici un SKU de Crăciun.",
        },
      ],
      faq: [
        {
          question: "Pot pomeni un renewal?",
          answer:
            "Nu în biletul de Crăciun. Trimite un email de business separat, etichetat clar, în ianuarie. Dacă amesteci „crăciun fericit” cu „îți expiră contractul”, oamenii te mutesc.",
        },
        {
          question: "E ok umorul cu clienții?",
          answer:
            "Doar dacă deja glumiți așa în program. Implicit: cald-profesional. Nu glumi niciodată despre incidentul lor, board sau familie.",
        },
        {
          question: "Scriu Crăciun fericit sau Sărbători fericite?",
          answer:
            "Potrivește-te după cum îți scriu ei. Dacă nu știi, Sărbători fericite e linia publică mai sigură.",
        },
      ],
      sections: [
        {
          heading: "Ciorne care nu cer nimic",
          body: "Dacă o propoziție poate fi citită ca un ghiont de cumpărare, taie-o. Cadoul e pauza.",
          items: [
            {
              title: "Mulțumirea de bază",
              text: "Vă mulțumim pentru încrederea din anul ăsta. Vă dorim sărbători liniștite și un ianuarie așezat.",
            },
            {
              title: "După o livrare grea",
              text: "Știm că anul a cerut mult. Vă mulțumim că ați rămas în el cu noi. Odihniți-vă — reluăm curat în anul nou.",
            },
            {
              title: "Cont mic, același respect",
              text: "Fie că proiectul a fost mare sau scurt, am observat grija pe care ați adus-o. Sărbători fericite.",
            },
            {
              title: "Furnizor / partener",
              text: "Anul a fost mai ușor pentru că erați de cealaltă parte a thread-ului. Mulțumim. Bucurați-vă de pauză.",
            },
            {
              title: "Broadcast fără nume",
              text: "Mulțumim tuturor celor cu care am construit în 2026. Zile liniștite și un început blând de an.",
            },
          ],
        },
        {
          heading: "Conformitate și bun-gust",
          body: "Nu include date personale pe care n-ai pune-le într-un ticket. Nu atașa fețe ale angajaților lor fără să întrebi. Nu implica o cerință religioasă ca să țină contractul. Dacă brandul tău nu e un brand de Crăciun, un bilet de iarnă ajunge.",
        },
        {
          heading: "Scrie, apoi nu mai vinde",
          body: "Generator: client + profesional. Mesajele de coleg sunt mai calde și nu trebuie refolosite aici. Pagina de intent profesional e sora de cluster pentru bilete de muncă non-client.",
        },
      ],
      relatedPages: [
        { label: "Mesaje profesionale de Crăciun", url: "/christmas/professional-christmas-messages" },
        { label: "Mesaje pentru colegi", url: messagesPath("coworkers") },
        { label: "Urări scurte de Crăciun", url: "/christmas/short-christmas-wishes" },
        { label: "Cadouri pentru colegi", url: giftsPath("coworkers") },
      ],
    },
  },
];

