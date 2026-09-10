/** Gift Finder UI copy — Wave 1 locale packs (en, ro, de, fr, es, it, pt, nl, pl). */

export type GiftFinderLocale = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";

export const GIFT_FINDER_UI_LOCALES: GiftFinderLocale[] = [
  "en",
  "ro",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
];

const EN: Record<string, string> = {
  "seo.title": "Christmas Gift Finder | Find the Perfect Gift | TheDigitalGifter",
  "seo.description":
    "Find thoughtful Christmas gift ideas based on who you’re shopping for, their interests, personality, and your budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Christmas Gift Finder",
  "hero.h1": "Find a Christmas Gift They’ll Actually Love",
  "hero.sub":
    "Tell us who you’re shopping for, what they’re into and your budget. We’ll help you find thoughtful gift ideas in moments.",
  "hero.cta": "Find Their Gift",
  "hero.demo.for": "For: Mom, 58",
  "hero.demo.loves": "Loves: cooking, travel, home",
  "hero.demo.budget": "Budget: $50–$100",
  "hero.demo.match": "Top Match: Personalized Recipe Book",
  "hero.demo.why":
    "Why she may love it: It combines her love of cooking with something personal and meaningful.",
  "hero.demo.note": "Demo preview — not a live result",

  "progress.of": "{current} of {total}",
  "nav.back": "Back",
  "nav.continue": "Continue",
  "nav.skip": "Skip",
  "nav.find": "Find Their Gift",
  "nav.openWishlist": "Open Wishlist",
  "nav.refine": "Refine My Answers",
  "nav.restart": "Start over",

  "step.recipient.title": "Who are you shopping for?",
  "step.age.title": "How old are they?",
  "step.interests.title": "What are they into?",
  "step.interests.hint": "Pick a few — up to 6",
  "step.interests.other": "Something else",
  "step.interests.otherPlaceholder": "Add a custom interest (optional)",
  "step.personality.title": "What are they like?",
  "step.personality.hint": "Select all that fit",
  "step.budget.title": "What’s your budget?",
  "step.detail.title": "Tell us one thing about them",
  "step.detail.optional": "Optional — but it can make recommendations much better",
  "step.detail.placeholder": "e.g. She just moved into a new home.",
  "step.detail.examples":
    "Examples: “He loves Formula 1 and coffee.” · “She says she doesn’t want anything.”",

  "loading.1": "Finding gifts that fit them…",
  "loading.2": "Matching their interests…",
  "loading.3": "Looking for something they’ll actually love…",

  "results.title": "Best Matches for {recipient}",
  "results.why": "Why it fits",
  "results.price": "Typical price: {range}",
  "results.priceFlexible": "Budget flexible",
  "results.seeGift": "See Gift",
  "results.save": "Save to Wishlist",
  "results.moreLike": "More Like This",
  "results.notForThem": "Not for Them",
  "results.saved": "Saved to your wishlist",
  "results.ideaOnly": "Gift idea",
  "results.shopLater": "Shop links coming soon",

  "feedback.title": "Want better matches?",
  "feedback.none": "None of these feel right",
  "feedback.missing": "What’s missing?",
  "feedback.missingPlaceholder": "Tell us what would feel more right…",
  "feedback.apply": "Update results",

  "crossSell.title": "Want something more personal?",
  "crossSell.portrait": "Create a Christmas Portrait",
  "crossSell.santa": "Make a Santa Video",
  "crossSell.card": "Send a Personalized Christmas Card",

  "error.generic": "We couldn’t find the right match yet. Let’s adjust one detail.",
  "error.rate": "Please wait a bit before searching again.",
  "error.retry": "Try again",

  "seo.section.recipient": "Find Gifts by Recipient",
  "seo.section.budget": "Find Christmas Gifts by Budget",
  "seo.section.personality": "Christmas Gifts by Personality",
  "seo.section.how": "How the Christmas Gift Finder Works",
  "seo.section.howBody":
    "Choose the recipient, share their interests and personality, set a budget, and optionally add one personal detail. You’ll get ranked gift ideas with short explanations — then refine, restart, or save ideas to your Christmas Wishlist.",
  "seo.section.hasEverything": "Gifts for Someone Who Has Everything",
  "seo.section.hasEverythingBody":
    "When someone already owns “all the things,” useful Christmas gifts usually lean toward experiences, personalized keepsakes, hobby upgrades, sentimental moments, or practical premium items. Choosing a “has everything” personality steers the finder that way instead of generic clutter.",
  "seo.geo.title": "What is a Christmas Gift Finder?",
  "seo.geo.body":
    "A Christmas Gift Finder is a guided tool that recommends Christmas gift ideas based on who you’re shopping for, their interests and personality, and your budget. On TheDigitalGifter, you answer a short set of questions and receive curated ideas with clear reasons they may fit — then you can refine or save ideas to a wishlist.",
  "seo.faq.title": "Frequently Asked Questions",
  "seo.section.wishlist": "Save ideas to your wishlist",
  "seo.section.wishlistBody":
    "Like an idea? Save it to your Christmas Wishlist and share one list with family so shopping stays coordinated.",

  "breadcrumb.christmas": "Christmas",
  "breadcrumb.finder": "Gift Finder",
};

