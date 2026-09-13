/**
 * German (de) SEO content for the Christmas route family (P3B).
 * Natural German search-intent phrasing — not literal machine translation.
 * Honesty constraints: Santa video voice is EN/RO only today; message generator
 * text is EN/RO only today. German copy explains the experience without
 * promising a German-spoken Santa video or German-generated messages.
 */

/** @typedef {import("./_helpers.mjs")} Helpers */

/** @type {Record<string, {
 *   title: string,
 *   description: string,
 *   h1: string,
 *   lede: string,
 *   h2?: string,
 *   h2Body?: string,
 *   links?: Array<{ href: string, label: string }>,
 *   breadcrumbs?: Array<{ href: string, label: string }>,
 *   geo?: { h2: string, body: string },
 *   sections?: Array<{ h2: string, body: string, linkHref?: string, linkLabel?: string, list?: string[] }>,
 *   faqs?: Array<{ q: string, a: string }>,
 * }>} */
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Weihnachten bei TheDigitalGifter | Geschenke, Fotos, Weihnachtsmann und mehr",
    description:
      "Erstelle Weihnachtsgeschenke, KI-Weihnachtsporträts, ein Weihnachtsmann-Video, Wunschzettel, Karten und Adventsüberraschungen — persönliche digitale Weihnachtserlebnisse von TheDigitalGifter.",
    h1: "Schenke dieses Weihnachten etwas Unvergessliches",
    lede:
      "Entdecke Weihnachtsgeschenke, Foto-Porträts, ein Weihnachtsmann-Video, digitale Weihnachtsbäume, den Adventskalender, Weihnachtskarten und Weihnachtsgrüße — alles an einem Ort bei TheDigitalGifter.",
    h2: "Weihnachtserlebnisse",
    h2Body: "Wähle unten ein Weihnachtsprodukt und erstelle in wenigen Minuten etwas Persönliches.",
    links: [
      { href: "/de/christmas/gift-finder", label: "Das passende Weihnachtsgeschenk finden" },
      { href: "/de/christmas/wishlist", label: "Weihnachtswunschzettel erstellen" },
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas/santa-video", label: "Persönliches Weihnachtsmann-Video erstellen" },
      { href: "/de/christmas/tree", label: "Digitalen Weihnachtsbaum gestalten" },
      { href: "/de/christmas/advent", label: "Adventskalender öffnen" },
      { href: "/de/christmas/cards", label: "Weihnachtskarte erstellen" },
      { href: "/de/christmas/messages", label: "Weihnachtsgrüße finden" },
    ],
    breadcrumbs: [{ href: "/de/christmas", label: "Weihnachten" }],
    geo: {
      h2: "Was kannst du mit TheDigitalGifter zu Weihnachten erstellen?",
      body:
        "TheDigitalGifter ist eine Anlaufstelle für alles rund um Weihnachten. Du findest Geschenkideen mit dem Geschenke-Finder, verwandelst ein Foto in ein Weihnachtsporträt für Familie, Paare oder Haustiere, erstellst ein persönliches Weihnachtsmann-Video mit dem Namen der beschenkten Person, baust einen teilbaren Wunschzettel, gestaltest eine Weihnachtskarte mit Foto und Nachricht, schreibst Weihnachtsgrüße, dekorierst einen digitalen Weihnachtsbaum und öffnest tägliche Adventsüberraschungen. Starte an einer Stelle und wechsle zu dem Erlebnis, das zur Person passt, die du beschenken möchtest.",
    },
    sections: [
      {
        h2: "Finde das perfekte Weihnachtsgeschenk",
        body:
          "Unsicher, was du schenken sollst? Der Weihnachts-Geschenke-Finder fragt, für wen du einkaufst, was diese Person mag, wie sie im Leben steht und wie viel du ausgeben möchtest. Du erhältst durchdachte Geschenkideen mit einer kurzen Begründung, warum sie passen — auch für Menschen, die scheinbar schon alles haben. Speichere Favoriten in einem Wunschzettel, wenn du bereit bist.",
        linkHref: "/de/christmas/gift-finder",
        linkLabel: "Finde ein Geschenk, das wirklich ankommt",
      },
      {
        h2: "Zaubere magische Weihnachtsfotos",
        body:
          "Lade ein klares Foto hoch und verwandle es in ein festliches Weihnachtsporträt. Erstelle Looks für Familien, Paare und Haustiere — inklusive eigener Wege für Hunde und Katzen — und lade das Ergebnis privat herunter oder nutze es für eine Weihnachtskarte.",
        linkHref: "/de/christmas/photo-generator",
        linkLabel: "Verwandle dein Foto in Weihnachtsmagie",
      },
      {
        h2: "Eine persönliche Nachricht vom Weihnachtsmann",
        body:
          "Erstelle ein persönliches Weihnachtsvideo vom Weihnachtsmann. Nenne den Namen der beschenkten Person und optionale Details wie Alter, etwas, das sie gut gemacht hat, ein Hobby oder einen Weihnachtswunsch. Prüfe die Nachricht und erstelle dann ein Video zum Herunterladen und Teilen.",
        linkHref: "/de/christmas/santa-video",
        linkLabel: "Persönliches Weihnachtsmann-Video erstellen",
      },
      {
        h2: "Erstelle und teile einen Weihnachtswunschzettel",
        body:
          "Baue einen Weihnachtswunschzettel mit Produktlinks oder frei geschriebenen Wünschen. Teile einen einfachen Link mit Familie und Freunden. Betrachter können ein Geschenk reservieren, damit niemand dasselbe doppelt kauft — ohne der Person, für die der Wunschzettel ist, die Überraschung zu verraten.",
        linkHref: "/de/christmas/wishlist",
        linkLabel: "Weihnachtswunschzettel erstellen",
      },
      {
        h2: "Erstelle eine persönliche Weihnachtskarte",
        body:
          "Kombiniere ein Foto, ein festliches Kartendesign und eine persönliche Nachricht zu einer Weihnachtskarte, die du herunterladen oder digital teilen kannst. Nutze dein eigenes Foto oder ein bereits erstelltes Weihnachtsporträt.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Erstelle eine Weihnachtskarte, die man aufheben möchte",
      },
      {
        h2: "Weitere Weihnachtserlebnisse",
        body:
          "Du kannst außerdem einen digitalen Weihnachtsbaum mit Überraschungen bauen, im Dezember täglich ein Adventstürchen öffnen und mit dem Nachrichten-Generator die passenden Weihnachtsworte finden.",
        list: [
          "Digitaler Weihnachtsbaum → /de/christmas/tree",
          "Adventskalender → /de/christmas/advent",
          "Weihnachtsgrüße → /de/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "Was kann ich zu Weihnachten mit TheDigitalGifter erstellen?",
        a: "Du kannst Geschenkideen finden, Fotos in Weihnachtsporträts für Familien, Paare und Haustiere verwandeln, das Santa-Erlebnis starten, eine teilbare Wunschliste bauen, eine Karte gestalten, Nachrichten schreiben, einen digitalen Baum schmücken und Adventsüberraschungen öffnen. Wähle ein Erlebnis auf dieser Seite und bist in Minuten fertig.",
      },
      {
        q: "Kann der Weihnachtsmann den Namen meines Kindes sagen?",
        a: "Du kannst mit dem Vornamen auf der Weihnachtsseite oder im Santa-Erlebnis starten und optionale Details ergänzen. Gesprochene Videos sind derzeit für Englisch und Rumänisch verfügbar — andere Sprachen folgen.",
      },
      {
        q: "Brauche ich Design-Kenntnisse?",
        a: "Nein. Jedes Weihnachtserlebnis führt dich Schritt für Schritt — lade ein Foto hoch, beantworte ein paar Fragen oder starte mit einem Namen — und die Seite erledigt den Rest.",
      },
      {
        q: "Ist das für digitale Geschenke, physische Geschenke oder beides?",
        a: "Beides. Nutze den Geschenke-Finder und den Wunschzettel für Einkäufe überall, und erstelle digitale Porträts und Karten zum Sofort-Download oder Teilen.",
      },
      {
        q: "Funktioniert das auch auf dem Handy?",
        a: "Ja — der Weihnachts-Hub und die Produkterlebnisse sind zuerst für Handys gebaut und funktionieren auch am Desktop.",
      },
      {
        q: "Ist das Familienfoto privat?",
        a: "Uploads werden genutzt, um dein Porträt oder deine Karte zu erstellen. Kinder-Erlebnisse sind privacy-first und erwarten eine Erziehungsberechtigte Person. Fertige Ergebnisse lädst du privat herunter — wir veröffentlichen deine Fotos nicht.",
      },
      {
        q: "Wie lange dauert das Erstellen?",
        a: "Die meisten Erlebnisse dauern wenige Minuten. Geschenke-Finder und Nachrichten sind fast sofort fertig. Porträts, Karten und Santa führen dich Schritt für Schritt; bezahlte Kreationen laufen nach dem Checkout weiter.",
      },
      {
        q: "Brauche ich ein Konto, um zu starten?",
        a: "Du kannst sofort erkunden und starten. Manche Erlebnisse fragen bei Beitritt oder Checkout nach einer E-Mail, damit du Fortschritt speichern, dein Ergebnis erhalten oder dem Christmas Club beitreten kannst.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Weihnachts-Geschenke-Finder | Das perfekte Geschenk finden | TheDigitalGifter",
    description:
      "Finde durchdachte Weihnachtsgeschenkideen basierend darauf, für wen du einkaufst, ihre Interessen, ihre Persönlichkeit und dein Budget.",
    h1: "Finde ein Weihnachtsgeschenk, das wirklich ankommt",
    lede:
      "Beantworte ein paar Fragen zu der Person, für die du einkaufst, und erhalte persönliche Weihnachtsgeschenkideen passend zu Interessen, Persönlichkeit und Budget.",
    h2: "Passende Weihnachtstools",
    links: [
      { href: "/de/christmas/wishlist", label: "Weihnachtswunschzettel erstellen" },
      { href: "/de/christmas/photo-generator", label: "Weihnachtsfoto-Generator" },
      { href: "/de/christmas/tree", label: "Digitaler Weihnachtsbaum" },
      { href: "/de/christmas", label: "Alle Weihnachtserlebnisse" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/gift-finder", label: "Geschenke-Finder" },
    ],
    geo: {
      h2: "Was ist ein Weihnachts-Geschenke-Finder?",
      body:
        "Ein Weihnachts-Geschenke-Finder ist ein geführtes Tool, das Geschenkideen basierend darauf empfiehlt, für wen du einkaufst, welche Interessen und welche Persönlichkeit diese Person hat und wie hoch dein Budget ist. Bei TheDigitalGifter beantwortest du ein paar kurze Fragen und erhältst kuratierte Ideen mit einer klaren Begründung — danach kannst du Antworten anpassen oder Ideen in einem Wunschzettel speichern.",
    },
    sections: [
      {
        h2: "So funktioniert der Weihnachts-Geschenke-Finder",
        body:
          "Wähle die beschenkte Person, teile ihre Interessen und Persönlichkeit mit, setze ein Budget und füge optional ein persönliches Detail hinzu. Der Finder liefert bewertete Geschenkideen mit kurzen Erklärungen. Du kannst Antworten anpassen, neu starten oder Ideen in deinem Weihnachtswunschzettel speichern.",
        list: [
          "Für wen du einkaufst",
          "Interessen und Persönlichkeit",
          "Budgetrahmen",
          "Persönliche Geschenkideen mit Begründung",
        ],
      },
      {
        h2: "Geschenke nach beschenkter Person finden",
        body:
          "Der Geschenke-Finder deckt gängige Weihnachts-Einkaufsbeziehungen ab, damit die Empfehlungen passend bleiben. Nutze das Tool für Mama, Papa, Ehefrau, Ehemann, Freundin, Freund, Kinder, Teenager, Großeltern, Freunde, Kollegen und mehr. Eigene Landingpages je Person sind noch nicht verfügbar — starte den Finder und wähle die Person dort aus.",
        list: [
          "Mama",
          "Papa",
          "Ehefrau",
          "Ehemann",
          "Freundin",
          "Freund",
          "Kinder",
          "Teenager",
          "Großeltern",
          "Freunde",
          "Kollegen",
        ],
      },
      {
        h2: "Weihnachtsgeschenke nach Budget finden",
        body:
          "Wähle einen Budgetrahmen wie unter 25 €, 25–50 €, 50–100 €, 100–200 €, 200 €+ oder ohne festes Budget. Die Empfehlungen sind Geschenkideen mit typischen Preisspannen — keine Live-Bestände oder garantierte Verfügbarkeit bei Händlern.",
      },
      {
        h2: "Geschenke für Menschen, die schon alles haben",
        body:
          "Wenn jemand scheinbar bereits „alles hat“, gehen sinnvolle Weihnachtsgeschenke meist in Richtung Erlebnisse, persönliche Andenken, Hobby-Upgrades, sentimentale Momente oder hochwertige Alltagsgegenstände. Wählst du die Persönlichkeit „Hat schon alles“, lenkt der Finder die Vorschläge genau in diese Richtungen statt zu generischem Krempel.",
      },
      {
        h2: "Ideen im Wunschzettel speichern",
        body:
          "Gefällt dir eine Idee? Speichere sie in deinem Weihnachtswunschzettel und teile eine gemeinsame Liste mit der Familie, damit der Einkauf abgestimmt bleibt.",
        linkHref: "/de/christmas/wishlist",
        linkLabel: "Weihnachtswunschzettel öffnen",
      },
    ],
    faqs: [
      {
        q: "Wie funktioniert der Weihnachts-Geschenke-Finder?",
        a: "Du beantwortest ein paar kurze Fragen dazu, für wen du einkaufst, welche Interessen und Persönlichkeit diese Person hat und wie hoch dein Budget ist. Danach siehst du kuratierte Geschenkideen mit einer klaren Begründung, warum sie passen.",
      },
      {
        q: "Kann ich nach Budget suchen?",
        a: "Ja. Budgetbereiche sind ein zentraler Schritt im Finder.",
      },
      {
        q: "Finde ich auch Geschenke für Menschen, die schon alles haben?",
        a: "Ja. Die Persönlichkeitsoption „Hat schon alles“ lenkt die Ideen zu Erlebnissen, Personalisierung und sinnvollen Andenken.",
      },
      {
        q: "Kann ich es für Kinder oder Teenager nutzen?",
        a: "Ja. Wähle Kind oder Teenager (oder Tochter/Sohn mit Altersangabe), damit die Ideen altersgerecht bleiben.",
      },
      {
        q: "Kann ich Ideen in meinem Wunschzettel speichern?",
        a: "Ja. Nutze „Im Wunschzettel speichern“ bei einer Idee, um sie zu /de/christmas/wishlist hinzuzufügen.",
      },
      {
        q: "Sind die Empfehlungen wirklich persönlich?",
        a: "Ja. Die Empfehlungen berücksichtigen die beschenkte Person, Alter, Interessen, Persönlichkeit, Budget und ein optionales persönliches Detail.",
      },
      {
        q: "Zeigt das Tool echte Produkte an?",
        a: "Heute zeigt der Finder kuratierte Geschenkideen mit typischen Preisspannen. Live-Preise, Verfügbarkeit und Shop-Feeds sind noch nicht angebunden — wir erfinden keine genauen Lagerbestände oder Händlerpreise.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Weihnachtswunschzettel erstellen | Wunschliste anlegen & teilen",
    description:
      "Erstelle einen Weihnachtswunschzettel, füge Geschenke von überall hinzu und teile einen einfachen Link mit Familie und Freunden.",
    h1: "Erstelle einen Weihnachtswunschzettel und teile einen einfachen Link",
    lede:
      "Baue in wenigen Minuten einen teilbaren Weihnachtswunschzettel. Füge Geschenke aus jedem Shop hinzu oder schreibe eigene Wünsche und schicke einen Link an Familie und Freunde.",
    h2: "So funktioniert es",
    h2Body: "Erstelle deine Liste, füge Wünsche hinzu, teile einen Link und lass andere Geschenke abstimmen, ohne die Überraschung zu verraten.",
    links: [
      { href: "/de/christmas/gift-finder", label: "Weihnachts-Geschenke-Finder ausprobieren" },
      { href: "/de/christmas/tree", label: "Geschenke unter den digitalen Weihnachtsbaum legen" },
      { href: "/de/christmas/photo-generator", label: "Weihnachtsporträt hinzufügen" },
      { href: "/de/christmas", label: "Zurück zu Weihnachten" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/wishlist", label: "Wunschzettel" },
    ],
    geo: {
      h2: "Was ist ein Online-Weihnachtswunschzettel?",
      body:
        "Ein Online-Weihnachtswunschzettel ist eine teilbare Liste von Geschenken oder Erlebnissen, die sich jemand wünscht. Bei TheDigitalGifter erstellst du eine Liste, fügst Wünsche über Produktlinks oder freien Text hinzu, teilst einen Link mit Familie und Freunden und lässt andere Geschenke reservieren, damit der Einkauf abgestimmt bleibt, ohne die Überraschung zu verraten.",
    },
    sections: [
      {
        h2: "Weihnachtswunschzettel online erstellen",
        body:
          "Gib deiner Liste einen Namen, füge Wünsche hinzu und halte alle Weihnachtsideen an einem Ort, statt Links über verschiedene Chats zu verteilen. Du kannst sofort starten und die Liste jederzeit bearbeiten.",
      },
      {
        h2: "Füge alles hinzu, was du dir wünschst",
        body:
          "Füge einen Produktlink aus fast jedem Shop ein, schreibe einen eigenen Wunsch, ergänze Notizen und nimm auch Erlebnisse oder selbstgemachte Ideen auf. Lässt sich ein Link nicht automatisch auslesen, kannst du den Wunsch trotzdem von Hand speichern.",
      },
      {
        h2: "Teile einen einfachen Link",
        body:
          "Aktiviere das Teilen und schicke einen Wunschzettel-Link per Kopieren, WhatsApp, E-Mail oder das Teilen-Menü deines Geräts. Geteilte Listen sind für Personen mit dem Link erreichbar und nicht für Suchmaschinen gedacht.",
      },
      {
        h2: "Doppelte Weihnachtsgeschenke vermeiden",
        body:
          "Betrachter können auf „Das kaufe ich“ tippen, um ein Geschenk zu reservieren. Reservierungen bleiben für die Person, für die der Wunschzettel ist, anonym — so bleibt die Überraschung erhalten, während die Familie vermeidet, dasselbe doppelt zu kaufen.",
      },
      {
        h2: "Weihnachtswunschzettel für Kinder und Familien",
        body:
          "Erstelle eine Liste für dich, dein Kind oder jemand anderen und teile sie dann mit Großeltern und Freunden. Kombiniere sie mit dem Geschenke-Finder, wenn du nicht weißt, was du dir wünschen sollst.",
        linkHref: "/de/christmas/gift-finder",
        linkLabel: "Weihnachts-Geschenke-Finder ausprobieren",
      },
    ],
    faqs: [
      {
        q: "Wie erstelle ich einen Weihnachtswunschzettel?",
        a: "Öffne die Weihnachtswunschzettel-Seite, wähle einen Titel und lege deine Liste an. Danach kannst du sofort Wünsche hinzufügen.",
      },
      {
        q: "Kann ich Geschenke aus jedem Shop hinzufügen?",
        a: "Ja. Füge einen normalen Produktlink ein oder trage das Geschenk manuell ein, falls die Seite nicht automatisch ausgelesen werden kann.",
      },
      {
        q: "Kann ich Wünsche auch ohne Link hinzufügen?",
        a: "Ja. Schreibe jeden beliebigen Wunsch — Erlebnisse, selbstgemachte Ideen oder ein einfaches „Überrasch mich“.",
      },
      {
        q: "Kann ich einen Wunschzettel-Link teilen?",
        a: "Ja. Aktiviere das Teilen und schicke den Link an Familie und Freunde.",
      },
      {
        q: "Können andere Geschenke reservieren?",
        a: "Ja. Betrachter können ein Geschenk reservieren, damit andere wissen, dass es bereits abgedeckt ist.",
      },
      {
        q: "Erfahre ich, wer etwas gekauft hat?",
        a: "Nein. Reservierungen bleiben anonym, damit die Überraschung erhalten bleibt.",
      },
      {
        q: "Kann ich einen Wunschzettel für mein Kind erstellen?",
        a: "Ja. Wähle beim Erstellen aus, für wen die Liste ist, und teile den Link dann mit Verwandten.",
      },
      {
        q: "Kann ich ihn nach dem Teilen noch bearbeiten?",
        a: "Ja. Füge Wünsche jederzeit hinzu, bearbeite, ordne neu oder entferne sie. Personen mit dem Link sehen die Aktualisierungen.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "KI-Weihnachtsfoto-Generator | Familie, Paare & Haustiere",
    description:
      "Verwandle dein liebstes Foto in ein magisches Weihnachtsporträt. Erstelle festliche Fotos für Familie, Paare und Haustiere in wenigen Minuten.",
    h1: "Verwandle dein Foto in Weihnachtsmagie",
    lede:
      "Lade ein Foto hoch, wähle eine festliche Weihnachtsszene und erstelle ein persönliches Weihnachtsporträt zum Herunterladen und privaten Teilen.",
    h2: "Weihnachtsfoto-Stile",
    h2Body: "Erstelle Porträts für Familie, Paare, Haustiere, Hunde und Katzen aus einem einzigen Weihnachtsfoto-Erlebnis.",
    links: [
      { href: "/de/christmas/family", label: "Familien-Weihnachtsporträts" },
      { href: "/de/christmas/couples", label: "Weihnachtsporträts für Paare" },
      { href: "/de/christmas/pets", label: "Weihnachtsporträts für Haustiere" },
      { href: "/de/christmas/dogs", label: "Weihnachtsporträts für Hunde" },
      { href: "/de/christmas/cats", label: "Weihnachtsporträts für Katzen" },
      { href: "/de/christmas/cards", label: "Porträt in eine Weihnachtskarte verwandeln" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
    ],
    geo: {
      h2: "Was ist ein KI-Weihnachtsfoto-Generator?",
      body:
        "Ein KI-Weihnachtsfoto-Generator verwandelt ein hochgeladenes Foto in ein festliches Weihnachtsporträt. Bei TheDigitalGifter wählst du, wer auf dem Foto zu sehen ist, entscheidest dich für einen Weihnachtsstil und erstellst ein herunterladbares Porträt für Familie, Paare, Personen oder Haustiere — standardmäßig privat.",
    },
    sections: [
      {
        h2: "Verwandle dein Foto in ein Weihnachtsporträt",
        body:
          "Lade ein Lieblingsfoto hoch, wähle die Art des Motivs, entscheide dich für einen weihnachtlichen Look und erstelle ein festliches Porträt zum Herunterladen. Ziel ist ein Winterbild, das trotzdem wie die Menschen oder Haustiere aussieht, die du liebst.",
      },
      {
        h2: "Beispiele für Weihnachtsfotos",
        body:
          "Demo-Beispiele zeigen gängige Richtungen für Weihnachtsporträts. Es handelt sich um Inspirationsbeispiele, nicht um Kundenfotos.",
        list: [
          "Familien-Weihnachtsfoto — ein Gruppenporträt in gemütlicher Weihnachtsszene",
          "Paar-Weihnachtsporträt — ein romantisches Winterporträt von zwei Personen",
          "Hunde-Weihnachtsporträt — ein festliches Porträt mit Fokus auf den Hund",
          "Katzen-Weihnachtsporträt — ein festliches Porträt mit Fokus auf die Katze",
          "Familie + Haustier — Menschen und ein Haustier in einem gemeinsamen Weihnachtsbild",
        ],
      },
      {
        h2: "Weihnachtsfoto-Stile",
        body:
          "Verfügbare Weihnachtsstile sind unter anderem Gemütliche Weihnacht, Winterwunderland, Luxus-Weihnacht, Weihnachtsmorgen, Verschneite Hütte, Klassische Weihnacht, Elegante weiße Weihnacht und Weihnachtsmarkt. Wähle den Look, der zur gewünschten Erinnerung passt.",
      },
      {
        h2: "Welche Fotos funktionieren am besten?",
        body:
          "Nutze ein klares Foto mit gut erkennbaren Gesichtern (oder einem deutlich sichtbaren Haustier), guter Beleuchtung und ausreichender Schärfe, damit alle Personen im Porträt erkennbar bleiben. Vermeide starke Unschärfe, harte Ausschnitte oder Fotos, auf denen wichtige Personen verdeckt sind.",
      },
      {
        h2: "Weihnachtsfotos für Familien, Paare und Haustiere",
        body:
          "Suchst du einen gezielteren Einstieg? Nutze die eigenen Wege für Familie, Paare, Haustiere, Hunde und Katzen — oder bleib hier für den vollständigen Foto-Generator.",
        list: [
          "Familien-Weihnachtsporträts → /de/christmas/family",
          "Weihnachtsporträts für Paare → /de/christmas/couples",
          "Weihnachtsporträts für Haustiere → /de/christmas/pets",
          "Weihnachtsporträts für Hunde → /de/christmas/dogs",
          "Weihnachtsporträts für Katzen → /de/christmas/cats",
          "Porträt in eine Weihnachtskarte verwandeln → /de/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "Wie funktioniert der Weihnachtsfoto-Generator?",
        a: "Lade ein Foto hoch, wähle, wer darauf zu sehen ist, entscheide dich für einen Weihnachtsstil und erstelle dein Porträt — je nach Ablauf nach dem Bezahlvorgang.",
      },
      {
        q: "Welches Foto sollte ich hochladen?",
        a: "Ein klares Foto mit gut erkennbaren Gesichtern oder einem gut sichtbaren Haustier funktioniert am besten. Gute Beleuchtung hilft. Vermeide starke Unschärfe.",
      },
      {
        q: "Kann ich ein Familien-Weihnachtsfoto erstellen?",
        a: "Ja. Wähle Familie als Motiv oder starte direkt auf der Familien-Seite.",
      },
      {
        q: "Kann ich ein Weihnachtsporträt meines Hundes oder meiner Katze erstellen?",
        a: "Ja. Haustier-Motive werden unterstützt, mit eigenen Wegen für Hunde und Katzen für einen klareren Einstieg.",
      },
      {
        q: "Können mehrere Personen enthalten sein?",
        a: "Ja, bei Familien- und Paar-Abläufen. Lade ein Foto hoch, auf dem alle zu sehenden Personen enthalten sind.",
      },
      {
        q: "Kann ich verschiedene Stile ausprobieren?",
        a: "Ja. Wähle vor dem Erstellen aus den auf der Seite verfügbaren Weihnachtsstilen.",
      },
      {
        q: "Kann ich das Ergebnis herunterladen?",
        a: "Ja. Wenn dein Porträt fertig ist, lade es über den Ergebnisbildschirm herunter.",
      },
      {
        q: "Was passiert mit meinem hochgeladenen Foto?",
        a: "Uploads und Ergebnisse sind standardmäßig privat. Es gibt keine öffentliche Galerie. Der Zugriff erfolgt über deinen Bestell-/Ergebnisablauf.",
      },
    ],
  },

  "/christmas/family": {
    title: "Familien-Weihnachtsfoto-Generator | Weihnachtsporträts für die Familie",
    description:
      "Erstelle ein persönliches Familien-Weihnachtsporträt aus deinem liebsten Familienfoto. Wähle eine festliche Weihnachtsszene und verwandle dein Foto in eine Erinnerung.",
    h1: "Verwandle dein Familienfoto in ein magisches Weihnachtsporträt",
    lede:
      "Erstelle ein persönliches Familien-Weihnachtsporträt aus deinem liebsten Familienfoto. Wähle eine festliche Weihnachtsszene und verwandle dein Foto in eine Erinnerung.",
    h2: "Weitere Weihnachtsporträts",
    links: [
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas/couples", label: "Weihnachtsporträts für Paare" },
      { href: "/de/christmas/pets", label: "Weihnachtsporträts für Haustiere" },
      { href: "/de/christmas/cards", label: "Weihnachtskarten-Ersteller" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
      { href: "/de/christmas/family", label: "Familie" },
    ],
    geo: {
      h2: "Was ist ein Familien-Weihnachtsfoto-Generator?",
      body:
        "Ein Familien-Weihnachtsfoto-Generator verwandelt ein hochgeladenes Familienfoto in ein festliches Gruppen-Weihnachtsporträt. Bei TheDigitalGifter lädst du ein klares Foto deiner Familie hoch, wählst einen für mehrere Personen geeigneten Weihnachtsstil und erstellst ein herunterladbares Porträt — standardmäßig privat, mit der Option, direkt in eine Weihnachtskarte weiterzugehen.",
    },
    sections: [
      {
        h2: "Erstelle ein Familien-Weihnachtsporträt",
        body:
          "Dieses Erlebnis ist speziell für Familien gebaut — kein generischer Einzelperson-Look. Lade ein Gruppenfoto hoch, wähle eine Weihnachtsstimmung und erstelle ein Porträt, das darauf abzielt, alle im Bild zu behalten.",
      },
      {
        h2: "Beispiele für Familien-Weihnachtsfotos",
        body:
          "Demo-Beispiele zeigen Richtungen für Familien-Weihnachtsporträts. Es handelt sich um Inspirationsbeispiele, nicht um Kundenfotos.",
        list: [
          "Eltern mit Kindern in gemütlichem Weihnachtszimmer",
          "Drei- oder vierköpfige Familie am geschmückten Baum",
          "Größere Familienfeier in festlicher Szene",
          "Mehrgenerationen-Porträts inklusive Großeltern",
          "Familie plus deutlich sichtbares Haustier im selben Bild",
        ],
      },
      {
        h2: "Weihnachtsstile für Familien",
        body:
          "Aktuell verfügbare Familienstile sind Klassische Familien-Weihnacht, Gemütlicher Kamin, Winterwunderland, Elegante Weihnacht, Weihnachtsmorgen, Luxus-Weihnacht, Weihnachtsfilm und Vintage-Familien-Weihnacht.",
      },
      {
        h2: "Welche Familienfotos funktionieren am besten?",
        body:
          "Nutze ein klares Gruppenfoto mit gut erkennbaren Gesichtern, ordentlicher Beleuchtung und allen Personen, die im Porträt erkennbar sein sollen. Vermeide starke Unschärfe, harte Ausschnitte oder Fotos, auf denen wichtige Personen verdeckt sind.",
      },
      {
        h2: "Weihnachtskarten für die Familie",
        body:
          "Wenn dein Familienporträt fertig ist, kannst du direkt zum Weihnachtskarten-Ersteller wechseln und mit einer Nachricht abschließen.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Verwandle dein Familienporträt in eine Weihnachtskarte",
      },
      {
        h2: "Weitere Weihnachtsporträts",
        body: "Suchst du ein anderes Motiv? Starte beim vollständigen Foto-Generator oder wechsle zu Paaren und Haustieren.",
        list: [
          "KI-Weihnachtsfoto-Generator → /de/christmas/photo-generator",
          "Weihnachtsporträts für Paare → /de/christmas/couples",
          "Weihnachtsporträts für Haustiere → /de/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Kann ich aus einem Familienfoto ein Weihnachtsporträt erstellen?",
        a: "Ja. Lade ein klares Familienfoto hoch, wähle einen Weihnachtsstil und erstelle dein Familienporträt.",
      },
      {
        q: "Können mehrere Personen enthalten sein?",
        a: "Ja. Dieser Weg ist für Gruppen gedacht. Achte darauf, dass alle Personen im Originalfoto gut sichtbar sind.",
      },
      {
        q: "Können Großeltern dabei sein?",
        a: "Ja. Mehrgenerationen-Fotos — inklusive Großeltern und Babys — sind willkommen, solange die Gesichter sichtbar sind.",
      },
      {
        q: "Kann ich ein Haustier der Familie einbeziehen?",
        a: "Ja, wenn das Haustier auf dem Familienfoto gut sichtbar ist. Für reine Haustier-Porträts eignen sich die Erlebnisse für Haustiere, Hunde oder Katzen besser.",
      },
      {
        q: "Welche Fotos funktionieren am besten?",
        a: "Klare Fotos mit gut sichtbaren Gesichtern, guter Beleuchtung und allen gewünschten Personen im Bild. Vermeide starke Unschärfe.",
      },
      {
        q: "Kann ich mehrere Weihnachtsstile ausprobieren?",
        a: "Ja. Wähle aus den auf der Seite gezeigten Familienstilen, und du kannst nach dem Erstellen einen weiteren Stil ausprobieren.",
      },
      {
        q: "Kann ich das fertige Porträt herunterladen?",
        a: "Ja. Wenn dein Porträt fertig ist, lade es über den Ergebnisbildschirm herunter.",
      },
      {
        q: "Kann ich es in einer Weihnachtskarte verwenden?",
        a: "Ja. Die Übergabe des Porträts in den Weihnachtskarten-Ersteller wird unterstützt.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Weihnachtsfoto-Generator für Paare | Romantische Weihnachtsporträts",
    description:
      "Erstelle ein romantisches Weihnachtsporträt für Paare aus eurem Foto. Perfekt für das erste gemeinsame Weihnachten oder als persönliches Geschenk für zwei.",
    h1: "Erschaffe zusammen ein magisches Weihnachtsporträt",
    lede:
      "Lade ein Foto von euch beiden hoch und erstelle ein romantisches Weihnachtsporträt für Paare — standardmäßig privat.",
    h2: "Weitere Weihnachtsporträts",
    links: [
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas/family", label: "Familien-Weihnachtsporträts" },
      { href: "/de/christmas/pets", label: "Weihnachtsporträts für Haustiere" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
      { href: "/de/christmas/couples", label: "Paare" },
    ],
    geo: {
      h2: "Was ist ein Weihnachtsfoto-Generator für Paare?",
      body:
        "Ein Weihnachtsfoto-Generator für Paare verwandelt ein Foto von zwei Personen in ein romantisches oder gemütliches Weihnachtsporträt. Bei TheDigitalGifter lädst du ein Foto hoch, auf dem ihr beide zu sehen seid, wählst einen Paar-Weihnachtsstil und erstellst ein herunterladbares Porträt, das du privat teilen oder in einer Weihnachtskarte verwenden kannst.",
    },
    sections: [
      {
        h2: "Erschafft gemeinsam ein Weihnachtsporträt",
        body:
          "Dieses Erlebnis ist für zwei Personen gedacht — Partner, Verlobte, Ehepaare oder Freund und Freundin. Lade ein Foto hoch, auf dem ihr beide gut sichtbar seid, wähle einen weihnachtlichen Look und erstelle ein Porträt genau für euch zwei.",
      },
      {
        h2: "Ideen für Weihnachtsfotos zu zweit",
        body: "Anwendungsfälle, für die dieses Porträt oft passt — als Inspiration, nicht als eigene Produktmodi:",
        list: [
          "Erstes gemeinsames Weihnachten",
          "Weihnachtsporträt für Verlobte",
          "Weihnachtsporträt für Ehepaare",
          "Weihnachtsfoto für Freund und Freundin",
          "Weihnachtsüberraschung über die Distanz zum digitalen Teilen",
          "Weihnachtskartenfoto für Paare",
        ],
      },
      {
        h2: "Romantische Weihnachtsstile",
        body:
          "Aktuell verfügbare Paar-Stile sind Romantischer Schneefall, Gemütlicher Kamin, Weihnachtsfilm, Elegante Weihnacht, Winterliche Stadt, Weihnachtsmarkt, Klassisches Porträt und Vintage-Weihnacht.",
      },
      {
        h2: "Welche Paarfotos funktionieren am besten?",
        body:
          "Nutze ein klares Foto, auf dem beide Gesichter sichtbar sind und niemand stark abgeschnitten ist. Gute Beleuchtung hilft. Auch Selfies können funktionieren, wenn beide Personen erkennbar sind.",
      },
      {
        h2: "Verwandle es in eine Weihnachtskarte",
        body: "Nachdem euer Paarporträt fertig ist, könnt ihr es direkt in den Weihnachtskarten-Ersteller mitnehmen.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Verwandle euer Paarporträt in eine Weihnachtskarte",
      },
      {
        h2: "Verwandte Weihnachtsporträts",
        body: "Braucht ihr stattdessen ein Familien- oder Haustierporträt?",
        list: [
          "Familien-Weihnachtsporträts → /de/christmas/family",
          "KI-Weihnachtsfoto-Generator → /de/christmas/photo-generator",
          "Weihnachtsporträts für Haustiere → /de/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Kann ich ein Selfie verwenden?",
        a: "Ja, wenn beide Personen auf demselben Foto gut sichtbar und erkennbar sind.",
      },
      {
        q: "Bleiben beide Personen erkennbar?",
        a: "Das ist das Ziel. Beginne mit einem klaren Foto beider Gesichter — vermeide starke Unschärfe oder eine Person, die größtenteils außerhalb des Bildes ist.",
      },
      {
        q: "Kann ich ein romantisches Weihnachtsporträt erstellen?",
        a: "Ja. Wähle romantische oder gemütliche Paar-Stile wie Romantischer Schneefall, Gemütlicher Kamin oder Elegante Weihnacht.",
      },
      {
        q: "Kann ich verschiedene Stile ausprobieren?",
        a: "Ja. Wähle vor dem Erstellen aus den Paar-Weihnachtsstilen auf der Seite.",
      },
      {
        q: "Kann ich das Ergebnis als Weihnachtskarte verwenden?",
        a: "Ja. Die Übergabe des Porträts in den Weihnachtskarten-Ersteller wird unterstützt.",
      },
      {
        q: "Kann ich es herunterladen?",
        a: "Ja. Lade das fertige Paarporträt über den Ergebnisbildschirm herunter, sobald es fertig ist.",
      },
      {
        q: "Welches Foto sollte ich hochladen?",
        a: "Ein klares Foto, auf dem ihr beide zu sehen seid. Gesichter sollten sichtbar sein; JPEG, PNG oder WebP funktionieren.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Weihnachtsfoto-Generator für Haustiere | Festliche Tierporträts",
    description: "Verwandle das Foto deines Haustiers in ein festliches Weihnachtsporträt. Hunde und Katzen willkommen — standardmäßig privat.",
    h1: "Verwandle dein Haustier in Weihnachtsmagie",
    lede: "Lade ein klares Foto deines Haustiers hoch und erstelle ein festliches Weihnachts-Tierporträt für Hunde oder Katzen.",
    h2: "Tierartspezifische Weihnachtsporträts",
    links: [
      { href: "/de/christmas/dogs", label: "Weihnachtsporträts für Hunde" },
      { href: "/de/christmas/cats", label: "Weihnachtsporträts für Katzen" },
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
      { href: "/de/christmas/pets", label: "Haustiere" },
    ],
    geo: {
      h2: "Was ist ein Weihnachtsfoto-Generator für Haustiere?",
      body:
        "Ein Weihnachtsfoto-Generator für Haustiere verwandelt das Foto eines Hundes, einer Katze oder eines anderen Haustiers in ein festliches Weihnachts-Tierporträt. Bei TheDigitalGifter ist die Haustiere-Seite die zentrale Anlaufstelle für tierische Weihnachtsporträts, mit eigenen Wegen für Hunde und Katzen, herunterladbaren Ergebnissen und der optionalen Übergabe in eine Weihnachtskarte.",
    },
    sections: [
      {
        h2: "Verwandle dein Haustier in Weihnachtsmagie",
        body:
          "Lade ein klares Foto deines Haustiers hoch, wähle einen Weihnachtsstil für Tiere und erstelle ein festliches Porträt des Tieres, das du liebst. Dies ist die allgemeine Anlaufstelle für Haustiere — kein spezielles Comic-Set.",
      },
      {
        h2: "Weihnachtsporträts für Hunde und Katzen",
        body:
          "Möchtest du einen klareren Einstieg für eine Tierart? Nutze die spezialisierten Wege für Hund oder Katze — sie helfen bei der Fotoprüfung und halten das Erlebnis hund- oder katzenspezifisch.",
        list: [
          "Weihnachtsfoto-Generator für Hunde → /de/christmas/dogs",
          "Weihnachtsfoto-Generator für Katzen → /de/christmas/cats",
        ],
      },
      {
        h2: "Beispiele für Haustier-Weihnachtsfotos",
        body: "Demo-Richtungen für Weihnachtsporträts von Haustieren. Die Beispiele sind Inspiration, keine Kundenfotos.",
        list: [
          "Hunde-Weihnachtsporträt in festlicher Szene",
          "Katzen-Weihnachtsporträt am Baum oder am Kamin",
          "Gemütlicher Pullover- oder Weihnachtsmann-inspirierter Tierstil",
        ],
      },
      {
        h2: "Weihnachtsstile für Haustiere",
        body:
          "Aktuell verfügbare Tierstile sind Weihnachtsmann-Haustier, Gemütliche Weihnacht, Nordpol, Weihnachtspullover, Schneeporträt, Weihnachtskarte, Königliche Weihnacht und Vintage-Weihnacht.",
      },
      {
        h2: "Welche Haustierfotos funktionieren am besten?",
        body:
          "Wähle ein klares Foto, auf dem Gesicht und Augen des Haustiers gut sichtbar sind, mit ordentlicher Beleuchtung und ohne starke Unschärfe. Sollen mehrere Tiere erscheinen, achte darauf, dass jedes Tier auf dem Foto sichtbar ist.",
      },
      {
        h2: "Weihnachtskarten mit Haustieren",
        body: "Du kannst ein fertiges Haustierporträt in den Weihnachtskarten-Ersteller mitnehmen.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Verwandle dein Haustierporträt in eine Weihnachtskarte",
      },
    ],
    faqs: [
      {
        q: "Kann ich ein Weihnachtsporträt meines Hundes erstellen?",
        a: "Ja. Starte hier oder gehe zur eigenen Seite für Hunde-Weihnachtsporträts für einen hundespezifischen Weg.",
      },
      {
        q: "Kann ich eines für meine Katze erstellen?",
        a: "Ja. Nutze diese Haustiere-Seite oder die eigene Seite für Katzen-Weihnachtsporträts.",
      },
      {
        q: "Kann ich mehr als ein Haustier einbeziehen?",
        a: "Wenn mehrere Tiere auf einem Foto gut sichtbar sind, kannst du dieses Foto verwenden. Die Ergebnisse sind am besten, wenn das Gesicht jedes Tieres gut erkennbar ist.",
      },
      {
        q: "Kann ich mich selbst mit meinem Haustier einbeziehen?",
        a: "Dieser Weg ist darauf ausgelegt, das Haustier im Mittelpunkt zu haben. Für Familienbilder mit Mensch und Tier ist das Familien-Weihnachtserlebnis oft der bessere Einstieg.",
      },
      {
        q: "Welche Fotos funktionieren am besten?",
        a: "Klare Haustierfotos mit gut sichtbaren Augen und Gesicht, guter Beleuchtung und wenig Unschärfe.",
      },
      {
        q: "Kann ich das Bild herunterladen?",
        a: "Ja. Lade es über den Ergebnisbildschirm herunter, wenn dein Haustierporträt fertig ist.",
      },
      {
        q: "Kann ich es für eine Weihnachtskarte verwenden?",
        a: "Ja. Die Übergabe des Porträts in den Weihnachtskarten-Ersteller wird unterstützt.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Weihnachtsfoto-Generator für Hunde | Festliche Hundeporträts",
    description: "Erstelle ein magisches Weihnachtsporträt deines Hundes aus einem klaren Foto. Tierart-geprüft und standardmäßig privat.",
    h1: "Erstelle ein magisches Weihnachtsporträt deines Hundes",
    lede: "Lade ein klares Foto deines Hundes hoch, wähle einen festlichen Stil und erstelle ein Weihnachtsporträt für Hunde.",
    h2: "Verwandte Haustierporträts",
    links: [
      { href: "/de/christmas/cats", label: "Weihnachtsporträts für Katzen" },
      { href: "/de/christmas/pets", label: "Alle Weihnachtsporträts für Haustiere" },
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
      { href: "/de/christmas/pets", label: "Haustiere" },
      { href: "/de/christmas/dogs", label: "Hunde" },
    ],
    geo: {
      h2: "Was ist ein Weihnachtsfoto-Generator für Hunde?",
      body:
        "Ein Weihnachtsfoto-Generator für Hunde erstellt aus einem Foto deines Hundes ein festliches Weihnachtsporträt. Bei TheDigitalGifter lädst du ein klares Hundefoto hoch, wählst einen weihnachtlichen Tierstil und lädst ein hundefokussiertes Winterporträt herunter — mit optionalem Weg zu einer Weihnachtskarte.",
    },
    sections: [
      {
        h2: "Erstelle ein Weihnachtsporträt deines Hundes",
        body:
          "Diese Seite ist hundespezifisch. Lade ein Foto deines Hundes hoch, wähle einen Weihnachtsstil und erstelle ein Winterporträt, das den Hund klar als Motiv behält. Sieht das Foto wie eine Katze aus, wirst du zum Katzen-Erlebnis weitergeleitet.",
      },
      {
        h2: "Beispiele für Hunde-Weihnachtsporträts",
        body: "Demo-Richtungen für Hunde-Weihnachtsporträts — Inspirationsbeispiele, keine Kundenfotos.",
        list: [
          "Hund neben einem geschmückten Weihnachtsbaum",
          "Gemütliches Kamin-Weihnachtsporträt mit Hund",
          "Verschneites Weihnachtsporträt mit Hund",
          "Weihnachtsmann-inspirierter oder Pullover-Stil für Hunde",
        ],
      },
      {
        h2: "Weihnachtsstile für Hunde",
        body:
          "Hundeporträts nutzen die Weihnachts-Tierstil-Auswahl: Weihnachtsmann-Haustier, Gemütliche Weihnacht, Nordpol, Weihnachtspullover, Schneeporträt, Weihnachtskarte, Königliche Weihnacht und Vintage-Weihnacht.",
      },
      {
        h2: "So wählst du ein gutes Hundefoto",
        body:
          "Wähle ein Foto, auf dem Augen und Gesicht deines Hundes sichtbar sind, der Kopf nicht stark abgeschnitten ist und die Unschärfe gering bleibt. Bei mehreren Hunden achte darauf, dass jeder gewünschte Hund gut im Bild ist.",
      },
      {
        h2: "Weihnachtskarten mit deinem Hund",
        body: "Fertige Hundeporträts können direkt in den Weihnachtskarten-Ersteller weitergehen.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Erstelle eine Weihnachtskarte mit deinem Hundeporträt",
      },
      {
        h2: "Verwandte Weihnachtsporträts für Haustiere",
        body: "Interesse an anderen Tieren oder der allgemeinen Haustiere-Seite?",
        list: [
          "Weihnachtsporträts für Haustiere → /de/christmas/pets",
          "Weihnachtsfoto-Generator für Katzen → /de/christmas/cats",
          "KI-Weihnachtsfoto-Generator → /de/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Kann ich ein Weihnachtsporträt meines Hundes erstellen?",
        a: "Ja. Lade ein klares Hundefoto auf dieser Seite hoch, wähle einen Weihnachtsstil und erstelle das Porträt.",
      },
      {
        q: "Was passiert, wenn ich versehentlich ein Katzenfoto hochlade?",
        a: "Du erhältst einen Hinweis, zum Weihnachtsporträt-Erlebnis für Katzen zu wechseln.",
      },
      {
        q: "Kann ich mehr als einen Hund einbeziehen?",
        a: "Ja, wenn jeder Hund auf demselben Foto gut sichtbar ist. Gesicht und Augen sollten gut erkennbar sein.",
      },
      {
        q: "Welche Hundefotos funktionieren am besten?",
        a: "Gut sichtbares Gesicht und Augen, wenig Unschärfe, und achte darauf, Ohren oder Kopf nicht abzuschneiden.",
      },
      {
        q: "Kann ich verschiedene Weihnachtsstile für meinen Hund ausprobieren?",
        a: "Ja. Wähle aus den für Hunde geeigneten Weihnachts-Tierstilen auf der Seite.",
      },
      {
        q: "Kann ich das Hundeporträt herunterladen?",
        a: "Ja. Lade es über den Ergebnisbildschirm herunter, wenn es fertig ist.",
      },
      {
        q: "Kann ich meinen Hund auf eine Weihnachtskarte setzen?",
        a: "Ja. Nutze die Übergabe zum Weihnachtskarten-Ersteller, sobald dein Porträt fertig ist.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Weihnachtsfoto-Generator für Katzen | Festliche Katzenporträts",
    description: "Erstelle ein magisches Weihnachtsporträt deiner Katze aus einem klaren Foto. Tierart-geprüft und standardmäßig privat.",
    h1: "Erstelle ein magisches Weihnachtsporträt deiner Katze",
    lede: "Lade ein klares Foto deiner Katze hoch, wähle einen festlichen Stil und erstelle ein Weihnachtsporträt für Katzen.",
    h2: "Verwandte Haustierporträts",
    links: [
      { href: "/de/christmas/dogs", label: "Weihnachtsporträts für Hunde" },
      { href: "/de/christmas/pets", label: "Alle Weihnachtsporträts für Haustiere" },
      { href: "/de/christmas/photo-generator", label: "KI-Weihnachtsfoto-Generator" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/photo-generator", label: "Foto-Generator" },
      { href: "/de/christmas/pets", label: "Haustiere" },
      { href: "/de/christmas/cats", label: "Katzen" },
    ],
    geo: {
      h2: "Was ist ein Weihnachtsfoto-Generator für Katzen?",
      body:
        "Ein Weihnachtsfoto-Generator für Katzen erstellt aus einem Foto deiner Katze ein festliches Weihnachtsporträt. Bei TheDigitalGifter lädst du ein klares Katzenfoto hoch, wählst einen weihnachtlichen Tierstil und lädst ein katzenfokussiertes Winterporträt herunter, das du auch für eine Weihnachtskarte nutzen kannst.",
    },
    sections: [
      {
        h2: "Erstelle ein magisches Weihnachtsporträt deiner Katze",
        body:
          "Diese Seite ist katzenspezifisch. Lade ein Foto deiner Katze hoch, wähle einen weihnachtlichen Look und erstelle ein Winterporträt mit der Katze im Mittelpunkt. Hundefotos werden zum Hunde-Erlebnis weitergeleitet.",
      },
      {
        h2: "Beispiele für Katzen-Weihnachtsporträts",
        body: "Demo-Richtungen mit Katzen — Inspirationsbeispiele, keine Kundenfotos.",
        list: [
          "Katze am Weihnachtsbaum",
          "Gemütliches Kamin-Weihnachtsporträt mit Katze",
          "Verschneites oder elegantes Weihnachtsporträt mit Katze",
          "Königlicher oder Vintage-Weihnachtsstil für Katzen",
        ],
      },
      {
        h2: "Weihnachtsstile für Katzen",
        body:
          "Katzenporträts nutzen die Weihnachts-Tierstil-Auswahl: Weihnachtsmann-Haustier, Gemütliche Weihnacht, Nordpol, Weihnachtspullover, Schneeporträt, Weihnachtskarte, Königliche Weihnacht und Vintage-Weihnacht.",
      },
      {
        h2: "So wählst du ein gutes Katzenfoto",
        body:
          "Wähle ein Foto, auf dem Augen und Gesicht deiner Katze scharf und sichtbar sind. Vermeide starke Unschärfe, harte Schatten im Gesicht oder enge Ausschnitte, die Ohren und Schnurrhaare abschneiden.",
      },
      {
        h2: "Verwandle dein Katzenporträt in eine Weihnachtskarte",
        body: "Nach dem Erstellen deines Katzen-Weihnachtsporträts kannst du direkt zum Weihnachtskarten-Ersteller weitergehen.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Erstelle eine Weihnachtskarte mit deinem Katzenporträt",
      },
      {
        h2: "Verwandte Weihnachtsporträts für Haustiere",
        body: "Brauchst du stattdessen Hunde oder die allgemeine Haustiere-Seite?",
        list: [
          "Weihnachtsporträts für Haustiere → /de/christmas/pets",
          "Weihnachtsfoto-Generator für Hunde → /de/christmas/dogs",
          "KI-Weihnachtsfoto-Generator → /de/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Kann ich ein Weihnachtsporträt meiner Katze erstellen?",
        a: "Ja. Lade ein klares Katzenfoto hier hoch, wähle einen Weihnachtsstil und erstelle das Porträt.",
      },
      {
        q: "Was passiert, wenn ich ein Hundefoto hochlade?",
        a: "Du wirst darauf hingewiesen, zur Weihnachtsporträt-Seite für Hunde zu wechseln.",
      },
      {
        q: "Sind Schnurrhaare und Gesichtsdetails wichtig?",
        a: "Ja. Ein klares Gesicht mit guten Augendetails führt meist zu einem stärkeren Katzen-Weihnachtsporträt.",
      },
      {
        q: "Kann ich elegante oder gemütliche Looks für meine Katze ausprobieren?",
        a: "Ja. Zu den Stilen gehören Gemütliche Weihnacht, Königliche Weihnacht, Vintage-Weihnacht, Schneeporträt und mehr.",
      },
      {
        q: "Kann ich das Katzenporträt herunterladen?",
        a: "Ja. Lade es über den Ergebnisbildschirm herunter, wenn es fertig ist.",
      },
      {
        q: "Kann ich mein Katzenporträt auf eine Weihnachtskarte setzen?",
        a: "Ja. Die Übergabe zum Karten-Ersteller wird nach dem Erstellen des Porträts unterstützt.",
      },
      {
        q: "Unterscheidet sich das von der Haustiere-Seite?",
        a: "Ja. Haustiere ist die allgemeine Anlaufstelle für Tiere; diese Seite ist speziell für Katzen.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Persönliches Weihnachtsmann-Video | Der Weihnachtsmann sagt den Namen deines Kindes",
    description:
      "Erstelle ein persönliches Weihnachtsvideo vom Weihnachtsmann, das den Namen der beschenkten Person und weitere unterstützte persönliche Details enthalten kann.",
    h1: "Erstelle ein persönliches Video vom Weihnachtsmann",
    lede:
      "Erstelle ein persönliches Weihnachtsvideo vom Weihnachtsmann, das den Namen der beschenkten Person und weitere unterstützte persönliche Details enthalten kann.",
    h2: "So funktionieren Weihnachtsmann-Videos",
    h2Body: "Sag dem Weihnachtsmann, für wen es ist, füge ein paar Details hinzu und erstelle dann ein persönliches Weihnachtsvideo.",
    links: [
      { href: "/de/christmas/family", label: "Familien-Weihnachtsporträts" },
      { href: "/de/christmas/cards", label: "Weihnachtskarten-Ersteller" },
      { href: "/de/christmas/photo-generator", label: "Weihnachtsporträt erstellen" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/santa-video", label: "Weihnachtsmann-Video" },
    ],
    geo: {
      h2: "Was ist ein persönliches Weihnachtsmann-Video?",
      body:
        "Ein persönliches Weihnachtsmann-Video ist eine Weihnachtsbotschaft vom Weihnachtsmann, die den Namen der beschenkten Person und weitere von dir angegebene Details enthalten kann. Bei TheDigitalGifter beantwortest du ein kurzes geführtes Formular, prüfst die Nachricht und erstellst dann ein Video, das du herunterladen und teilen kannst. Die Personalisierung mit Namen funktioniert unabhängig von der gesprochenen Sprache — gesprochene Videos sind derzeit auf Englisch und Rumänisch verfügbar.",
    },
    sections: [
      {
        h2: "Eine persönliche Nachricht vom Weihnachtsmann",
        body:
          "Erstelle ein Weihnachtsvideo vom Weihnachtsmann für ein Kind, Geschwister, die Familie oder eine besondere Person. Der Weihnachtsmann kann den Namen sagen und optionale Details einbauen, die du mitteilst — danach lädst du das fertige Video herunter oder teilst es.",
      },
      {
        h2: "Was kann der Weihnachtsmann erwähnen?",
        body:
          "Du kannst mit dem Namen der beschenkten Person, optionalem Alter, etwas, das sie gut gemacht hat, einem Weihnachtswunsch, einem zusätzlichen Detail (wie einem Haustier oder Hobby) und der Sprache des Weihnachtsmanns personalisieren. Gesprochene Videos werden derzeit auf Englisch und Rumänisch angeboten — die Namenspersonalisierung selbst ist davon unabhängig.",
        list: [
          "Name der beschenkten Person",
          "Optionales Alter",
          "Etwas, das sie gut gemacht hat",
          "Weihnachtswunsch",
          "Zusätzliches persönliches Detail",
          "Gesprochene Sprache: Englisch oder Rumänisch",
        ],
      },
      {
        h2: "Beispiele für persönliche Weihnachtsmann-Videos",
        body:
          "Demo-Beispiele zeigen, wie sich eine persönliche Weihnachtsmann-Botschaft anfühlen kann. Es sind Produktdemonstrationen zur Inspiration, keine Kundenstimmen.",
      },
      {
        h2: "So funktioniert es",
        body:
          "Erzähle dem Weihnachtsmann von der Person, füge die gewünschten Details hinzu, prüfe die Vorschau der Nachricht, erstelle das Video und lade es dann herunter oder teile es, wenn es fertig ist.",
        list: [
          "Erzähle dem Weihnachtsmann von der Person",
          "Prüfe die Nachricht",
          "Erstelle das Video",
          "Herunterladen oder teilen",
        ],
      },
      {
        h2: "Mehr Weihnachtsmagie",
        body: "Nach dem Weihnachtsmann-Video erstellen viele Familien auch ein Weihnachtsporträt oder eine Weihnachtskarte für dieselbe Person.",
        linkHref: "/de/christmas",
        linkLabel: "Zurück zu Weihnachten bei TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "Kann der Weihnachtsmann den Namen meines Kindes sagen?",
        a: "Ja. Der Name der beschenkten Person ist ein zentrales Personalisierungsfeld, und der Weihnachtsmann sagt ihn im Video.",
      },
      {
        q: "Ist ein gesprochenes deutsches Weihnachtsmann-Video verfügbar?",
        a: "Noch nicht. Die Namenspersonalisierung funktioniert unabhängig von der gesprochenen Sprache, aber gesprochene Videos sind derzeit auf Englisch und Rumänisch verfügbar. Deutsch ist noch nicht mit dabei.",
      },
      {
        q: "Was kann ich personalisieren?",
        a: "Name, optionales Alter, etwas, das die Person gut gemacht hat, einen Weihnachtswunsch, ein zusätzliches Detail und die gesprochene Sprache (Englisch oder Rumänisch).",
      },
      {
        q: "Kann der Weihnachtsmann ein Weihnachtsgeschenk erwähnen?",
        a: "Ja — du kannst einen Weihnachtswunsch angeben, den der Weihnachtsmann erwähnen kann, wenn du einen hinzufügst.",
      },
      {
        q: "Kann ich ein Video für Geschwister erstellen?",
        a: "Ja. Wähle die Option für Geschwister und nenne beide Namen im Namensschritt. Ein eigener Ablauf für mehrere Kinder kann später erweitert werden.",
      },
      {
        q: "Kann ich die Nachricht vorher ansehen?",
        a: "Ja. Du kannst die Nachricht prüfen, bevor du das Video erstellst.",
      },
      {
        q: "Kann ich das Video herunterladen oder teilen?",
        a: "Ja. Wenn das Video fertig ist, kannst du die MP4-Datei herunterladen und teilen.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Digitaler Weihnachtsbaum | Geschenke, Nachrichten & Erinnerungen",
    description:
      "Gestalte einen digitalen Weihnachtsbaum voller Geschenke, Nachrichten und Erinnerungen, den du dekorieren und sicher teilen kannst.",
    h1: "Baue einen Weihnachtsbaum voller Überraschungen",
    lede: "Erstelle, dekoriere und teile einen persönlichen digitalen Weihnachtsbaum mit Geschenken und Nachrichten darunter.",
    h2: "Kombiniere mit Weihnachtsgeschenken",
    links: [
      { href: "/de/christmas/wishlist", label: "Weihnachtswunschzettel erstellen" },
      { href: "/de/christmas/gift-finder", label: "Weihnachts-Geschenke-Finder" },
      { href: "/de/christmas/messages", label: "Weihnachtsnachrichten-Generator" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/tree", label: "Digitaler Baum" },
    ],
    geo: {
      h2: "Was ist ein digitaler Weihnachtsbaum?",
      body:
        "Ein digitaler Weihnachtsbaum ist ein interaktiver Online-Weihnachtsbaum, den du gestalten und teilen kannst. Bei TheDigitalGifter wählst du einen Baum-Look, fügst Schmuck hinzu, platzierst Geschenkboxen mit persönlichen Nachrichten darunter und teilst einen privaten Link, damit eine besondere Person die Geschenke am Bildschirm öffnen kann — ohne dass die Teilenseite zu einem öffentlichen Suchergebnis wird.",
    },
    sections: [
      {
        h2: "Baue einen digitalen Weihnachtsbaum",
        body:
          "Erstelle kostenlos einen interaktiven Weihnachtsbaum im Browser. Passe den Stil (Klassisch, Verschneit, Gold, Gemütlich, Minimal oder Magisch), Lichter, Schnee, Baumspitzen und Kugeln an und platziere dann Geschenkboxen darunter.",
      },
      {
        h2: "Was kannst du unter deinen Baum legen?",
        body:
          "Aktuell kannst du Geschenkboxen mit persönlichen Weihnachtsnachrichten hinzufügen. Jedes Geschenk kann einen festlichen Boxstil wie Rot, Gold, Grün, Blau oder Schnee nutzen. Weitere Geschenktypen können später ergänzt werden — der aktuelle Ersteller konzentriert sich auf Nachrichten-Geschenke.",
        list: ["Persönliche Weihnachtsnachrichten in Geschenkboxen", "Festliche Boxstile (Rot, Gold, Grün, Blau, Schnee)"],
      },
      {
        h2: "Teile deinen Weihnachtsbaum",
        body:
          "Wenn du bereit bist, aktiviere das Teilen und schicke einen Link. Empfänger öffnen den Baum, sehen die Dekoration und wickeln Geschenke aus. Geteilte Baum-Links sind für Personen gedacht, denen du vertraust, und werden nicht für Suchmaschinen indexiert.",
      },
      {
        h2: "Ein Weihnachtsgeschenk zum Öffnen",
        body:
          "Empfänger können auf Geschenke unter dem Baum tippen, um die Nachrichten zu sehen, die du hinterlassen hast — ein digitaler Moment, der sich anfühlen soll wie das Öffnen von etwas, das eigens für sie dort platziert wurde.",
      },
      {
        h2: "So funktioniert es",
        body: "Ein einfacher Weg vom leeren Baum zu einer teilbaren Weihnachtsüberraschung.",
        list: [
          "Erstelle und gestalte deinen digitalen Weihnachtsbaum",
          "Füge Geschenkboxen mit Nachrichten hinzu",
          "Aktiviere das Teilen und schicke den Link",
          "Sie öffnen die Geschenke unter dem Baum",
        ],
      },
      {
        h2: "Mehr Weihnachtsmagie",
        body: "Kombiniere deinen Baum mit weiteren Weihnachtserlebnissen für einen zusätzlichen festlichen Moment.",
        list: [
          "Weihnachten Startseite → /de/christmas",
          "Persönliches Weihnachtsmann-Video → /de/christmas/santa-video",
          "Online-Adventskalender → /de/christmas/advent",
        ],
      },
    ],
    faqs: [
      {
        q: "Was ist ein digitaler Weihnachtsbaum?",
        a: "Ein interaktiver Online-Weihnachtsbaum, den du anpasst, mit Nachrichten-Geschenken füllst und teilst, damit jemand sie am eigenen Gerät öffnen kann.",
      },
      {
        q: "Was kann ich hinzufügen?",
        a: "Aktuell kannst du Geschenkboxen mit persönlichen Weihnachtsnachrichten hinzufügen und festliche Boxstile wählen.",
      },
      {
        q: "Kann ich ihn mit jemandem teilen?",
        a: "Ja. Aktiviere das Teilen und schicke den Link. Behandle ihn wie einen persönlichen Geschenklink.",
      },
      {
        q: "Können Empfänger die Geschenke öffnen?",
        a: "Ja. Empfänger können auf Geschenke unter dem Baum tippen, um die von dir hinzugefügten Nachrichten zu sehen.",
      },
      {
        q: "Kann ich ein Weihnachtsmann-Video oder Weihnachtsfoto unter den Baum legen?",
        a: "Nicht als eigener Geschenktyp im aktuellen Baum-Ersteller. Du kannst diese Erlebnisse trotzdem separat erstellen und in einem Nachrichten-Geschenk erwähnen.",
      },
      {
        q: "Brauche ich ein Konto?",
        a: "Du kannst ohne aufwendige Einrichtung mit dem Bauen beginnen — die Zuordnung erfolgt über die Erstellersitzung, damit du weiter bearbeiten kannst.",
      },
      {
        q: "Ist der geteilte Baum öffentlich?",
        a: "Geteilte Bäume sind für Personen mit dem Link erreichbar, aber die Teilenseiten sind noindex und nicht für Suchmaschinen gedacht.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Online-Adventskalender | Jeden Tag eine Überraschung",
    description: "Öffne jeden Tag vom 1. bis 24. Dezember eine neue digitale Weihnachtsüberraschung.",
    h1: "Ein bisschen Weihnachtsmagie an jedem Tag",
    lede: "Öffne jeden Tag vom 1. bis 24. Dezember eine neue digitale Weihnachtsüberraschung.",
    h2: "Mehr Weihnachtsmagie",
    links: [
      { href: "/de/christmas/santa-video", label: "Persönliches Weihnachtsmann-Video" },
      { href: "/de/christmas/cards", label: "Weihnachtskarten-Ersteller" },
      { href: "/de/christmas/wishlist", label: "Weihnachtswunschzettel" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/advent", label: "Adventskalender" },
    ],
    geo: {
      h2: "Was ist ein Online-Adventskalender?",
      body:
        "Ein Online-Adventskalender ist die digitale Version des klassischen Adventskalenders: Jeden Tag im Dezember öffnet sich ein neues Türchen bis Weihnachten. Bei TheDigitalGifter öffnest du das heutige Türchen in einem 1–24-Kalender (Zeitzone Europe/Bucharest). Vergangene Türchen bleiben nach dem jeweiligen Tag geschlossen, und manche Belohnungen erfordern möglicherweise eine Anmeldung, wenn Aktionen aktiv sind.",
    },
    sections: [
      {
        h2: "Ein bisschen Weihnachtsmagie an jedem Tag",
        body:
          "Der Adventskalender ist ein Countdown-Erlebnis mit vierundzwanzig Türchen. Jeder Tag im Dezember hat sein eigenes Türchen — ein kleines Ritual, in dem man in der Vorweihnachtszeit jeden Tag etwas Neues öffnet.",
      },
      {
        h2: "Öffne jeden Tag ein neues Türchen",
        body:
          "Die Türchen folgen dem Kalendertag in der Zeitzone Europe/Bucharest. Nur das heutige Türchen kann geöffnet werden. Zukünftige Türchen bleiben gesperrt. Verpasste Tage können nicht nachträglich geöffnet werden.",
      },
      {
        h2: "Was kann sich hinter den Türchen verbergen?",
        body:
          "Türchen-Belohnungen sind Weihnachtsmomente, die für die Saison konfiguriert sind — etwa eine Überraschung zum Einlösen, wenn Aktionen aktiv sind. Die Verfügbarkeit kann von Saison-Einstellungen und davon abhängen, ob du angemeldet bist.",
      },
      {
        h2: "Vor dem 1. Dezember",
        body: "Vor Beginn des Adventsfensters werden Türchen als „Bald verfügbar“ angezeigt. Komm im Dezember wieder, um Türchen eins zu öffnen.",
      },
      {
        h2: "So funktioniert der Adventskalender",
        body: "Einfache Schritte für das digitale Advents-Erlebnis.",
        list: [
          "Öffne die Adventskalender-Seite",
          "Finde das heutige Türchen (1–24 im Dezember)",
          "Öffne es, wenn es verfügbar ist",
          "Melde dich an, falls eine Belohnung ein Konto erfordert",
        ],
      },
      {
        h2: "Mehr Weihnachtsmagie",
        body: "Setze die Saison mit einem digitalen Baum oder der Weihnachten-Startseite fort.",
        list: ["Digitaler Weihnachtsbaum → /de/christmas/tree", "Weihnachten Startseite → /de/christmas"],
      },
    ],
    faqs: [
      {
        q: "Wann beginnt der Adventskalender?",
        a: "Türchen gibt es für die Dezembertage 1–24. Vor dem 1. Dezember erscheinen die Türchen als „Bald verfügbar“.",
      },
      {
        q: "Wann öffnet sich jedes Türchen?",
        a: "Jedes Türchen öffnet sich an seinem Kalendertag in der Zeitzone Europe/Bucharest.",
      },
      {
        q: "Kann ich frühere Türchen öffnen?",
        a: "Nein. Verpasste Tage bleiben geschlossen — nur das heutige Türchen ist verfügbar.",
      },
      {
        q: "Ist der Kalender kostenlos?",
        a: "Das Durchstöbern des Kalender-Erlebnisses ist kostenlos. Manche Belohnungen erfordern möglicherweise ein Konto, wenn Aktionen für die Saison aktiv sind.",
      },
      {
        q: "Was kann ich hinter einem Türchen finden?",
        a: "Saisonale Weihnachtsüberraschungen, die für den jeweiligen Tag konfiguriert sind, wenn Aktionen aktiv sind — keine Garantie auf Bargeldpreise oder Shop-Guthaben an jedem Tag.",
      },
      {
        q: "Brauche ich ein Konto?",
        a: "Du kannst den Kalender ohne Konto ansehen. Das Einlösen bestimmter Türchen-Belohnungen kann eine Anmeldung erfordern.",
      },
      {
        q: "Kann ich ihn auf dem Handy nutzen?",
        a: "Ja. Der Adventskalender ist so gestaltet, dass er auf Smartphones genauso funktioniert wie auf dem Desktop.",
      },
      {
        q: "Kann ich ihn teilen?",
        a: "Ja. Du kannst den Link zur Adventskalender-Seite teilen, damit andere ihre eigenen täglichen Türchen öffnen können.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Weihnachtskarten-Ersteller | Persönliche Weihnachtskarten",
    description:
      "Erstelle eine persönliche Weihnachtskarte, die man aufheben möchte — wähle ein Design, füge deine Nachricht hinzu und teile oder lade sie herunter.",
    h1: "Erstelle eine Weihnachtskarte, die man aufheben möchte",
    lede:
      "Gestalte eine persönliche Weihnachtskarte mit festlichen Layouts und deiner eigenen Nachricht. Manche Botschaften verdienen mehr als eine Textnachricht.",
    h2: "Kombiniere mit Weihnachtsgrüßen",
    links: [
      { href: "/de/christmas/messages", label: "Weihnachtsnachrichten-Generator" },
      { href: "/de/christmas/photo-generator", label: "Weihnachtsfoto-Generator" },
      { href: "/de/christmas/family", label: "Familien-Weihnachtsporträts" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/cards", label: "Karten" },
    ],
    geo: {
      h2: "Was ist ein Online-Weihnachtskarten-Ersteller?",
      body:
        "Ein Online-Weihnachtskarten-Ersteller lässt dich eine persönliche Weihnachtskarte mit einem Foto, einem festlichen Design und deiner eigenen Nachricht gestalten. Bei TheDigitalGifter kannst du ein Foto hochladen oder ein Weihnachtsporträt verwenden, einen Stil wählen, eine Nachricht schreiben oder Hilfe dazu bekommen und dann ein PNG herunterladen oder die Karte digital teilen.",
    },
    sections: [
      {
        h2: "Erstelle eine persönliche Weihnachtskarte",
        body:
          "Wähle einen Weihnachtskarten-Stil, füge dein Foto hinzu, schreibe eine Nachricht und erstelle eine digitale Karte, die du herunterladen oder teilen kannst. Manche Botschaften verdienen mehr als eine Textnachricht — genau dafür ist das gemacht.",
      },
      {
        h2: "Beispiele für Weihnachtskarten",
        body:
          "Entdecke Richtungen wie Familie, Paar, Haustier, elegant, witzig und klassisch. Die Beispiele dienen als Design-Inspiration für die im Ersteller verfügbaren Stile.",
        list: ["Familie", "Paar", "Haustier", "Elegant", "Witzig", "Klassisch"],
      },
      {
        h2: "Nutze dein Weihnachtsporträt",
        body:
          "Wenn du bereits ein Weihnachtsporträt erstellt hast, kannst du es in den Karten-Ersteller mitnehmen und mit einer Nachricht abschließen. Die Übergabe des Porträts aus dem Weihnachtsfoto-Generator wird unterstützt.",
        linkHref: "/de/christmas/photo-generator",
        linkLabel: "Erstelle zuerst ein Weihnachtsporträt",
      },
      {
        h2: "Nachrichten für Weihnachtskarten",
        body:
          "Schreibe deine eigenen Worte oder nutze die integrierte Nachrichtenhilfe als Ausgangspunkt. Diese unterstützt derzeit Englisch und Rumänisch. Für ausführlichere Weihnachtsgrüße erklärt die Seite zum Nachrichten-Generator, worum es geht.",
        linkHref: "/de/christmas/messages",
        linkLabel: "Weihnachtsgrüße finden",
      },
      {
        h2: "So erstellst du eine Weihnachtskarte online",
        body: "Ein einfacher Weg von der leeren Seite zu einer teilbaren Weihnachtskarte.",
        list: [
          "Wähle einen Weihnachtskarten-Stil",
          "Lade ein Foto hoch oder nutze ein Weihnachtsporträt",
          "Schreibe deine Nachricht (oder lass dir helfen)",
          "Lade das PNG herunter oder teile es digital",
        ],
      },
    ],
    faqs: [
      {
        q: "Kann ich mein eigenes Foto hochladen?",
        a: "Ja. Lade ein Foto als Mittelpunkt deiner Weihnachtskarte hoch.",
      },
      {
        q: "Kann ich ein Weihnachtsporträt verwenden?",
        a: "Ja. Wenn du im Weihnachtsfoto-Generator ein Porträt erstellt hast, kannst du es in den Karten-Ersteller übernehmen.",
      },
      {
        q: "Kann mir das Tool beim Schreiben der Nachricht helfen?",
        a: "Die integrierte Nachrichtenhilfe unterstützt derzeit Englisch und Rumänisch. Für weitere Optionen besuche den Weihnachtsnachrichten-Generator.",
      },
      {
        q: "Gibt es auch deutsche Nachrichtenvorlagen?",
        a: "Noch nicht direkt im Assistenten — dieser deckt heute Englisch und Rumänisch ab. Du kannst deine deutsche Nachricht aber jederzeit frei eingeben und mit einem festlichen Design kombinieren.",
      },
      {
        q: "Kann ich eine Familienkarte erstellen?",
        a: "Ja. Familienfreundliche Stile und Foto-Layouts sind Teil des Erstellers.",
      },
      {
        q: "Kann ich eine Karte mit Haustier erstellen?",
        a: "Ja. Haustierfotos funktionieren gut in mehreren Weihnachtskarten-Stilen.",
      },
      {
        q: "Kann ich die Karte herunterladen?",
        a: "Ja. Lade ein hochauflösendes PNG für den persönlichen Gebrauch herunter.",
      },
      {
        q: "Kann ich sie digital teilen?",
        a: "Ja. Teile sie über die Freigabeoptionen deines Geräts, WhatsApp, E-Mail oder durch Kopieren eines Links, wo verfügbar.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Weihnachtsnachrichten-Generator | Grüße für Familie & Freunde",
    description:
      "Finde die perfekte Weihnachtsbotschaft für Familie, Freunde und Kollegen — und nutze sie dann in einer persönlichen Weihnachtskarte.",
    h1: "Finde die perfekte Weihnachtsbotschaft",
    lede:
      "Lerne, wie unser Weihnachtsnachrichten-Generator herzliche, witzige, romantische oder professionelle Grüße erstellt — heute auf Englisch und Rumänisch, dann setze deine deutsche Botschaft in eine Weihnachtskarte.",
    h2: "Verwandle Worte in eine Karte",
    links: [
      { href: "/de/christmas/cards", label: "Weihnachtskarten-Ersteller" },
      { href: "/de/christmas/wishlist", label: "Weihnachtswunschzettel" },
      { href: "/de/christmas/tree", label: "Digitaler Weihnachtsbaum" },
      { href: "/de/christmas", label: "Weihnachten Startseite" },
    ],
    breadcrumbs: [
      { href: "/de/christmas", label: "Weihnachten" },
      { href: "/de/christmas/messages", label: "Nachrichten" },
    ],
    geo: {
      h2: "Was ist ein Weihnachtsnachrichten-Generator?",
      body:
        "Ein Weihnachtsnachrichten-Generator hilft dir, Weihnachtsgrüße zu schreiben, indem du auswählst, für wen die Nachricht ist und welchen Ton du möchtest — danach werden bearbeitbare Textvorschläge erstellt. Bei TheDigitalGifter funktioniert der generierte Text heute auf Englisch und Rumänisch; diese Seite erklärt das Konzept, damit du die Idee auf Deutsch selbst umsetzen oder auf zukünftige Sprachunterstützung warten kannst.",
    },
    sections: [
      {
        h2: "So funktioniert der Weihnachtsnachrichten-Generator",
        body:
          "Wähle eine beschenkte Person, entscheide dich für einen Ton, lege eine Länge fest (kurz, mittel oder lang), füge optional ein persönliches Detail hinzu und erhalte Textvorschläge, die du bearbeiten und verwenden kannst. Die generierten Vorschläge liegen heute auf Englisch und Rumänisch vor — praktisch als Struktur- und Ideenvorlage, die du auf Deutsch selbst ausformulierst.",
      },
      {
        h2: "Weihnachtsgrüße nach Empfänger",
        body:
          "Der Generator deckt gängige Weihnachtsbeziehungen ab. Starte das Tool und wähle, an wen du schreibst — eigene Landingpages je Empfänger sind noch nicht verfügbar.",
        list: ["Mama", "Papa", "Ehefrau", "Ehemann", "Freundin", "Freund", "Familie", "Freund/in", "Kollege/in"],
      },
      {
        h2: "Weihnachtsgrüße nach Ton",
        body:
          "Aktuell verfügbare Ton-Optionen sind herzlich, witzig, romantisch, gefühlvoll, kurz und knapp, professionell und religiös. Die generierten Texte liegen heute auf Englisch und Rumänisch vor.",
      },
      {
        h2: "Beispiele für Weihnachtsgrüße",
        body:
          "Demo-Richtungen für die Art von Wünschen, bei denen das Tool helfen kann — passe alles an, damit es nach dir klingt und auf Deutsch stimmt.",
        list: [
          "Herzliche Zeilen für Mama, die ein weiteres Jahr stiller Fürsorge würdigen",
          "Kurzer warmer Gruß für eine Freundin, die du zu selten siehst",
          "Romantische Weihnachtszeile für das erste gemeinsame Weihnachten als Paar",
          "Leicht witzige Kollegen-Nachricht, die im Rahmen bleibt",
        ],
      },
      {
        h2: "So schreibst du eine bedeutungsvolle Weihnachtsbotschaft",
        body:
          "Sprich die Person mit Namen oder Beziehung an, erwähne eine gemeinsame Erinnerung oder Eigenschaft, wenn sie passt, drücke ein klares Gefühl aus, halte die Sprache natürlich und schließe persönlich. Der Generator ist ein Ausgangspunkt — deine eigene deutsche Formulierung macht ihn echt.",
      },
      {
        h2: "Nutze deine Botschaft in einer Weihnachtskarte",
        body: "Wenn du passende Worte gefunden hast, gehe weiter zum Weihnachtskarten-Ersteller und kombiniere die Nachricht mit Foto und Design.",
        linkHref: "/de/christmas/cards",
        linkLabel: "Setze diese Weihnachtsbotschaft auf eine Karte",
      },
    ],
    faqs: [
      {
        q: "Wie funktioniert der Weihnachtsnachrichten-Generator?",
        a: "Wähle Empfänger, Ton und Länge, füge optional ein Detail hinzu und erhalte Textvorschläge, die du kopieren oder bearbeiten kannst.",
      },
      {
        q: "Erstellt das Tool auch deutsche Weihnachtsgrüße?",
        a: "Der Generator erstellt heute Texte auf Englisch und Rumänisch. Diese Seite erklärt das Konzept und liefert Struktur-Inspiration, die du auf Deutsch frei umsetzt.",
      },
      {
        q: "Kann ich eine Botschaft für meinen Partner schreiben?",
        a: "Ja. Wähle Freundin, Freund, Partner, Ehefrau oder Ehemann und einen romantischen oder herzlichen Ton.",
      },
      {
        q: "Kann es witzige Weihnachtsbotschaften erstellen?",
        a: "Ja. Wähle den witzigen Ton — halte Kollegen-Nachrichten dabei professionell.",
      },
      {
        q: "Kann ich generierte Nachrichten bearbeiten?",
        a: "Ja. Behandle den generierten Text als Entwurf und formuliere ihn frei um, bevor du ihn versendest oder auf eine Karte setzt.",
      },
      {
        q: "Kann es kurze Weihnachtsgrüße erstellen?",
        a: "Ja. Wähle die kurze Länge oder den Ton „kurz und knapp“.",
      },
      {
        q: "Kann ich eine Botschaft auf einer Weihnachtskarte verwenden?",
        a: "Ja. Gehe weiter zum Weihnachtskarten-Ersteller mit der Nachrichtenübergabe.",
      },
      {
        q: "Welche Sprachen werden unterstützt?",
        a: "Englisch und Rumänisch werden heute für die generierten Texte unterstützt.",
      },
    ],
  },
};

export const LOCALE = "de";

/**
 * @param {string} basePath
 */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