const RO: Record<string, string> = {
  "seo.title": "Găsitorul de Cadouri de Crăciun | Găsește Cadoul Perfect | TheDigitalGifter",
  "seo.description":
    "Găsește idei de cadouri de Crăciun pline de grijă, potrivite pentru cine cumperi, interesele lor, personalitatea și bugetul tău.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Găsitorul de Cadouri de Crăciun",
  "hero.h1": "Găsește un Cadou de Crăciun Pe Care Chiar Îl Vor Iubi",
  "hero.sub":
    "Spune-ne pentru cine cumperi, ce le place și care este bugetul tău. Te ajutăm să găsești idei de cadouri cu suflet, în câteva momente.",
  "hero.cta": "Găsește Cadoul Lor",
  "hero.demo.for": "Pentru: Mama, 58",
  "hero.demo.loves": "Îi place: gătitul, călătoriile, casa",
  "hero.demo.budget": "Buget: 50–100 $",
  "hero.demo.match": "Cea mai bună potrivire: Carte de rețete personalizată",
  "hero.demo.why":
    "De ce i-ar plăcea: Combină dragostea ei pentru gătit cu ceva personal și plin de sens.",
  "hero.demo.note": "Previzualizare demo — nu este un rezultat live",

  "progress.of": "{current} din {total}",
  "nav.back": "Înapoi",
  "nav.continue": "Continuă",
  "nav.skip": "Sari peste",
  "nav.find": "Găsește Cadoul Lor",
  "nav.openWishlist": "Deschide Lista de Dorințe",
  "nav.refine": "Rafinează Răspunsurile",
  "nav.restart": "Începe din nou",

  "step.recipient.title": "Pentru cine cumperi?",
  "step.age.title": "Câți ani au?",
  "step.interests.title": "Ce le place?",
  "step.interests.hint": "Alege câteva — maxim 6",
  "step.interests.other": "Altceva",
  "step.interests.otherPlaceholder": "Adaugă un interes personalizat (opțional)",
  "step.personality.title": "Cum sunt ca oameni?",
  "step.personality.hint": "Selectează tot ce li se potrivește",
  "step.budget.title": "Care este bugetul tău?",
  "step.detail.title": "Spune-ne un lucru despre ei",
  "step.detail.optional": "Opțional — dar poate face recomandările mult mai bune",
  "step.detail.placeholder": "ex. Tocmai s-a mutat într-o casă nouă.",
  "step.detail.examples":
    "Exemple: „Îi place Formula 1 și cafeaua.” · „Spune că nu vrea nimic.”",

  "loading.1": "Căutăm cadouri care li se potrivesc…",
  "loading.2": "Potrivim interesele lor…",
  "loading.3": "Căutăm ceva pe care chiar îl vor iubi…",

  "results.title": "Cele mai bune potriviri pentru {recipient}",
  "results.why": "De ce se potrivește",
  "results.price": "Preț tipic: {range}",
  "results.priceFlexible": "Buget flexibil",
  "results.seeGift": "Vezi Cadoul",
  "results.save": "Salvează în Lista de Dorințe",
  "results.moreLike": "Mai Mult de Acest Fel",
  "results.notForThem": "Nu Li Se Potrivește",
  "results.saved": "Salvat în lista ta de dorințe",
  "results.ideaOnly": "Idee de cadou",
  "results.shopLater": "Linkurile de cumpărături vin curând",

  "feedback.title": "Vrei potriviri mai bune?",
  "feedback.none": "Niciuna nu se simte potrivită",
  "feedback.missing": "Ce lipsește?",
  "feedback.missingPlaceholder": "Spune-ne ce ar fi mai potrivit…",
  "feedback.apply": "Actualizează rezultatele",

  "crossSell.title": "Vrei ceva și mai personal?",
  "crossSell.portrait": "Creează un Portret de Crăciun",
  "crossSell.santa": "Fă un Video cu Moș Crăciun",
  "crossSell.card": "Trimite o Felicitare de Crăciun Personalizată",

  "error.generic": "Încă nu am găsit potrivirea ideală. Hai să ajustăm un detaliu.",
  "error.rate": "Te rugăm să aștepți puțin înainte să cauți din nou.",
  "error.retry": "Încearcă din nou",

  "seo.section.recipient": "Găsește Cadouri După Destinatar",
  "seo.section.budget": "Găsește Cadouri de Crăciun După Buget",
  "seo.section.personality": "Cadouri de Crăciun După Personalitate",
  "seo.section.how": "Cum Funcționează Găsitorul de Cadouri de Crăciun",
  "seo.section.howBody":
    "Alegi destinatarul, îi descrii interesele și personalitatea, stabilești un buget și, opțional, adaugi un detaliu personal. Primești idei de cadouri ordonate, cu explicații scurte — apoi poți rafina, relua sau salva ideile în Lista ta de Dorințe de Crăciun.",
  "seo.section.hasEverything": "Cadouri Pentru Cineva Care Are Deja de Toate",
  "seo.section.hasEverythingBody":
    "Când cineva pare să aibă deja „tot ce trebuie”, cadourile de Crăciun cu adevărat utile țin de obicei de experiențe, obiecte personalizate cu suflet, upgrade-uri pentru un hobby, momente sentimentale sau lucruri practice, dar premium. Alegerea personalității „Are deja de toate” îndreaptă Găsitorul spre astfel de direcții, în loc de idei generice.",
  "seo.geo.title": "Ce este un Găsitor de Cadouri de Crăciun?",
  "seo.geo.body":
    "Un Găsitor de Cadouri de Crăciun este un instrument ghidat care recomandă idei de cadouri pe baza persoanei pentru care cumperi, a intereselor și personalității ei, plus bugetul tău. Pe TheDigitalGifter răspunzi la un set scurt de întrebări și primești idei alese cu grijă, cu motive clare pentru care s-ar potrivi — apoi poți rafina răspunsurile sau salva ideile într-o listă de dorințe.",
  "seo.faq.title": "Întrebări Frecvente",
  "seo.section.wishlist": "Salvează ideile în lista de dorințe",
  "seo.section.wishlistBody":
    "Ți-a plăcut o idee? Salveaz-o în Lista ta de Dorințe de Crăciun și partajeaz-o cu familia, ca toată lumea să rămână coordonată la cumpărături.",

  "breadcrumb.christmas": "Crăciun",
  "breadcrumb.finder": "Găsitor de Cadouri",
};

const DE: Record<string, string> = {
  "seo.title": "Weihnachts-Geschenke-Finder | Das perfekte Geschenk finden | TheDigitalGifter",
  "seo.description":
    "Finde durchdachte Weihnachtsgeschenkideen basierend darauf, für wen du einkaufst, ihre Interessen, ihre Persönlichkeit und dein Budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Weihnachts-Geschenke-Finder",
  "hero.h1": "Finde ein Weihnachtsgeschenk, das wirklich ankommt",
  "hero.sub":
    "Sag uns, für wen du einkaufst, was sie mögen und wie hoch dein Budget ist. Wir helfen dir, in wenigen Momenten durchdachte Geschenkideen zu finden.",
  "hero.cta": "Ihr Geschenk finden",
  "hero.demo.for": "Für: Mama, 58",
  "hero.demo.loves": "Liebt: Kochen, Reisen, Zuhause",
  "hero.demo.budget": "Budget: 50–100 $",
  "hero.demo.match": "Top-Treffer: Personalisiertes Rezeptbuch",
  "hero.demo.why":
    "Warum sie es lieben könnte: Es verbindet ihre Liebe zum Kochen mit etwas Persönlichem und Bedeutungsvollem.",
  "hero.demo.note": "Demo-Vorschau — kein Live-Ergebnis",

  "progress.of": "{current} von {total}",
  "nav.back": "Zurück",
  "nav.continue": "Weiter",
  "nav.skip": "Überspringen",
  "nav.find": "Ihr Geschenk finden",
  "nav.openWishlist": "Wunschzettel öffnen",
  "nav.refine": "Antworten anpassen",
  "nav.restart": "Von vorne beginnen",

  "step.recipient.title": "Für wen einkaufst du?",
  "step.age.title": "Wie alt sind sie?",
  "step.interests.title": "Wofür begeistern sie sich?",
  "step.interests.hint": "Wähle ein paar — bis zu 6",
  "step.interests.other": "Etwas anderes",
  "step.interests.otherPlaceholder": "Eigenes Interesse hinzufügen (optional)",
  "step.personality.title": "Wie sind sie so?",
  "step.personality.hint": "Alles auswählen, was passt",
  "step.budget.title": "Wie hoch ist dein Budget?",
  "step.detail.title": "Erzähl uns eine Sache über sie",
  "step.detail.optional": "Optional — aber es kann die Empfehlungen deutlich verbessern",
  "step.detail.placeholder": "z. B. Sie ist gerade in ein neues Zuhause gezogen.",
  "step.detail.examples":
    "Beispiele: „Er liebt Formel 1 und Kaffee.“ · „Sie sagt, sie wolle nichts.“",

  "loading.1": "Wir suchen Geschenke, die zu ihnen passen…",
  "loading.2": "Wir gleichen ihre Interessen ab…",
  "loading.3": "Wir suchen etwas, das sie wirklich lieben werden…",

  "results.title": "Beste Treffer für {recipient}",
  "results.why": "Warum es passt",
  "results.price": "Typischer Preis: {range}",
  "results.priceFlexible": "Budget flexibel",
  "results.seeGift": "Geschenk ansehen",
  "results.save": "Auf dem Wunschzettel speichern",
  "results.moreLike": "Mehr davon",
  "results.notForThem": "Nicht für sie",
  "results.saved": "Auf deinem Wunschzettel gespeichert",
  "results.ideaOnly": "Geschenkidee",
  "results.shopLater": "Shoplinks folgen bald",

  "feedback.title": "Bessere Treffer gewünscht?",
  "feedback.none": "Keines davon fühlt sich richtig an",
  "feedback.missing": "Was fehlt?",
  "feedback.missingPlaceholder": "Sag uns, was sich richtiger anfühlen würde…",
  "feedback.apply": "Ergebnisse aktualisieren",

  "crossSell.title": "Möchtest du etwas Persönlicheres?",
  "crossSell.portrait": "Weihnachtsporträt erstellen",
  "crossSell.santa": "Weihnachtsmann-Video machen",
  "crossSell.card": "Personalisierte Weihnachtskarte senden",

  "error.generic": "Wir haben noch nicht die richtige Passung gefunden. Lass uns ein Detail anpassen.",
  "error.rate": "Bitte warte kurz, bevor du erneut suchst.",
  "error.retry": "Erneut versuchen",

  "seo.section.recipient": "Geschenke nach beschenkter Person finden",
  "seo.section.budget": "Weihnachtsgeschenke nach Budget finden",
  "seo.section.personality": "Weihnachtsgeschenke nach Persönlichkeit",
  "seo.section.how": "So funktioniert der Weihnachts-Geschenke-Finder",
  "seo.section.howBody":
    "Wähle die beschenkte Person, teile ihre Interessen und Persönlichkeit mit, setze ein Budget und füge optional ein persönliches Detail hinzu. Du erhältst bewertete Geschenkideen mit kurzen Erklärungen — danach kannst du Antworten anpassen, neu starten oder Ideen in deinem Weihnachtswunschzettel speichern.",
  "seo.section.hasEverything": "Geschenke für Menschen, die schon alles haben",
  "seo.section.hasEverythingBody":
    "Wenn jemand scheinbar bereits „alles hat“, gehen sinnvolle Weihnachtsgeschenke meist in Richtung Erlebnisse, persönliche Andenken, Hobby-Upgrades, sentimentale Momente oder hochwertige Alltagsgegenstände. Wählst du die Persönlichkeit „Hat schon alles“, lenkt der Finder die Vorschläge genau in diese Richtungen statt zu generischem Krempel.",
  "seo.geo.title": "Was ist ein Weihnachts-Geschenke-Finder?",
  "seo.geo.body":
    "Ein Weihnachts-Geschenke-Finder ist ein geführtes Tool, das Geschenkideen basierend darauf empfiehlt, für wen du einkaufst, welche Interessen und welche Persönlichkeit diese Person hat und wie hoch dein Budget ist. Bei TheDigitalGifter beantwortest du ein paar kurze Fragen und erhältst kuratierte Ideen mit einer klaren Begründung — danach kannst du Antworten anpassen oder Ideen in einem Wunschzettel speichern.",
  "seo.faq.title": "Häufig gestellte Fragen",
  "seo.section.wishlist": "Ideen im Wunschzettel speichern",
  "seo.section.wishlistBody":
    "Gefällt dir eine Idee? Speichere sie in deinem Weihnachtswunschzettel und teile eine gemeinsame Liste mit der Familie, damit der Einkauf abgestimmt bleibt.",

  "breadcrumb.christmas": "Weihnachten",
  "breadcrumb.finder": "Geschenke-Finder",
};

const FR: Record<string, string> = {
  "seo.title": "Générateur de cadeaux de Noël | Trouvez le cadeau idéal | TheDigitalGifter",
  "seo.description":
    "Trouvez des idées de cadeaux de Noël réfléchies selon la personne à qui vous offrez, ses centres d’intérêt, sa personnalité et votre budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Générateur de cadeaux de Noël",
  "hero.h1": "Trouvez un cadeau de Noël qu’ils vont vraiment adorer",
  "hero.sub":
    "Dites-nous pour qui vous offrez, ce qu’ils aiment et votre budget. Nous vous aidons à trouver des idées de cadeaux réfléchies en quelques instants.",
  "hero.cta": "Trouver leur cadeau",
  "hero.demo.for": "Pour : Maman, 58 ans",
  "hero.demo.loves": "Aime : cuisine, voyage, maison",
  "hero.demo.budget": "Budget : 50–100 $",
  "hero.demo.match": "Meilleure idée : Livre de recettes personnalisé",
  "hero.demo.why":
    "Pourquoi elle pourrait l’adorer : Cela allie son amour de la cuisine à quelque chose de personnel et plein de sens.",
  "hero.demo.note": "Aperçu démo — pas un résultat en direct",

  "progress.of": "{current} sur {total}",
  "nav.back": "Retour",
  "nav.continue": "Continuer",
  "nav.skip": "Passer",
  "nav.find": "Trouver leur cadeau",
  "nav.openWishlist": "Ouvrir la liste de souhaits",
  "nav.refine": "Affiner mes réponses",
  "nav.restart": "Recommencer",

  "step.recipient.title": "Pour qui offrez-vous ?",
  "step.age.title": "Quel âge ont-ils ?",
  "step.interests.title": "Qu’est-ce qui les passionne ?",
  "step.interests.hint": "Choisissez-en quelques-uns — jusqu’à 6",
  "step.interests.other": "Autre chose",
  "step.interests.otherPlaceholder": "Ajouter un centre d’intérêt personnalisé (optionnel)",
  "step.personality.title": "Comment sont-ils ?",
  "step.personality.hint": "Sélectionnez tout ce qui convient",
  "step.budget.title": "Quel est votre budget ?",
  "step.detail.title": "Dites-nous une chose à leur sujet",
  "step.detail.optional": "Optionnel — mais cela peut vraiment améliorer les recommandations",
  "step.detail.placeholder": "ex. Elle vient d’emménager dans une nouvelle maison.",
  "step.detail.examples":
    "Exemples : « Il adore la Formule 1 et le café. » · « Elle dit qu’elle ne veut rien. »",

  "loading.1": "Nous cherchons des cadeaux qui leur correspondent…",
  "loading.2": "Nous faisons correspondre leurs centres d’intérêt…",
  "loading.3": "Nous cherchons quelque chose qu’ils vont vraiment adorer…",

  "results.title": "Meilleures idées pour {recipient}",
  "results.why": "Pourquoi ça convient",
  "results.price": "Prix typique : {range}",
  "results.priceFlexible": "Budget flexible",
  "results.seeGift": "Voir le cadeau",
  "results.save": "Enregistrer dans la liste de souhaits",
  "results.moreLike": "Plus comme ça",
  "results.notForThem": "Pas pour eux",
  "results.saved": "Enregistré dans votre liste de souhaits",
  "results.ideaOnly": "Idée cadeau",
  "results.shopLater": "Liens d’achat bientôt disponibles",

  "feedback.title": "Envie de meilleures idées ?",
  "feedback.none": "Aucune ne semble juste",
  "feedback.missing": "Que manque-t-il ?",
  "feedback.missingPlaceholder": "Dites-nous ce qui serait plus juste…",
  "feedback.apply": "Mettre à jour les résultats",

  "crossSell.title": "Envie de quelque chose de plus personnel ?",
  "crossSell.portrait": "Créer un portrait de Noël",
  "crossSell.santa": "Faire une vidéo du Père Noël",
  "crossSell.card": "Envoyer une carte de Noël personnalisée",

  "error.generic": "Nous n’avons pas encore trouvé la bonne idée. Ajustons un détail.",
  "error.rate": "Veuillez patienter un peu avant de chercher à nouveau.",
  "error.retry": "Réessayer",

  "seo.section.recipient": "Trouver des cadeaux par destinataire",
  "seo.section.budget": "Trouver des cadeaux de Noël par budget",
  "seo.section.personality": "Cadeaux de Noël par personnalité",
  "seo.section.how": "Comment fonctionne le générateur de cadeaux de Noël",
  "seo.section.howBody":
    "Choisissez le destinataire, partagez ses centres d’intérêt et sa personnalité, fixez un budget et ajoutez éventuellement un détail personnel. Vous obtenez des idées de cadeaux classées avec de courtes explications — puis vous pouvez affiner, recommencer ou enregistrer des idées dans votre liste de souhaits de Noël.",
  "seo.section.hasEverything": "Des cadeaux pour quelqu’un qui a déjà tout",
  "seo.section.hasEverythingBody":
    "Quand quelqu’un semble déjà posséder « tout », les cadeaux de Noël les plus pertinents penchent souvent vers des expériences, des souvenirs personnalisés, des améliorations liées à un hobby, des moments sentimentaux ou des articles pratiques haut de gamme. Choisir la personnalité « A déjà tout » oriente le générateur vers ces pistes plutôt que vers des objets génériques.",
  "seo.geo.title": "Qu’est-ce qu’un générateur de cadeaux de Noël ?",
  "seo.geo.body":
    "Un générateur de cadeaux de Noël est un outil guidé qui recommande des idées de cadeaux selon la personne à qui vous offrez, ses centres d’intérêt, sa personnalité et votre budget. Chez TheDigitalGifter, vous répondez à une courte série de questions et recevez des idées sélectionnées avec des raisons claires pour lesquelles elles pourraient convenir — vous pouvez ensuite affiner vos réponses ou enregistrer des idées dans une liste de souhaits.",
  "seo.faq.title": "Questions fréquentes",
  "seo.section.wishlist": "Enregistrez des idées dans votre liste de souhaits",
  "seo.section.wishlistBody":
    "Une idée vous plaît ? Enregistrez-la dans votre liste de souhaits de Noël et partagez une liste unique avec la famille pour coordonner les achats.",

  "breadcrumb.christmas": "Noël",
  "breadcrumb.finder": "Trouveur de cadeaux",
};

const ES: Record<string, string> = {
  "seo.title": "Buscador de Regalos de Navidad | Encuentra el Regalo Perfecto | TheDigitalGifter",
  "seo.description":
    "Encuentra ideas de regalos de Navidad pensadas según para quién compras, sus intereses, su personalidad y tu presupuesto.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Buscador de Regalos de Navidad",
  "hero.h1": "Encuentra un regalo de Navidad que de verdad le encantará",
  "hero.sub":
    "Cuéntanos para quién compras, qué le gusta y tu presupuesto. Te ayudamos a encontrar ideas de regalos con cariño en unos momentos.",
  "hero.cta": "Encontrar su regalo",
  "hero.demo.for": "Para: Mamá, 58",
  "hero.demo.loves": "Le encanta: cocina, viajes, hogar",
  "hero.demo.budget": "Presupuesto: 50–100 $",
  "hero.demo.match": "Mejor coincidencia: Libro de recetas personalizado",
  "hero.demo.why":
    "Por qué le puede encantar: Combina su amor por la cocina con algo personal y con significado.",
  "hero.demo.note": "Vista previa demo — no es un resultado en vivo",

  "progress.of": "{current} de {total}",
  "nav.back": "Atrás",
  "nav.continue": "Continuar",
  "nav.skip": "Saltar",
  "nav.find": "Encontrar su regalo",
  "nav.openWishlist": "Abrir lista de deseos",
  "nav.refine": "Afinar mis respuestas",
  "nav.restart": "Empezar de nuevo",

  "step.recipient.title": "¿Para quién compras?",
  "step.age.title": "¿Qué edad tiene?",
  "step.interests.title": "¿Qué le gusta?",
  "step.interests.hint": "Elige unos cuantos — hasta 6",
  "step.interests.other": "Otra cosa",
  "step.interests.otherPlaceholder": "Añade un interés personalizado (opcional)",
  "step.personality.title": "¿Cómo es?",
  "step.personality.hint": "Selecciona todo lo que encaje",
  "step.budget.title": "¿Cuál es tu presupuesto?",
  "step.detail.title": "Cuéntanos una cosa sobre esa persona",
  "step.detail.optional": "Opcional — pero puede mejorar mucho las recomendaciones",
  "step.detail.placeholder": "p. ej. Acaba de mudarse a una casa nueva.",
  "step.detail.examples":
    "Ejemplos: «Le encanta la Fórmula 1 y el café.» · «Dice que no quiere nada.»",

  "loading.1": "Buscando regalos que le encajen…",
  "loading.2": "Emparejando sus intereses…",
  "loading.3": "Buscando algo que de verdad le encantará…",

  "results.title": "Mejores coincidencias para {recipient}",
  "results.why": "Por qué encaja",
  "results.price": "Precio típico: {range}",
  "results.priceFlexible": "Presupuesto flexible",
  "results.seeGift": "Ver regalo",
  "results.save": "Guardar en la lista de deseos",
  "results.moreLike": "Más como este",
  "results.notForThem": "No es para esa persona",
  "results.saved": "Guardado en tu lista de deseos",
  "results.ideaOnly": "Idea de regalo",
  "results.shopLater": "Enlaces de compra próximamente",

  "feedback.title": "¿Quieres mejores coincidencias?",
  "feedback.none": "Ninguna se siente adecuada",
  "feedback.missing": "¿Qué falta?",
  "feedback.missingPlaceholder": "Cuéntanos qué se sentiría más acertado…",
  "feedback.apply": "Actualizar resultados",

  "crossSell.title": "¿Quieres algo más personal?",
  "crossSell.portrait": "Crear un retrato de Navidad",
  "crossSell.santa": "Hacer un vídeo de Papá Noel",
  "crossSell.card": "Enviar una tarjeta de Navidad personalizada",

  "error.generic": "Aún no encontramos la coincidencia adecuada. Ajustemos un detalle.",
  "error.rate": "Espera un poco antes de buscar de nuevo.",
  "error.retry": "Intentar de nuevo",

  "seo.section.recipient": "Encuentra regalos según el destinatario",
  "seo.section.budget": "Encuentra regalos de Navidad por presupuesto",
  "seo.section.personality": "Regalos de Navidad por personalidad",
  "seo.section.how": "Cómo funciona el buscador de regalos de Navidad",
  "seo.section.howBody":
    "Elige al destinatario, cuéntanos sus intereses y su personalidad, fija un presupuesto y, si quieres, añade un detalle personal. Recibirás ideas de regalo ordenadas con explicaciones breves — luego puedes afinar, reiniciar o guardar ideas en tu lista de deseos navideña.",
  "seo.section.hasEverything": "Regalos para alguien que lo tiene todo",
  "seo.section.hasEverythingBody":
    "Cuando alguien ya parece tener «de todo», los regalos de Navidad útiles suelen inclinarse hacia experiencias, recuerdos personalizados, mejoras para un hobby, momentos sentimentales o artículos prácticos premium. Elegir la personalidad «Lo tiene todo» orienta el buscador en esa dirección en lugar de hacia objetos genéricos.",
  "seo.geo.title": "¿Qué es un buscador de regalos de Navidad?",
  "seo.geo.body":
    "Un buscador de regalos de Navidad es una herramienta guiada que recomienda ideas de regalo según para quién compras, sus intereses y personalidad, y tu presupuesto. En TheDigitalGifter respondes un breve cuestionario y recibes ideas seleccionadas con una razón clara de por qué encajan — luego puedes ajustar las respuestas o guardar ideas en una lista de deseos.",
  "seo.faq.title": "Preguntas frecuentes",
  "seo.section.wishlist": "Guarda ideas en tu lista de deseos",
  "seo.section.wishlistBody":
    "¿Te gusta una idea? Guárdala en tu lista de deseos navideña y comparte una sola lista con la familia para que las compras sigan coordinadas.",

  "breadcrumb.christmas": "Navidad",
  "breadcrumb.finder": "Buscador de regalos",
};

const IT: Record<string, string> = {
  "seo.title": "Ricercatore di Regali di Natale | Trova il Regalo Perfetto | TheDigitalGifter",
  "seo.description":
    "Trova idee regalo di Natale pensate in base a per chi stai comprando, ai suoi interessi, alla sua personalità e al tuo budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Ricercatore di Regali di Natale",
  "hero.h1": "Trova un regalo di Natale che ameranno davvero",
  "hero.sub":
    "Dicci per chi stai comprando, cosa gli piace e il tuo budget. Ti aiutiamo a trovare idee regalo pensate con cura in pochi istanti.",
  "hero.cta": "Trova il loro regalo",
  "hero.demo.for": "Per: Mamma, 58",
  "hero.demo.loves": "Ama: cucina, viaggi, casa",
  "hero.demo.budget": "Budget: 50–100 $",
  "hero.demo.match": "Miglior match: Libro di ricette personalizzato",
  "hero.demo.why":
    "Perché potrebbe piacerle: Unisce il suo amore per la cucina a qualcosa di personale e significativo.",
  "hero.demo.note": "Anteprima demo — non è un risultato live",

  "progress.of": "{current} di {total}",
  "nav.back": "Indietro",
  "nav.continue": "Continua",
  "nav.skip": "Salta",
  "nav.find": "Trova il loro regalo",
  "nav.openWishlist": "Apri la lista dei desideri",
  "nav.refine": "Affina le mie risposte",
  "nav.restart": "Ricomincia",

  "step.recipient.title": "Per chi stai comprando?",
  "step.age.title": "Quanti anni hanno?",
  "step.interests.title": "Cosa gli piace?",
  "step.interests.hint": "Scegline alcuni — fino a 6",
  "step.interests.other": "Qualcos’altro",
  "step.interests.otherPlaceholder": "Aggiungi un interesse personalizzato (opzionale)",
  "step.personality.title": "Come sono?",
  "step.personality.hint": "Seleziona tutto ciò che calza",
  "step.budget.title": "Qual è il tuo budget?",
  "step.detail.title": "Dicci una cosa su di loro",
  "step.detail.optional": "Opzionale — ma può migliorare molto i suggerimenti",
  "step.detail.placeholder": "es. Si è appena trasferita in una nuova casa.",
  "step.detail.examples":
    "Esempi: «Adora la Formula 1 e il caffè.» · «Dice di non volere niente.»",

  "loading.1": "Cerchiamo regali adatti a loro…",
  "loading.2": "Abbiniamo i loro interessi…",
  "loading.3": "Cerchiamo qualcosa che ameranno davvero…",

  "results.title": "Migliori match per {recipient}",
  "results.why": "Perché è adatto",
  "results.price": "Prezzo tipico: {range}",
  "results.priceFlexible": "Budget flessibile",
  "results.seeGift": "Vedi il regalo",
  "results.save": "Salva nella lista dei desideri",
  "results.moreLike": "Altri simili",
  "results.notForThem": "Non fa per loro",
  "results.saved": "Salvato nella tua lista dei desideri",
  "results.ideaOnly": "Idea regalo",
  "results.shopLater": "Link per lo shopping in arrivo",

  "feedback.title": "Vuoi match migliori?",
  "feedback.none": "Nessuna di queste sembra giusta",
  "feedback.missing": "Cosa manca?",
  "feedback.missingPlaceholder": "Dicci cosa ti sembrerebbe più giusto…",
  "feedback.apply": "Aggiorna i risultati",

  "crossSell.title": "Vuoi qualcosa di più personale?",
  "crossSell.portrait": "Crea un ritratto di Natale",
  "crossSell.santa": "Crea un video di Babbo Natale",
  "crossSell.card": "Invia un biglietto di Natale personalizzato",

  "error.generic": "Non abbiamo ancora trovato il match giusto. Regoliamo un dettaglio.",
  "error.rate": "Attendi un momento prima di cercare di nuovo.",
  "error.retry": "Riprova",

  "seo.section.recipient": "Trova regali in base al destinatario",
  "seo.section.budget": "Trova regali di Natale per budget",
  "seo.section.personality": "Regali di Natale per personalità",
  "seo.section.how": "Come funziona il ricercatore di regali di Natale",
  "seo.section.howBody":
    "Scegli il destinatario, condividi i suoi interessi e la sua personalità, imposta un budget e, se vuoi, aggiungi un dettaglio personale. Riceverai idee regalo ordinate con brevi spiegazioni — poi puoi affinare, ricominciare o salvare le idee nella tua lista dei desideri di Natale.",
  "seo.section.hasEverything": "Regali per chi ha già tutto",
  "seo.section.hasEverythingBody":
    "Quando qualcuno sembra avere già «tutto», i regali di Natale davvero utili tendono verso esperienze, ricordi personalizzati, upgrade per un hobby, momenti sentimentali o oggetti pratici di qualità. Scegliere la personalità «Ha già tutto» orienta il ricercatore in quella direzione invece che verso oggetti generici.",
  "seo.geo.title": "Cos’è un ricercatore di regali di Natale?",
  "seo.geo.body":
    "Un ricercatore di regali di Natale è uno strumento guidato che suggerisce idee regalo in base a per chi stai comprando, ai suoi interessi e alla sua personalità, e al tuo budget. Su TheDigitalGifter rispondi a un breve questionario e ricevi idee selezionate con una motivazione chiara sul perché potrebbero essere adatte — poi puoi affinare le risposte o salvare le idee in una lista dei desideri.",
  "seo.faq.title": "Domande frequenti",
  "seo.section.wishlist": "Salva le idee nella lista dei desideri",
  "seo.section.wishlistBody":
    "Ti piace un’idea? Salvala nella tua lista dei desideri di Natale e condividi un’unica lista con la famiglia, così gli acquisti restano coordinati.",

  "breadcrumb.christmas": "Natale",
  "breadcrumb.finder": "Ricercatore di regali",
};

/** European Portuguese (Portugal) — not Brazilian. */
const PT: Record<string, string> = {
  "seo.title": "Encontrador de Presentes de Natal | Encontre o Presente Perfeito | TheDigitalGifter",
  "seo.description":
    "Encontre ideias de presentes de Natal ponderadas com base em para quem está a comprar, nos seus interesses, na sua personalidade e no seu orçamento.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Encontrador de Presentes de Natal",
  "hero.h1": "Encontre um Presente de Natal Que Vão Mesmo Adorar",
  "hero.sub":
    "Diga-nos para quem está a comprar, do que gostam e o seu orçamento. Ajudamo-lo a encontrar ideias de presentes com carinho em poucos momentos.",
  "hero.cta": "Encontrar o Presente Deles",
  "hero.demo.for": "Para: Mãe, 58",
  "hero.demo.loves": "Adora: cozinha, viagens, casa",
  "hero.demo.budget": "Orçamento: 50–100 $",
  "hero.demo.match": "Melhor correspondência: Livro de receitas personalizado",
  "hero.demo.why":
    "Porque pode adorar: Combina o amor dela pela cozinha com algo pessoal e com significado.",
  "hero.demo.note": "Pré-visualização demo — não é um resultado ao vivo",

  "progress.of": "{current} de {total}",
  "nav.back": "Voltar",
  "nav.continue": "Continuar",
  "nav.skip": "Saltar",
  "nav.find": "Encontrar o Presente Deles",
  "nav.openWishlist": "Abrir Lista de Desejos",
  "nav.refine": "Afinar as Minhas Respostas",
  "nav.restart": "Começar de novo",

  "step.recipient.title": "Para quem está a comprar?",
  "step.age.title": "Que idade têm?",
  "step.interests.title": "Do que gostam?",
  "step.interests.hint": "Escolha alguns — até 6",
  "step.interests.other": "Outra coisa",
  "step.interests.otherPlaceholder": "Adicione um interesse personalizado (opcional)",
  "step.personality.title": "Como são?",
  "step.personality.hint": "Selecione tudo o que se adequa",
  "step.budget.title": "Qual é o seu orçamento?",
  "step.detail.title": "Diga-nos uma coisa sobre eles",
  "step.detail.optional": "Opcional — mas pode melhorar bastante as recomendações",
  "step.detail.placeholder": "ex. Acabou de se mudar para uma casa nova.",
  "step.detail.examples":
    "Exemplos: «Adora Fórmula 1 e café.» · «Diz que não quer nada.»",

  "loading.1": "A encontrar presentes que lhes assentam…",
  "loading.2": "A combinar os interesses deles…",
  "loading.3": "A procurar algo que vão mesmo adorar…",

  "results.title": "Melhores correspondências para {recipient}",
  "results.why": "Porque encaixa",
  "results.price": "Preço típico: {range}",
  "results.priceFlexible": "Orçamento flexível",
  "results.seeGift": "Ver Presente",
  "results.save": "Guardar na Lista de Desejos",
  "results.moreLike": "Mais Como Este",
  "results.notForThem": "Não É Para Eles",
  "results.saved": "Guardado na sua lista de desejos",
  "results.ideaOnly": "Ideia de presente",
  "results.shopLater": "Links de compra em breve",

  "feedback.title": "Quer melhores correspondências?",
  "feedback.none": "Nenhuma destas parece certa",
  "feedback.missing": "O que falta?",
  "feedback.missingPlaceholder": "Diga-nos o que se sentiria mais certo…",
  "feedback.apply": "Atualizar resultados",

  "crossSell.title": "Quer algo mais pessoal?",
  "crossSell.portrait": "Criar um Retrato de Natal",
  "crossSell.santa": "Fazer um Vídeo do Pai Natal",
  "crossSell.card": "Enviar um Cartão de Natal Personalizado",

  "error.generic": "Ainda não encontrámos a correspondência certa. Vamos ajustar um detalhe.",
  "error.rate": "Aguarde um pouco antes de procurar novamente.",
  "error.retry": "Tentar novamente",

  "seo.section.recipient": "Encontre Presentes por Destinatário",
  "seo.section.budget": "Encontre Presentes de Natal por Orçamento",
  "seo.section.personality": "Presentes de Natal por Personalidade",
  "seo.section.how": "Como Funciona o Encontrador de Presentes de Natal",
  "seo.section.howBody":
    "Escolha o destinatário, partilhe os seus interesses e personalidade, defina um orçamento e, opcionalmente, adicione um detalhe pessoal. Receberá ideias de presentes ordenadas com explicações curtas — depois pode afinar, recomeçar ou guardar ideias na sua Lista de Desejos de Natal.",
  "seo.section.hasEverything": "Presentes para Alguém Que Já Tem Tudo",
  "seo.section.hasEverythingBody":
    "Quando alguém parece já ter «tudo», os presentes de Natal úteis costumam inclinar-se para experiências, lembranças personalizadas, melhorias de um hobby, momentos sentimentais ou artigos práticos premium. Escolher a personalidade «Já tem tudo» orienta o encontrador nessa direção em vez de objetos genéricos.",
  "seo.geo.title": "O que é um Encontrador de Presentes de Natal?",
  "seo.geo.body":
    "Um Encontrador de Presentes de Natal é uma ferramenta guiada que recomenda ideias de presentes de Natal com base em para quem está a comprar, nos seus interesses e personalidade, e no seu orçamento. Na TheDigitalGifter, responde a um conjunto curto de perguntas e recebe ideias organizadas com razões claras para cada uma — depois pode afinar as respostas ou guardar ideias numa lista de desejos.",
  "seo.faq.title": "Perguntas Frequentes",
  "seo.section.wishlist": "Guarde ideias na sua lista de desejos",
  "seo.section.wishlistBody":
    "Gostou de uma ideia? Guarde-a na sua Lista de Desejos de Natal e partilhe uma única lista com a família para as compras ficarem coordenadas.",

  "breadcrumb.christmas": "Natal",
  "breadcrumb.finder": "Encontrador de Presentes",
};

const NL: Record<string, string> = {
  "seo.title": "Kerst Gift Finder | Vind het Perfecte Cadeau | TheDigitalGifter",
  "seo.description":
    "Vind doordachte kerstcadeau-ideeën op basis van voor wie je winkelt, hun interesses, persoonlijkheid en je budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Kerst Gift Finder",
  "hero.h1": "Vind een Kerstcadeau Dat Ze Écht Geweldig Vinden",
  "hero.sub":
    "Vertel ons voor wie je winkelt, waar ze van houden en je budget. We helpen je in een paar momenten doordachte cadeau-ideeën te vinden.",
  "hero.cta": "Vind Hun Cadeau",
  "hero.demo.for": "Voor: Mama, 58",
  "hero.demo.loves": "Houdt van: koken, reizen, huis",
  "hero.demo.budget": "Budget: $50–$100",
  "hero.demo.match": "Beste match: Gepersonaliseerd receptenboek",
  "hero.demo.why":
    "Waarom ze het geweldig kan vinden: Het combineert haar liefde voor koken met iets persoonlijks en betekenisvols.",
  "hero.demo.note": "Demo-voorbeeld — geen live resultaat",

  "progress.of": "{current} van {total}",
  "nav.back": "Terug",
  "nav.continue": "Doorgaan",
  "nav.skip": "Overslaan",
  "nav.find": "Vind Hun Cadeau",
  "nav.openWishlist": "Open Verlanglijstje",
  "nav.refine": "Pas Mijn Antwoorden Aan",
  "nav.restart": "Opnieuw beginnen",

  "step.recipient.title": "Voor wie winkelt je?",
  "step.age.title": "Hoe oud zijn ze?",
  "step.interests.title": "Waar houden ze van?",
  "step.interests.hint": "Kies er een paar — tot 6",
  "step.interests.other": "Iets anders",
  "step.interests.otherPlaceholder": "Voeg een eigen interesse toe (optioneel)",
  "step.personality.title": "Hoe zijn ze?",
  "step.personality.hint": "Selecteer alles wat past",
  "step.budget.title": "Wat is je budget?",
  "step.detail.title": "Vertel ons één ding over hen",
  "step.detail.optional": "Optioneel — maar het kan aanbevelingen veel beter maken",
  "step.detail.placeholder": "bijv. Ze is net verhuisd naar een nieuw huis.",
  "step.detail.examples":
    "Voorbeelden: “Hij houdt van Formule 1 en koffie.” · “Ze zegt dat ze niets wil.”",

  "loading.1": "Cadeaus zoeken die bij hen passen…",
  "loading.2": "Hun interesses matchen…",
  "loading.3": "Iets zoeken wat ze écht geweldig vinden…",

  "results.title": "Beste matches voor {recipient}",
  "results.why": "Waarom het past",
  "results.price": "Typische prijs: {range}",
  "results.priceFlexible": "Flexibel budget",
  "results.seeGift": "Bekijk Cadeau",
  "results.save": "Opslaan in Verlanglijstje",
  "results.moreLike": "Meer Zoals Dit",
  "results.notForThem": "Niet Voor Hen",
  "results.saved": "Opgeslagen in je verlanglijstje",
  "results.ideaOnly": "Cadeau-idee",
  "results.shopLater": "Shoplinks komen binnenkort",

  "feedback.title": "Wil je betere matches?",
  "feedback.none": "Geen van deze voelt goed",
  "feedback.missing": "Wat ontbreekt er?",
  "feedback.missingPlaceholder": "Vertel ons wat beter zou voelen…",
  "feedback.apply": "Resultaten bijwerken",

  "crossSell.title": "Wil je iets persoonlijkers?",
  "crossSell.portrait": "Maak een Kerstportret",
  "crossSell.santa": "Maak een Kerstmanvideo",
  "crossSell.card": "Stuur een Gepersonaliseerde Kerstdkaart",

  "error.generic": "We hebben nog niet de juiste match gevonden. Laten we één detail aanpassen.",
  "error.rate": "Wacht even voordat je opnieuw zoekt.",
  "error.retry": "Opnieuw proberen",

  "seo.section.recipient": "Vind Cadeaus per Ontvanger",
  "seo.section.budget": "Vind Kerstcadeaus per Budget",
  "seo.section.personality": "Kerstcadeaus per Persoonlijkheid",
  "seo.section.how": "Hoe de Kerst Gift Finder Werkt",
  "seo.section.howBody":
    "Kies de ontvanger, deel hun interesses en persoonlijkheid, stel een budget in en voeg optioneel één persoonlijk detail toe. Je krijgt gerangschikte cadeau-ideeën met korte uitleg — daarna kun je antwoorden aanpassen, opnieuw beginnen of ideeën opslaan in je Kerst Verlanglijstje.",
  "seo.section.hasEverything": "Cadeaus voor Iemand Die Alles Al Heeft",
  "seo.section.hasEverythingBody":
    "Wanneer iemand al ‘alles’ bezit, zijn nuttige kerstcadeaus vaak ervaringen, persoonlijke aandenkens, hobby-upgrades, sentimentele momenten, of praktische premiumartikelen. Het kiezen van de persoonlijkheid ‘Heeft alles al’ stuurt de finder in die richting in plaats van generieke rommel.",
  "seo.geo.title": "Wat is een Kerst Gift Finder?",
  "seo.geo.body":
    "Een Kerst Gift Finder is een begeleide tool die kerstcadeau-ideeën aanbeveelt op basis van voor wie je winkelt, hun interesses en persoonlijkheid, en je budget. Bij TheDigitalGifter beantwoord je een korte reeks vragen en krijg je uitgekozen ideeën met duidelijke redenen waarom ze kunnen passen — daarna kun je antwoorden aanpassen of ideeën opslaan in een verlanglijstje.",
  "seo.faq.title": "Veelgestelde Vragen",
  "seo.section.wishlist": "Sla ideeën op in je verlanglijstje",
  "seo.section.wishlistBody":
    "Bevalt een idee? Sla het op in je Kerst Verlanglijstje en deel één lijst met familie zodat het winkelen gecoördineerd blijft.",

  "breadcrumb.christmas": "Kerst",
  "breadcrumb.finder": "Gift Finder",
};

const PL: Record<string, string> = {
  "seo.title": "Wyszukiwarka Świątecznych Prezentów | Znajdź Idealny Prezent | TheDigitalGifter",
  "seo.description":
    "Znajdź przemyślane pomysły na świąteczne prezenty na podstawie tego, dla kogo kupujesz, jego zainteresowań, osobowości i Twojego budżetu.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Wyszukiwarka Świątecznych Prezentów",
  "hero.h1": "Znajdź Świąteczny Prezent, Który Naprawdę Pokochają",
  "hero.sub":
    "Powiedz nam, dla kogo kupujesz, co lubią i jaki masz budżet. Pomożemy Ci znaleźć przemyślane pomysły na prezenty w kilka chwil.",
  "hero.cta": "Znajdź Ich Prezent",
  "hero.demo.for": "Dla: Mama, 58",
  "hero.demo.loves": "Kocha: gotowanie, podróże, dom",
  "hero.demo.budget": "Budżet: 50–100 $",
  "hero.demo.match": "Najlepsze dopasowanie: Spersonalizowana książka kucharska",
  "hero.demo.why":
    "Dlaczego może to pokochać: Łączy jej miłość do gotowania z czymś osobistym i pełnym znaczenia.",
  "hero.demo.note": "Podgląd demo — to nie jest wynik na żywo",

  "progress.of": "{current} z {total}",
  "nav.back": "Wstecz",
  "nav.continue": "Dalej",
  "nav.skip": "Pomiń",
  "nav.find": "Znajdź Ich Prezent",
  "nav.openWishlist": "Otwórz Listę Życzeń",
  "nav.refine": "Doprecyzuj Moje Odpowiedzi",
  "nav.restart": "Zacznij od nowa",

  "step.recipient.title": "Dla kogo kupujesz?",
  "step.age.title": "Ile mają lat?",
  "step.interests.title": "Co lubią?",
  "step.interests.hint": "Wybierz kilka — maksymalnie 6",
  "step.interests.other": "Coś innego",
  "step.interests.otherPlaceholder": "Dodaj własne zainteresowanie (opcjonalnie)",
  "step.personality.title": "Jacy są?",
  "step.personality.hint": "Zaznacz wszystko, co pasuje",
  "step.budget.title": "Jaki masz budżet?",
  "step.detail.title": "Powiedz nam jedną rzecz o nich",
  "step.detail.optional": "Opcjonalne — ale może znacznie poprawić rekomendacje",
  "step.detail.placeholder": "np. Właśnie wprowadziła się do nowego domu.",
  "step.detail.examples":
    "Przykłady: „Uwielbia Formułę 1 i kawę.” · „Mówi, że niczego nie chce.”",

  "loading.1": "Szukamy prezentów, które do nich pasują…",
  "loading.2": "Dopasowujemy ich zainteresowania…",
  "loading.3": "Szukamy czegoś, co naprawdę pokochają…",

  "results.title": "Najlepsze dopasowania dla {recipient}",
  "results.why": "Dlaczego pasuje",
  "results.price": "Typowa cena: {range}",
  "results.priceFlexible": "Elastyczny budżet",
  "results.seeGift": "Zobacz Prezent",
  "results.save": "Zapisz w Liście Życzeń",
  "results.moreLike": "Więcej Takich",
  "results.notForThem": "Nie Dla Nich",
  "results.saved": "Zapisano w Twojej liście życzeń",
  "results.ideaOnly": "Pomysł na prezent",
  "results.shopLater": "Linki do sklepów już wkrótce",

  "feedback.title": "Chcesz lepszych dopasowań?",
  "feedback.none": "Żadne z tych nie wydaje się właściwe",
  "feedback.missing": "Czego brakuje?",
  "feedback.missingPlaceholder": "Powiedz nam, co byłoby bardziej trafne…",
  "feedback.apply": "Zaktualizuj wyniki",

  "crossSell.title": "Chcesz czegoś bardziej osobistego?",
  "crossSell.portrait": "Stwórz Świąteczny Portret",
  "crossSell.santa": "Zrób Film z Mikołajem",
  "crossSell.card": "Wyślij Spersonalizowaną Kartkę Świąteczną",

  "error.generic": "Nie znaleźliśmy jeszcze właściwego dopasowania. Dostosujmy jeden szczegół.",
  "error.rate": "Poczekaj chwilę, zanim wyszukasz ponownie.",
  "error.retry": "Spróbuj ponownie",

  "seo.section.recipient": "Znajdź Prezenty Według Odbiorcy",
  "seo.section.budget": "Znajdź Świąteczne Prezenty Według Budżetu",
  "seo.section.personality": "Świąteczne Prezenty Według Osobowości",
  "seo.section.how": "Jak Działa Wyszukiwarka Świątecznych Prezentów",
  "seo.section.howBody":
    "Wybierz odbiorcę, podaj jego zainteresowania i osobowość, ustaw budżet i opcjonalnie dodaj jeden osobisty szczegół. Otrzymasz ranking pomysłów na prezenty z krótkimi wyjaśnieniami — potem możesz doprecyzować, zacząć od nowa lub zapisać pomysły w swojej Świątecznej Liście Życzeń.",
  "seo.section.hasEverything": "Prezenty Dla Kogoś, Kto Ma Już Wszystko",
  "seo.section.hasEverythingBody":
    "Kiedy ktoś zdaje się mieć już „wszystko”, przydatne świąteczne prezenty zwykle kierują się w stronę doświadczeń, spersonalizowanych pamiątek, ulepszeń hobby, sentymentalnych chwil lub praktycznych, premium przedmiotów. Wybór osobowości „Ma już wszystko” kieruje wyszukiwarkę w te strony, a nie w generyczne dodatki.",
  "seo.geo.title": "Czym jest Wyszukiwarka Świątecznych Prezentów?",
  "seo.geo.body":
    "Wyszukiwarka Świątecznych Prezentów to narzędzie prowadzące krok po kroku, które poleca pomysły na świąteczne prezenty na podstawie tego, dla kogo kupujesz, jego zainteresowań i osobowości oraz Twojego budżetu. W TheDigitalGifter odpowiadasz na krótki zestaw pytań i otrzymujesz wyselekcjonowane pomysły z jasnymi powodami, dlaczego mogą się sprawdzić — a potem możesz doprecyzować odpowiedzi lub zapisać pomysły w liście życzeń.",
  "seo.faq.title": "Często Zadawane Pytania",
  "seo.section.wishlist": "Zapisz pomysły w swojej liście życzeń",
  "seo.section.wishlistBody":
    "Podobał Ci się pomysł? Zapisz go w swojej Świątecznej Liście Życzeń i udostępnij jedną listę rodzinie, żeby zakupy były skoordynowane.",

  "breadcrumb.christmas": "Boże Narodzenie",
  "breadcrumb.finder": "Wyszukiwarka Prezentów",
};

export const PACKS: Record<GiftFinderLocale, Record<string, string>> = {
  en: EN,
  ro: RO,
  de: DE,
  fr: FR,
  es: ES,
  it: IT,
  pt: PT,
  nl: NL,
  pl: PL,
};

/** Product UI keys that must be localized for Wave 1 (P3D coverage). */
export const REQUIRED_UI_KEYS = [
  "hero.h1",
  "hero.cta",
  "nav.back",
  "nav.continue",
  "nav.find",
  "nav.openWishlist",
  "nav.refine",
  "nav.restart",
  "step.recipient.title",
  "step.budget.title",
  "results.save",
  "results.seeGift",
  "error.generic",
  "error.retry",
  "crossSell.portrait",
] as const;

// Assert key parity: every locale pack must match EN key set (74 keys).
const _enKeySet = Object.keys(PACKS.en).sort().join("\0");
for (const loc of GIFT_FINDER_UI_LOCALES) {
  const keys = Object.keys(PACKS[loc]);
  if (keys.length !== Object.keys(PACKS.en).length || keys.sort().join("\0") !== _enKeySet) {
    throw new Error(`Gift Finder UI pack key mismatch for locale: ${loc}`);
  }
}

export function gfT(
  key: string,
  locale: GiftFinderLocale = "en",
  vars?: Record<string, string>,
): string {
  let text = PACKS[locale]?.[key] || PACKS.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
