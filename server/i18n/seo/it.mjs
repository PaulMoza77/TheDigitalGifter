/**
 * Italian SEO content for the Christmas Wave 1 routes.
 * Genuine IT copy — not machine-filler. Honesty notes:
 *  - Santa Video: product speaks EN/RO only today. We do NOT promise an Italian-speaking
 *    Babbo Natale or Italian-language video generation.
 *  - Christmas Messages generator: text options are produced in English or Romanian today.
 *    We do not claim native Italian message generation.
 *  - Cards: the card maker itself (photo + design + your own text) works fine in Italian;
 *    we do not claim the built-in message-writing assistant works in Italian.
 *  - No fake inventory, stock counts, or ratings anywhere.
 */

/** @typedef {{
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
 * }} LocalizedSeoPage */

export const LOCALE = "it";

/** @type {Record<string, LocalizedSeoPage>} */
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Natale su TheDigitalGifter | Regali, Foto, Babbo Natale e altro",
    description:
      "Crea regali di Natale, ritratti con IA, video di Babbo Natale, liste dei desideri, biglietti di Natale e sorprese dell'Avvento — esperienze digitali natalizie personalizzate di TheDigitalGifter.",
    h1: "Crea qualcosa che ricorderanno per questo Natale",
    lede:
      "Scopri regali di Natale, ritratti fotografici, video di Babbo Natale, alberi digitali, calendari dell'Avvento, biglietti di Natale e messaggi — tutto in un unico posto su TheDigitalGifter.",
    h2: "Esperienze natalizie",
    h2Body: "Scegli un prodotto natalizio qui sotto e crea qualcosa di personale in pochi minuti.",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
    ],
    links: [
      { href: "/it/christmas/gift-finder", label: "Trova il regalo di Natale perfetto" },
      { href: "/it/christmas/wishlist", label: "Crea una lista dei desideri di Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas/santa-video", label: "Crea un video personalizzato di Babbo Natale" },
      { href: "/it/christmas/tree", label: "Costruisci un albero di Natale digitale" },
      { href: "/it/christmas/advent", label: "Apri il calendario dell'Avvento" },
      { href: "/it/christmas/cards", label: "Crea un biglietto di Natale" },
      { href: "/it/christmas/messages", label: "Trova un messaggio di Natale" },
    ],
    geo: {
      h2: "Cosa puoi creare con TheDigitalGifter a Natale?",
      body:
        "TheDigitalGifter è uno spazio di creazione natalizia. Puoi trovare idee regalo con il ricercatore di regali, trasformare una foto in un ritratto natalizio per famiglia, coppia o animali domestici, creare un video personalizzato di Babbo Natale con il nome del destinatario, costruire una lista dei desideri condivisibile, progettare un biglietto di Natale con la tua foto e il tuo messaggio, scrivere auguri, decorare un albero di Natale digitale e aprire sorprese giornaliere dell'Avvento. Parti da un unico punto e passa all'esperienza più adatta alla persona che vuoi festeggiare.",
    },
    sections: [
      {
        h2: "Trova il regalo di Natale perfetto",
        body:
          "Non sai cosa comprare? Il ricercatore di regali di Natale chiede per chi stai comprando, cosa gli piace, come vive la sua giornata e quanto vuoi spendere. Ricevi idee regalo ponderate con una breve motivazione per ognuna — comprese opzioni per chi sembra avere già tutto. Salva i preferiti in una lista dei desideri quando vuoi.",
        linkHref: "/it/christmas/gift-finder",
        linkLabel: "Trova un regalo di Natale che ameranno davvero",
      },
      {
        h2: "Crea foto natalizie magiche",
        body:
          "Carica una foto nitida e trasformala in un ritratto natalizio festoso. Crea stili per famiglie, coppie e animali domestici — inclusi percorsi dedicati a cani e gatti — poi scarica in privato o portalo su un biglietto di Natale.",
        linkHref: "/it/christmas/photo-generator",
        linkLabel: "Trasforma la tua foto in magia natalizia",
      },
      {
        h2: "Ricevi un messaggio personalizzato da Babbo Natale",
        body:
          "Crea un video natalizio personalizzato da Babbo Natale. Digli il nome del destinatario e dettagli opzionali come l'età, qualcosa che ha fatto bene, un hobby o un desiderio di Natale. Rivedi il messaggio, poi crea un video che puoi scaricare e condividere.",
        linkHref: "/it/christmas/santa-video",
        linkLabel: "Crea un video personalizzato di Babbo Natale",
      },
      {
        h2: "Crea e condividi una lista dei desideri di Natale",
        body:
          "Costruisci una lista dei desideri di Natale con link a prodotti o desideri scritti liberamente. Condividi un solo link semplice con familiari e amici. Chi la vede può prenotare un regalo così nessuno lo compra due volte — senza svelare chi lo ha comprato al destinatario della lista.",
        linkHref: "/it/christmas/wishlist",
        linkLabel: "Crea una lista dei desideri di Natale",
      },
      {
        h2: "Crea un biglietto di Natale personalizzato",
        body:
          "Combina una foto, un design festoso e un messaggio personale in un biglietto di Natale che puoi scaricare o condividere digitalmente. Usa la tua foto o un ritratto natalizio che hai già creato.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Crea un biglietto di Natale che vorranno conservare",
      },
      {
        h2: "Altre esperienze natalizie",
        body:
          "Puoi anche costruire un albero di Natale digitale pieno di sorprese, aprire le porte dell'Avvento durante dicembre e trovare le parole giuste con il generatore di messaggi.",
        list: [
          "Albero di Natale digitale → /it/christmas/tree",
          "Calendario dell'Avvento → /it/christmas/advent",
          "Messaggi di Natale → /it/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "Cosa posso creare per Natale con TheDigitalGifter?",
        a: "Puoi trovare idee regalo, trasformare foto in ritratti natalizi per famiglie, coppie e animali, avviare l’esperienza Babbo Natale, creare una lista dei desideri condividibile, progettare un biglietto, scrivere messaggi, decorare un albero digitale e aprire sorprese dell’Avvento. Scegli un’esperienza su questa pagina e finisci in pochi minuti.",
      },
      {
        q: "Babbo Natale può dire il nome di mio figlio?",
        a: "Puoi iniziare con il nome sulla pagina Natale o nell’esperienza Babbo Natale e aggiungere dettagli opzionali. I video parlati sono disponibili oggi in inglese e rumeno — altre lingue arriveranno.",
      },
      {
        q: "Servono competenze di design?",
        a: "No. Ogni esperienza natalizia ti guida passo dopo passo — carica una foto, rispondi a poche domande o inizia con un nome — e la pagina fa il resto.",
      },
      {
        q: "È per regali digitali, fisici o entrambi?",
        a: "Entrambi. Usa il Trova-regali e la lista dei desideri per fare shopping ovunque, e crea ritratti e biglietti digitali da scaricare o condividere subito.",
      },
      {
        q: "Funziona sul mio telefono?",
        a: "Sì — l’hub di Natale e le esperienze prodotto sono pensati prima per il telefono e funzionano anche su desktop.",
      },
      {
        q: "La foto della mia famiglia è privata?",
        a: "Gli upload servono a creare il ritratto o il biglietto. Le esperienze per bambini sono privacy-first e prevedono un genitore o tutore. Quando il risultato è pronto, lo scarichi in privato — non pubblichiamo le tue foto.",
      },
      {
        q: "Quanto tempo serve per creare qualcosa?",
        a: "La maggior parte delle esperienze richiede pochi minuti. Trova-regali e messaggi sono quasi istantanei. Ritratti, biglietti e Babbo Natale ti guidano passo dopo passo; le creazioni a pagamento continuano dopo il checkout.",
      },
      {
        q: "Serve un account per iniziare?",
        a: "Puoi esplorare e iniziare subito. Alcune esperienze chiedono un’email all’iscrizione o al pagamento per salvare i progressi, ricevere il risultato o unirti al Christmas Club.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Ricercatore di Regali di Natale | Trova il Regalo Perfetto | TheDigitalGifter",
    description:
      "Trova idee regalo di Natale pensate in base a per chi stai comprando, ai suoi interessi, alla sua personalità e al tuo budget.",
    h1: "Trova un regalo di Natale che ameranno davvero",
    lede:
      "Rispondi a qualche domanda su per chi stai comprando e ricevi idee regalo di Natale personalizzate in base a interessi, personalità e budget.",
    h2: "Strumenti natalizi correlati",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/gift-finder", label: "Ricercatore di regali" },
    ],
    links: [
      { href: "/it/christmas/wishlist", label: "Crea una lista dei desideri di Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie" },
      { href: "/it/christmas/tree", label: "Albero di Natale digitale" },
      { href: "/it/christmas", label: "Tutte le esperienze natalizie" },
    ],
    geo: {
      h2: "Cos'è un ricercatore di regali di Natale?",
      body:
        "Un ricercatore di regali di Natale è uno strumento guidato che suggerisce idee regalo in base a per chi stai comprando, ai suoi interessi e alla sua personalità, e al tuo budget. Su TheDigitalGifter rispondi a un breve questionario e ricevi idee selezionate con una motivazione chiara sul perché potrebbero essere adatte — poi puoi affinare le risposte o salvare le idee in una lista dei desideri.",
    },
    sections: [
      {
        h2: "Come funziona il ricercatore di regali di Natale",
        body:
          "Scegli il destinatario, condividi i suoi interessi e la sua personalità, imposta un budget e, se vuoi, aggiungi un dettaglio personale. Il ricercatore restituisce idee regalo ordinate con brevi spiegazioni. Puoi modificare le risposte, ricominciare o salvare le idee nella tua lista dei desideri di Natale.",
        list: [
          "Per chi stai comprando",
          "Interessi e personalità",
          "Intervallo di budget",
          "Idee regalo personalizzate con motivazioni",
        ],
      },
      {
        h2: "Trova regali in base al destinatario",
        body:
          "Il ricercatore di regali copre le relazioni tipiche degli acquisti natalizi, così i suggerimenti restano pertinenti. Usalo per mamma, papà, moglie, marito, fidanzata, fidanzato, figli, adolescenti, nonni, amici, colleghi e altro ancora. Le pagine dedicate per destinatario non sono ancora disponibili — avvia lo strumento e scegli lì il destinatario.",
        list: [
          "Mamma",
          "Papà",
          "Moglie",
          "Marito",
          "Fidanzata",
          "Fidanzato",
          "Figli",
          "Adolescenti",
          "Nonni",
          "Amici",
          "Colleghi",
        ],
      },
      {
        h2: "Trova regali di Natale in base al budget",
        body:
          "Scegli una fascia di spesa, ad esempio sotto i 25 €, 25–50 €, 50–100 €, 100–200 €, oltre 200 €, oppure senza budget fisso. I suggerimenti sono idee regalo con fasce di prezzo indicative — non disponibilità in tempo reale di un negozio né scorte garantite.",
      },
      {
        h2: "Regali per chi ha già tutto",
        body:
          "Quando qualcuno ha già «tutto», i regali di Natale utili tendono verso esperienze, ricordi personalizzati, upgrade per un hobby, momenti significativi o articoli pratici di fascia alta. Scegliere la personalità «Ha già tutto» orienta il ricercatore verso queste direzioni invece che verso suggerimenti generici.",
      },
      {
        h2: "Salva le idee nella tua lista dei desideri",
        body:
          "Ti piace un'idea? Salvala nella tua lista dei desideri di Natale e condividi un'unica lista con la famiglia per coordinare gli acquisti.",
        linkHref: "/it/christmas/wishlist",
        linkLabel: "Apri il creatore di liste dei desideri di Natale",
      },
    ],
    faqs: [
      {
        q: "Come funziona il ricercatore di regali di Natale?",
        a: "Rispondi a poche domande veloci su per chi stai comprando, i suoi interessi, la sua personalità e il tuo budget. Poi vedi idee regalo selezionate con una motivazione chiara per ognuna.",
      },
      {
        q: "Posso cercare per budget?",
        a: "Sì. Le fasce di budget sono un passaggio fondamentale del ricercatore.",
      },
      {
        q: "Posso trovare regali per chi ha già tutto?",
        a: "Sì. Tra le opzioni di personalità c'è «Ha già tutto», che orienta le idee verso esperienze, personalizzazione e ricordi significativi.",
      },
      {
        q: "Posso usarlo per bambini o adolescenti?",
        a: "Sì. Scegli Bambino/a o Adolescente (o Figlia/Figlio con una fascia d'età) così le idee restano adatte all'età.",
      },
      {
        q: "Posso salvare idee nella mia lista dei desideri?",
        a: "Sì. Usa Salva nella lista dei desideri su un'idea per aggiungerla a /it/christmas/wishlist.",
      },
      {
        q: "I suggerimenti sono personalizzati?",
        a: "Sì. I suggerimenti considerano destinatario, età, interessi, personalità, budget e un dettaglio personale opzionale.",
      },
      {
        q: "Mostra prodotti reali dei negozi?",
        a: "Oggi il ricercatore mostra idee regalo selezionate con fasce di prezzo indicative. Prezzi in tempo reale, disponibilità o cataloghi dei negozi non sono ancora collegati — non inventiamo scorte esatte né prezzi dei rivenditori.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Creatore di Liste dei Desideri di Natale | Crea e Condividi la Tua Lista",
    description:
      "Crea una lista dei desideri di Natale, aggiungi regali da qualsiasi negozio e condividi un solo link con familiari e amici.",
    h1: "Crea una lista dei desideri di Natale e condividi un solo link",
    lede:
      "Costruisci una lista dei desideri di Natale in pochi minuti. Aggiungi regali da qualsiasi negozio o scrivi i tuoi desideri, poi invia un solo link a familiari e amici.",
    h2: "Come funziona",
    h2Body: "Crea la tua lista, aggiungi desideri, condividi un link e lascia che coordinino i regali senza rovinare la sorpresa.",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/wishlist", label: "Lista dei desideri" },
    ],
    links: [
      { href: "/it/christmas/gift-finder", label: "Prova il ricercatore di regali di Natale" },
      { href: "/it/christmas/tree", label: "Metti regali sotto un albero di Natale digitale" },
      { href: "/it/christmas/photo-generator", label: "Aggiungi un ritratto natalizio" },
      { href: "/it/christmas", label: "Torna a Natale" },
    ],
    geo: {
      h2: "Cos'è una lista dei desideri di Natale online?",
      body:
        "Una lista dei desideri di Natale online è un elenco condivisibile di regali o esperienze che qualcuno vorrebbe ricevere. Su TheDigitalGifter crei una lista, aggiungi desideri da link a prodotti o testo libero, condividi un solo link con familiari e amici, e lasci che prenotino i regali così gli acquisti restano coordinati senza rovinare la sorpresa.",
    },
    sections: [
      {
        h2: "Crea una lista dei desideri di Natale online",
        body:
          "Dai un nome alla tua lista, aggiungi desideri e tieni ogni idea natalizia in un solo posto invece che sparsa tra varie chat. Puoi iniziare velocemente e continuare a modificare quando vuoi.",
      },
      {
        h2: "Aggiungi tutto ciò che desideri",
        body:
          "Incolla l'URL di un prodotto da quasi qualsiasi negozio, scrivi un desiderio manualmente, aggiungi note e includi esperienze o idee fatte a mano. Se un link non può essere letto automaticamente, puoi comunque salvare il desiderio scrivendolo tu.",
      },
      {
        h2: "Condividi un solo link semplice",
        body:
          "Attiva la condivisione e invia un solo link della tua lista tramite copia, WhatsApp, email o il pannello di condivisione del tuo dispositivo. Le liste condivise sono accessibili a chi ha il link e non sono pensate per apparire sui motori di ricerca.",
      },
      {
        h2: "Evita regali di Natale doppi",
        body:
          "Chi visualizza la lista può toccare «Lo prendo io» per prenotare un regalo. Le prenotazioni restano anonime per chi possiede la lista, così la sorpresa resta intatta e la famiglia evita di comprare la stessa cosa due volte.",
      },
      {
        h2: "Liste dei desideri di Natale per bambini e famiglie",
        body:
          "Crea una lista per te, per tuo figlio o per qualcun altro, poi condividila con nonni e amici. Abbinala al ricercatore di regali quando non sai cosa chiedere.",
        linkHref: "/it/christmas/gift-finder",
        linkLabel: "Prova il ricercatore di regali di Natale",
      },
    ],
    faqs: [
      {
        q: "Come creo una lista dei desideri di Natale?",
        a: "Apri la pagina della lista dei desideri di Natale, scegli un titolo e crea la tua lista. Poi aggiungi subito i desideri.",
      },
      {
        q: "Posso aggiungere regali da qualsiasi negozio?",
        a: "Sì. Incolla il normale link di un prodotto, oppure aggiungi il regalo manualmente se la pagina non può essere letta automaticamente.",
      },
      {
        q: "Posso aggiungere desideri senza un link?",
        a: "Sì. Scrivi qualsiasi desiderio — esperienze, idee fatte a mano o un semplice «Sorprendimi».",
      },
      {
        q: "Posso condividere un solo link della lista?",
        a: "Sì. Attiva la condivisione e invia il link a familiari e amici.",
      },
      {
        q: "Chi la vede può prenotare i regali?",
        a: "Sì. Chi la vede può prenotare un regalo così gli altri sanno che è già coperto.",
      },
      {
        q: "Saprò chi ha comprato qualcosa?",
        a: "No. Le prenotazioni restano anonime così la sorpresa si conserva.",
      },
      {
        q: "Posso crearne una per mio figlio?",
        a: "Sì. Scegli per chi è la lista quando la crei, poi condividi il link con i parenti.",
      },
      {
        q: "Posso modificarla dopo averla condivisa?",
        a: "Sì. Aggiungi, modifica, riordina o rimuovi desideri in qualsiasi momento. Chi ha il link vedrà gli aggiornamenti.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "Generatore di Foto Natalizie con IA | Famiglia, Coppie e Animali",
    description:
      "Trasforma la tua foto preferita in un ritratto natalizio magico. Crea foto festose per famiglia, coppie e animali domestici in pochi minuti.",
    h1: "Trasforma la tua foto in magia natalizia",
    lede:
      "Carica una foto, scegli una scena natalizia festosa e crea un ritratto natalizio personalizzato che puoi scaricare e condividere in privato.",
    h2: "Stili di foto natalizie",
    h2Body: "Crea ritratti per famiglia, coppie, animali domestici, cani e gatti da un unico generatore di foto natalizie.",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
    ],
    links: [
      { href: "/it/christmas/family", label: "Ritratti di Natale in famiglia" },
      { href: "/it/christmas/couples", label: "Ritratti di Natale in coppia" },
      { href: "/it/christmas/pets", label: "Ritratti di Natale per animali domestici" },
      { href: "/it/christmas/dogs", label: "Ritratti di Natale per cani" },
      { href: "/it/christmas/cats", label: "Ritratti di Natale per gatti" },
      { href: "/it/christmas/cards", label: "Trasforma un ritratto in un biglietto di Natale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie con IA?",
      body:
        "Un generatore di foto natalizie con IA trasforma una foto reale che carichi in un ritratto natalizio festoso. Su TheDigitalGifter scegli chi appare nella foto, selezioni uno stile natalizio e crei un ritratto scaricabile per famiglia, coppie, persone o animali domestici — privato per impostazione predefinita.",
    },
    sections: [
      {
        h2: "Trasforma la tua foto in un ritratto natalizio",
        body:
          "Carica una foto che ti piace, scegli il tipo di soggetto, seleziona un'atmosfera natalizia e crea un ritratto festoso che puoi scaricare. L'obiettivo è un'immagine natalizia che continui a trasmettere le persone o gli animali che ami.",
      },
      {
        h2: "Esempi di foto natalizie",
        body:
          "Gli esempi dimostrativi mostrano direzioni comuni per i ritratti natalizi. Sono campioni ispirativi, non foto di clienti.",
        list: [
          "Foto di Natale in famiglia — un ritratto di gruppo in una scena natalizia accogliente",
          "Ritratto di Natale in coppia — un ritratto romantico di due persone",
          "Ritratto di Natale per cane — un ritratto festoso incentrato su un cane",
          "Ritratto di Natale per gatto — un ritratto festoso incentrato su un gatto",
          "Famiglia + animale domestico — persone e un animale domestico in un unico scatto natalizio",
        ],
      },
      {
        h2: "Stili di foto natalizie",
        body:
          "Gli stili natalizi disponibili includono Natale Accogliente, Paese delle Meraviglie Invernale, Natale di Lusso, Mattina di Natale, Baita Innevata, Natale Classico, Natale Bianco Elegante e Mercatino di Natale. Scegli lo stile più adatto al ricordo che vuoi creare.",
      },
      {
        h2: "Quali foto funzionano meglio?",
        body:
          "Usa una foto nitida con i volti visibili (o un animale ben a fuoco), buona illuminazione e abbastanza nitidezza perché tutte le persone che vuoi includere siano riconoscibili. Evita sfocature estreme, ritagli aggressivi o foto in cui persone importanti restano nascoste.",
      },
      {
        h2: "Foto natalizie per famiglie, coppie e animali domestici",
        body:
          "Cerchi un punto di partenza più specifico? Usa i percorsi dedicati per ritratti natalizi di famiglia, coppia, animali domestici, cani e gatti — oppure continua qui con il generatore di foto completo.",
        list: [
          "Ritratti di Natale in famiglia → /it/christmas/family",
          "Ritratti di Natale in coppia → /it/christmas/couples",
          "Ritratti di Natale per animali domestici → /it/christmas/pets",
          "Ritratti di Natale per cani → /it/christmas/dogs",
          "Ritratti di Natale per gatti → /it/christmas/cats",
          "Trasforma un ritratto in un biglietto di Natale → /it/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "Come funziona il generatore di foto natalizie?",
        a: "Carica una foto, scegli chi vi compare, seleziona uno stile natalizio, poi crea il tuo ritratto dopo il checkout quando richiesto dal flusso del prodotto.",
      },
      {
        q: "Quale foto dovrei caricare?",
        a: "Una foto nitida con volti visibili o un animale ben a fuoco funziona meglio. Una buona illuminazione aiuta. Evita sfocature estreme.",
      },
      {
        q: "Posso creare una foto di Natale in famiglia?",
        a: "Sì. Scegli famiglia come soggetto, oppure inizia dal percorso dedicato alla famiglia.",
      },
      {
        q: "Posso creare un ritratto natalizio del mio cane o del mio gatto?",
        a: "Sì. I soggetti animali sono supportati, con percorsi dedicati per cani e gatti per un avvio più chiaro.",
      },
      {
        q: "Possono comparire più persone?",
        a: "Sì, per i flussi famiglia e coppia. Carica una foto che includa tutte le persone che devono comparire.",
      },
      {
        q: "Posso provare stili diversi?",
        a: "Sì. Scegli tra gli stili natalizi disponibili indicati sulla pagina prima di creare il ritratto.",
      },
      {
        q: "Posso scaricare il risultato?",
        a: "Sì. Quando il tuo ritratto è pronto, scaricalo dalla schermata dei risultati.",
      },
      {
        q: "Cosa succede alla foto che carico?",
        a: "I caricamenti e i risultati sono privati per impostazione predefinita. Non esiste una galleria pubblica. L'accesso avviene tramite il tuo ordine o risultato.",
      },
    ],
  },

  "/christmas/family": {
    title: "Generatore di Foto Natalizie in Famiglia | Ritratti Familiari di Natale",
    description:
      "Crea un ritratto natalizio in famiglia personalizzato dalla tua foto preferita. Scegli una scena natalizia festosa e trasforma la tua foto in un ricordo.",
    h1: "Trasforma la tua foto di famiglia in un ritratto natalizio magico",
    lede:
      "Crea un ritratto natalizio in famiglia personalizzato dalla tua foto preferita. Scegli una scena natalizia festosa e trasforma la tua foto in un ricordo.",
    h2: "Altri ritratti natalizi",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
      { href: "/it/christmas/family", label: "Famiglia" },
    ],
    links: [
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas/couples", label: "Ritratti di Natale in coppia" },
      { href: "/it/christmas/pets", label: "Ritratti di Natale per animali domestici" },
      { href: "/it/christmas/cards", label: "Creatore di biglietti di Natale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie in famiglia?",
      body:
        "Un generatore di foto natalizie in famiglia trasforma una foto di famiglia che carichi in un ritratto di gruppo natalizio e festoso. Su TheDigitalGifter carichi una foto nitida della tua famiglia, scegli uno stile natalizio pensato per più persone e crei un ritratto scaricabile — privato per impostazione predefinita, con la possibilità di continuare verso un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Crea un ritratto natalizio in famiglia",
        body:
          "Questa esperienza è pensata appositamente per le famiglie — non è uno stile generico per una sola persona. Carica una foto di gruppo, scegli un'atmosfera natalizia e crea un ritratto che cerca di mantenere tutti nell'inquadratura.",
      },
      {
        h2: "Esempi di foto natalizie in famiglia",
        body:
          "Gli esempi dimostrativi mostrano direzioni comuni per i ritratti natalizi in famiglia. Sono campioni ispirativi, non foto di clienti.",
        list: [
          "Genitori con figli in un salotto natalizio accogliente",
          "Famiglia di tre o quattro persone accanto a un albero decorato",
          "Riunione di famiglia più numerosa in una scena festosa",
          "Ritratti multigenerazionali con i nonni",
          "Famiglia con un animale domestico chiaramente visibile nella stessa inquadratura",
        ],
      },
      {
        h2: "Stili natalizi per famiglie",
        body:
          "Gli stili per famiglie disponibili oggi includono Natale in Famiglia Classico, Caminetto Accogliente, Paese delle Meraviglie Invernale, Natale Elegante, Mattina di Natale, Natale di Lusso, Film di Natale e Natale in Famiglia Vintage.",
      },
      {
        h2: "Quali foto di famiglia funzionano meglio?",
        body:
          "Usa una foto di gruppo nitida in cui i volti sono visibili, l'illuminazione è buona e tutte le persone che vuoi includere sono riconoscibili. Evita sfocature estreme, ritagli aggressivi o foto in cui persone importanti restano nascoste.",
      },
      {
        h2: "Biglietti di Natale in famiglia",
        body:
          "Quando il tuo ritratto di famiglia è pronto, puoi continuare nel creatore di biglietti di Natale e completarlo con un messaggio.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Trasforma il tuo ritratto di famiglia in un biglietto di Natale",
      },
      {
        h2: "Altri ritratti natalizi",
        body:
          "Cerchi un soggetto diverso? Inizia dal generatore di foto completo oppure passa a coppie e animali domestici.",
        list: [
          "Generatore di foto natalizie con IA → /it/christmas/photo-generator",
          "Ritratti di Natale in coppia → /it/christmas/couples",
          "Ritratti di Natale per animali domestici → /it/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Posso creare un ritratto natalizio da una foto di famiglia?",
        a: "Sì. Carica una foto di famiglia nitida, scegli uno stile natalizio e crea il tuo ritratto familiare.",
      },
      {
        q: "Possono comparire più persone?",
        a: "Sì. Questo percorso è pensato per i gruppi. Mantieni tutti chiaramente visibili nella foto originale.",
      },
      {
        q: "Possono comparire i nonni?",
        a: "Sì. Le foto multigenerazionali — inclusi nonni e neonati — sono benvenute quando i volti sono visibili.",
      },
      {
        q: "Posso includere l'animale domestico di famiglia?",
        a: "Sì, quando l'animale è chiaramente visibile nella foto di famiglia. Per ritratti dedicati solo all'animale, usa le esperienze Animali, Cani o Gatti.",
      },
      {
        q: "Quali foto funzionano meglio?",
        a: "Foto nitide con volti visibili, buona illuminazione e tutte le persone che vuoi includere. Evita sfocature estreme.",
      },
      {
        q: "Posso provare più stili natalizi?",
        a: "Sì. Scegli tra gli stili natalizi per famiglie della pagina, e puoi provare un altro stile dopo aver creato un ritratto.",
      },
      {
        q: "Posso scaricare il ritratto finito?",
        a: "Sì. Quando il tuo ritratto è pronto, scaricalo dalla schermata dei risultati.",
      },
      {
        q: "Posso usarlo in un biglietto di Natale?",
        a: "Sì. Il passaggio al creatore di biglietti di Natale è supportato.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Generatore di Foto Natalizie in Coppia | Ritratti Romantici di Natale",
    description:
      "Crea un ritratto natalizio romantico in coppia dalla tua foto. Perfetto per il vostro primo Natale insieme o per un regalo personalizzato di coppia.",
    h1: "Crea un ritratto natalizio magico insieme",
    lede:
      "Carica una foto di voi due e crea un ritratto natalizio romantico di coppia — privato per impostazione predefinita.",
    h2: "Altri ritratti natalizi",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
      { href: "/it/christmas/couples", label: "Coppia" },
    ],
    links: [
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas/family", label: "Ritratti di Natale in famiglia" },
      { href: "/it/christmas/pets", label: "Ritratti di Natale per animali domestici" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie in coppia?",
      body:
        "Un generatore di foto natalizie in coppia trasforma una foto di due persone in un ritratto natalizio romantico o accogliente. Su TheDigitalGifter carichi una foto in cui comparite entrambi, scegli uno stile natalizio per coppie e crei un ritratto scaricabile da condividere in privato o usare in un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Crea un ritratto natalizio insieme",
        body:
          "Questa esperienza è per due persone — partner, fidanzati, marito e moglie, o fidanzato e fidanzata. Carica una foto in cui entrambi siete chiaramente visibili, scegli un'atmosfera natalizia e crea un ritratto pensato per voi due.",
      },
      {
        h2: "Idee per foto natalizie in coppia",
        body:
          "Casi d'uso frequenti per questo ritratto — come ispirazione, non modalità separate del prodotto:",
        list: [
          "Primo Natale insieme",
          "Ritratto natalizio di coppia fidanzata",
          "Ritratto natalizio di marito e moglie",
          "Foto natalizia di fidanzato e fidanzata",
          "Sorpresa natalizia a distanza da condividere digitalmente",
          "Foto natalizia di coppia per un biglietto",
        ],
      },
      {
        h2: "Stili natalizi romantici",
        body:
          "Gli stili di coppia disponibili oggi includono Nevicata Romantica, Caminetto Accogliente, Film di Natale, Natale Elegante, Città Invernale, Mercatino di Natale, Ritratto Classico e Natale Vintage.",
      },
      {
        h2: "Quali foto di coppia funzionano meglio?",
        body:
          "Usa una foto nitida in cui entrambi i volti sono visibili e nessuno è tagliato pesantemente. Una buona illuminazione aiuta. I selfie funzionano bene quando entrambe le persone sono riconoscibili.",
      },
      {
        h2: "Trasformalo in un biglietto di Natale",
        body:
          "Dopo aver creato un ritratto di coppia, puoi portarlo nel creatore di biglietti di Natale.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Trasforma il tuo ritratto di coppia in un biglietto di Natale",
      },
      {
        h2: "Ritratti natalizi correlati",
        body: "Ti serve un ritratto di famiglia o di animale domestico?",
        list: [
          "Ritratti di Natale in famiglia → /it/christmas/family",
          "Generatore di foto natalizie con IA → /it/christmas/photo-generator",
          "Ritratti di Natale per animali domestici → /it/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Posso usare un selfie?",
        a: "Sì, quando entrambe le persone sono chiaramente visibili e riconoscibili nella stessa foto.",
      },
      {
        q: "Entrambe le persone restano riconoscibili?",
        a: "Questo è l'obiettivo. Inizia con una foto nitida di entrambi i volti — evita sfocature estreme o una persona quasi fuori inquadratura.",
      },
      {
        q: "Posso creare un ritratto natalizio romantico?",
        a: "Sì. Scegli stili romantici o accoglienti come Nevicata Romantica, Caminetto Accogliente o Natale Elegante.",
      },
      {
        q: "Posso provare stili diversi?",
        a: "Sì. Scegli tra gli stili di coppia della pagina prima di creare il ritratto.",
      },
      {
        q: "Posso usare il risultato come biglietto di Natale?",
        a: "Sì. Il passaggio al creatore di biglietti di Natale è supportato.",
      },
      {
        q: "Posso scaricarlo?",
        a: "Sì. Scarica il ritratto di coppia finito dalla schermata dei risultati quando è pronto.",
      },
      {
        q: "Che tipo di foto dovrei caricare?",
        a: "Una foto nitida che includa entrambi. I volti devono essere visibili; funzionano JPEG, PNG o WebP.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Generatore di Foto Natalizie per Animali Domestici | Ritratti Festosi",
    description:
      "Trasforma la foto del tuo animale domestico in un ritratto natalizio festoso. Cani e gatti benvenuti — privato per impostazione predefinita.",
    h1: "Trasforma il tuo animale domestico in magia natalizia",
    lede:
      "Carica una foto nitida del tuo animale domestico e crea un ritratto natalizio festoso per cani o gatti.",
    h2: "Ritratti natalizi per specie",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
      { href: "/it/christmas/pets", label: "Animali domestici" },
    ],
    links: [
      { href: "/it/christmas/dogs", label: "Ritratti di Natale per cani" },
      { href: "/it/christmas/cats", label: "Ritratti di Natale per gatti" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie per animali domestici?",
      body:
        "Un generatore di foto natalizie per animali domestici trasforma la foto di un cane, un gatto o un altro animale in un ritratto natalizio festoso. Su TheDigitalGifter, la pagina Animali domestici è il punto di partenza per i ritratti natalizi degli animali, con percorsi specifici per cani e gatti, risultati scaricabili e un passaggio opzionale verso un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Trasforma il tuo animale domestico in magia natalizia",
        body:
          "Carica una foto nitida del tuo animale domestico, scegli uno stile natalizio per animali e crea un ritratto festoso dell'animale che ami. Questo è il punto di partenza generale per gli animali — non un pacchetto tematico specifico.",
      },
      {
        h2: "Ritratti natalizi per cani e gatti",
        body:
          "Vuoi un punto di partenza più chiaro per una specie? Usa i percorsi specifici per cani o gatti — aiutano a convalidare la foto e mantengono l'esperienza incentrata su cani o gatti.",
        list: [
          "Generatore di foto natalizie per cani → /it/christmas/dogs",
          "Generatore di foto natalizie per gatti → /it/christmas/cats",
        ],
      },
      {
        h2: "Esempi di foto natalizie per animali domestici",
        body:
          "Direzioni dimostrative per i ritratti natalizi di animali domestici. I campioni sono ispirazione, non foto di clienti.",
        list: [
          "Ritratto natalizio di cane in una scena festosa",
          "Ritratto natalizio di gatto accanto a un albero o un caminetto",
          "Stili di ritratto con maglione natalizio o ispirati a Babbo Natale",
        ],
      },
      {
        h2: "Stili natalizi per animali domestici",
        body:
          "Gli stili per animali domestici disponibili oggi includono Animale con Babbo Natale, Natale Accogliente, Polo Nord, Maglione Natalizio, Ritratto sulla Neve, Biglietto di Natale, Natale Reale e Natale Vintage.",
      },
      {
        h2: "Quali foto di animali domestici funzionano meglio?",
        body:
          "Scegli una foto nitida con il volto e gli occhi dell'animale visibili, buona illuminazione e senza sfocature estreme. Se deve comparire più di un animale, assicurati che ognuno sia visibile nella foto caricata.",
      },
      {
        h2: "Biglietti di Natale con il tuo animale domestico",
        body: "Puoi portare un ritratto di animale domestico terminato nel creatore di biglietti di Natale.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Trasforma il ritratto del tuo animale domestico in un biglietto di Natale",
      },
    ],
    faqs: [
      {
        q: "Posso creare un ritratto natalizio del mio cane?",
        a: "Sì. Inizia qui oppure vai alla pagina dedicata ai ritratti natalizi per cani per un percorso mirato.",
      },
      {
        q: "Posso crearne uno per il mio gatto?",
        a: "Sì. Usa questa pagina Animali domestici oppure la pagina dedicata ai gatti.",
      },
      {
        q: "Posso includere più di un animale domestico?",
        a: "Se più animali sono chiaramente visibili in un'unica foto, puoi provare quel caricamento. I risultati sono migliori quando il volto di ogni animale è ben visibile.",
      },
      {
        q: "Posso comparire io insieme al mio animale domestico?",
        a: "Questo percorso è ottimizzato per avere l'animale come protagonista. Per foto di famiglia con animale incluso, l'esperienza Famiglia è spesso un punto di partenza migliore.",
      },
      {
        q: "Quali foto funzionano meglio?",
        a: "Foto nitide di animali con occhi e volto visibili, buona illuminazione e sfocatura limitata.",
      },
      {
        q: "Posso scaricare l'immagine?",
        a: "Sì. Scarica dalla schermata dei risultati quando il ritratto del tuo animale domestico è pronto.",
      },
      {
        q: "Posso usarlo su un biglietto di Natale?",
        a: "Sì. Il passaggio al creatore di biglietti di Natale è supportato.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Generatore di Foto Natalizie per Cani | Ritratti Festosi per Cani",
    description:
      "Crea un ritratto natalizio magico del tuo cane da una foto nitida. Verifica della specie e privato per impostazione predefinita.",
    h1: "Crea un ritratto natalizio magico del tuo cane",
    lede:
      "Carica una foto nitida del tuo cane, scegli uno stile festoso e crea un ritratto natalizio per cani.",
    h2: "Ritratti di animali correlati",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
      { href: "/it/christmas/pets", label: "Animali domestici" },
      { href: "/it/christmas/dogs", label: "Cani" },
    ],
    links: [
      { href: "/it/christmas/cats", label: "Ritratti di Natale per gatti" },
      { href: "/it/christmas/pets", label: "Tutti i ritratti di Natale per animali domestici" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie per cani?",
      body:
        "Un generatore di foto natalizie per cani crea un ritratto natalizio festoso a partire da una foto del tuo cane. Su TheDigitalGifter carichi una foto nitida del tuo cane, scegli uno stile natalizio per animali e scarichi un ritratto festoso incentrato sul cane — con un percorso opzionale verso un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Crea un ritratto natalizio del tuo cane",
        body:
          "Questa pagina è specifica per i cani. Carica una foto del tuo cane, scegli uno stile natalizio e crea un ritratto festoso che mantiene il cane come chiaro protagonista. Se la foto sembra di un gatto, verrai indirizzato all'esperienza per gatti.",
      },
      {
        h2: "Esempi di ritratti natalizi per cani",
        body:
          "Direzioni dimostrative per ritratti natalizi di cani — campioni ispirativi, non foto di clienti.",
        list: [
          "Cane accanto a un albero di Natale decorato",
          "Ritratto natalizio del cane accanto al caminetto",
          "Ritratto natalizio del cane nella neve",
          "Ritratto di cane ispirato a Babbo Natale o in stile maglione natalizio",
        ],
      },
      {
        h2: "Stili natalizi per cani",
        body:
          "I ritratti per cani usano il set di stili natalizi per animali: Animale con Babbo Natale, Natale Accogliente, Polo Nord, Maglione Natalizio, Ritratto sulla Neve, Biglietto di Natale, Natale Reale e Natale Vintage.",
      },
      {
        h2: "Come scegliere una buona foto del tuo cane",
        body:
          "Scegli una foto in cui gli occhi e il volto del cane sono visibili, la testa non è troppo tagliata e la sfocatura è minima. Per più di un cane, assicurati che ogni cane che vuoi includere sia chiaramente nell'inquadratura.",
      },
      {
        h2: "Biglietti di Natale con il tuo cane",
        body: "I ritratti di cani finiti possono continuare nel creatore di biglietti di Natale.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Crea un biglietto di Natale con il ritratto del tuo cane",
      },
      {
        h2: "Ritratti natalizi per animali correlati",
        body: "Vuoi esplorare altri animali o il punto di partenza generale per animali domestici?",
        list: [
          "Ritratti di Natale per animali domestici → /it/christmas/pets",
          "Generatore di foto natalizie per gatti → /it/christmas/cats",
          "Generatore di foto natalizie con IA → /it/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Posso creare un ritratto natalizio del mio cane?",
        a: "Sì. Carica una foto nitida del tuo cane in questa pagina, scegli uno stile natalizio e crea il ritratto.",
      },
      {
        q: "Cosa succede se carico per errore una foto di gatto?",
        a: "Riceverai un suggerimento per passare all'esperienza di ritratti natalizi per gatti.",
      },
      {
        q: "Posso includere più di un cane?",
        a: "Sì, se ogni cane è chiaramente visibile nella stessa foto. Volti e occhi devono essere ben visibili.",
      },
      {
        q: "Quali foto di cani funzionano meglio?",
        a: "Volto e occhi nitidi, sfocatura limitata, ed evitare di tagliare orecchie o testa.",
      },
      {
        q: "Posso provare stili natalizi diversi per il mio cane?",
        a: "Sì. Scegli tra gli stili natalizi per animali domestici indicati sulla pagina.",
      },
      {
        q: "Posso scaricare il ritratto del mio cane?",
        a: "Sì. Scaricalo dalla schermata dei risultati quando è pronto.",
      },
      {
        q: "Posso mettere il mio cane su un biglietto di Natale?",
        a: "Sì. Usa il passaggio al creatore di biglietti di Natale dopo che il ritratto è pronto.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Generatore di Foto Natalizie per Gatti | Ritratti Festosi per Gatti",
    description:
      "Crea un ritratto natalizio magico del tuo gatto da una foto nitida. Verifica della specie e privato per impostazione predefinita.",
    h1: "Crea un ritratto natalizio magico del tuo gatto",
    lede:
      "Carica una foto nitida del tuo gatto, scegli uno stile festoso e crea un ritratto natalizio per gatti.",
    h2: "Ritratti di animali correlati",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto" },
      { href: "/it/christmas/pets", label: "Animali domestici" },
      { href: "/it/christmas/cats", label: "Gatti" },
    ],
    links: [
      { href: "/it/christmas/dogs", label: "Ritratti di Natale per cani" },
      { href: "/it/christmas/pets", label: "Tutti i ritratti di Natale per animali domestici" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie con IA" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di foto natalizie per gatti?",
      body:
        "Un generatore di foto natalizie per gatti crea un ritratto natalizio festoso a partire da una foto del tuo gatto. Su TheDigitalGifter carichi una foto nitida del tuo gatto, scegli uno stile natalizio per animali e scarichi un ritratto festoso incentrato sul gatto, utilizzabile anche in un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Crea un ritratto natalizio magico del tuo gatto",
        body:
          "Questa pagina è specifica per i gatti. Carica una foto del tuo gatto, scegli un'atmosfera natalizia e crea un ritratto festoso con il gatto come protagonista. Le foto di cani vengono reindirizzate all'esperienza per cani.",
      },
      {
        h2: "Esempi di ritratti natalizi per gatti",
        body:
          "Direzioni dimostrative con gatti — campioni ispirativi, non foto di clienti.",
        list: [
          "Gatto accanto a un albero di Natale",
          "Ritratto natalizio accogliente del gatto vicino al caminetto",
          "Ritratto natalizio del gatto nella neve o in stile elegante",
          "Stili di ritratto del gatto in versione reale o vintage",
        ],
      },
      {
        h2: "Stili natalizi per gatti",
        body:
          "I ritratti per gatti usano il set di stili natalizi per animali: Animale con Babbo Natale, Natale Accogliente, Polo Nord, Maglione Natalizio, Ritratto sulla Neve, Biglietto di Natale, Natale Reale e Natale Vintage.",
      },
      {
        h2: "Come scegliere una buona foto del tuo gatto",
        body:
          "Scegli una foto in cui gli occhi e il volto del tuo gatto sono nitidi e visibili. Evita sfocature estreme, ombre marcate sul volto o ritagli troppo stretti che tagliano orecchie e baffi.",
      },
      {
        h2: "Trasforma il ritratto del tuo gatto in un biglietto di Natale",
        body: "Dopo aver creato un ritratto natalizio del tuo gatto, puoi continuare nel creatore di biglietti di Natale.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Crea un biglietto di Natale con il ritratto del tuo gatto",
      },
      {
        h2: "Ritratti natalizi per animali correlati",
        body: "Ti servono cani o il punto di partenza generale per animali domestici?",
        list: [
          "Ritratti di Natale per animali domestici → /it/christmas/pets",
          "Generatore di foto natalizie per cani → /it/christmas/dogs",
          "Generatore di foto natalizie con IA → /it/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Posso creare un ritratto natalizio del mio gatto?",
        a: "Sì. Carica una foto nitida del tuo gatto qui, scegli uno stile natalizio e crea il ritratto.",
      },
      {
        q: "Cosa succede se carico una foto di un cane?",
        a: "Riceverai un suggerimento per passare alla pagina dei ritratti natalizi per cani.",
      },
      {
        q: "Il dettaglio dei baffi e del volto è importante?",
        a: "Sì. Un buon dettaglio su volto e occhi produce solitamente un ritratto natalizio del gatto più riuscito.",
      },
      {
        q: "Posso provare stili eleganti o accoglienti per il mio gatto?",
        a: "Sì. Gli stili includono Natale Accogliente, Natale Reale, Natale Vintage, Ritratto sulla Neve e altro.",
      },
      {
        q: "Posso scaricare il ritratto del mio gatto?",
        a: "Sì. Scaricalo dalla schermata dei risultati quando è pronto.",
      },
      {
        q: "Posso usare il ritratto del mio gatto su un biglietto di Natale?",
        a: "Sì. Il passaggio al creatore di biglietti è supportato dopo la creazione del ritratto.",
      },
      {
        q: "È diverso dalla pagina Animali domestici?",
        a: "Sì. Animali domestici è il punto di partenza generale per gli animali; questa pagina è specifica per i gatti.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Video Personalizzato di Babbo Natale | Babbo Natale Dice il Nome di Tuo Figlio",
    description:
      "Crea un video natalizio personalizzato di Babbo Natale che può includere il nome del destinatario e altri dettagli personali supportati.",
    h1: "Crea un video personalizzato di Babbo Natale",
    lede:
      "Crea un video natalizio personalizzato di Babbo Natale che può includere il nome del destinatario e altri dettagli personali supportati.",
    h2: "Come funzionano i video di Babbo Natale",
    h2Body: "Racconta a Babbo Natale per chi è, aggiungi qualche dettaglio e crea un video natalizio personalizzato.",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/santa-video", label: "Video di Babbo Natale" },
    ],
    links: [
      { href: "/it/christmas/family", label: "Ritratti di Natale in famiglia" },
      { href: "/it/christmas/cards", label: "Creatore di biglietti di Natale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un video personalizzato di Babbo Natale?",
      body:
        "Un video personalizzato di Babbo Natale è un video con un messaggio natalizio di Babbo Natale che può includere il nome del destinatario e altri dettagli che fornisci. Su TheDigitalGifter rispondi a un breve modulo guidato, rivedi il messaggio e poi crei un video che puoi scaricare e condividere. Il video viene generato in inglese o rumeno; oggi non offriamo una voce di Babbo Natale in italiano.",
    },
    sections: [
      {
        h2: "Un messaggio personalizzato da Babbo Natale",
        body:
          "Crea un video natalizio di Babbo Natale per un bambino, i fratelli, la famiglia o qualcuno di speciale. Babbo Natale può dire il suo nome e includere dettagli opzionali che condividi — poi scarichi o condividi il video finito.",
      },
      {
        h2: "Cosa può menzionare Babbo Natale?",
        body:
          "Puoi personalizzare con il nome del destinatario, l'età opzionale, qualcosa che ha fatto bene quest'anno, un desiderio di Natale, un dettaglio extra (come un animale domestico o un hobby) e la lingua di Babbo Natale. Le lingue supportate oggi sono l'inglese e il rumeno.",
        list: [
          "Nome del destinatario",
          "Età opzionale",
          "Qualcosa che ha fatto bene",
          "Desiderio di Natale",
          "Dettaglio personale aggiuntivo",
          "Lingua: inglese o rumeno",
        ],
      },
      {
        h2: "Esempi di video personalizzati di Babbo Natale",
        body:
          "Gli esempi dimostrativi mostrano come può risultare un messaggio personalizzato di Babbo Natale. Sono dimostrazioni del prodotto a scopo ispirativo, non testimonianze di clienti.",
      },
      {
        h2: "Come funziona",
        body:
          "Racconta a Babbo Natale per chi è il messaggio, aggiungi i dettagli che vuoi che menzioni, rivedi l'anteprima del messaggio, crea il video e poi scaricalo o condividilo quando è pronto.",
        list: [
          "Racconta a Babbo Natale di questa persona",
          "Rivedi il messaggio",
          "Crea il video",
          "Scarica o condividi",
        ],
      },
      {
        h2: "Altra magia natalizia",
        body:
          "Dopo Babbo Natale, molte famiglie creano anche un ritratto o un biglietto di Natale per la stessa persona.",
        linkHref: "/it/christmas",
        linkLabel: "Torna a Natale su TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "Babbo Natale può dire il nome di mio figlio?",
        a: "Sì. Il nome del destinatario è un campo di personalizzazione fondamentale e Babbo Natale lo dice nel video.",
      },
      {
        q: "Cosa posso personalizzare?",
        a: "Nome, età opzionale, qualcosa che ha fatto bene, desiderio di Natale, un dettaglio extra e la lingua (inglese o rumeno).",
      },
      {
        q: "Babbo Natale può menzionare un regalo di Natale?",
        a: "Sì — puoi includere un desiderio di Natale, e Babbo Natale può menzionarlo se lo indichi.",
      },
      {
        q: "Posso fare un video per più fratelli?",
        a: "Sì. Scegli l'opzione fratelli e includi i loro nomi nel passaggio dedicato. Un flusso specifico per più bambini potrebbe arrivare più avanti.",
      },
      {
        q: "Babbo Natale può parlare in italiano?",
        a: "Non ancora. Oggi Babbo Natale parla in inglese o rumeno nel video, anche se l'intera pagina e il modulo sono in italiano. Non promettiamo per ora un video con voce in italiano.",
      },
      {
        q: "Posso rivedere il messaggio in anticipo?",
        a: "Sì. Puoi rivedere il messaggio prima di creare il video.",
      },
      {
        q: "Posso scaricare o condividere il video?",
        a: "Sì. Quando il video è pronto, puoi scaricare l'MP4 e condividerlo.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Albero di Natale Digitale | Regali, Messaggi e Ricordi",
    description:
      "Costruisci un albero di Natale digitale pieno di regali, messaggi e ricordi che puoi decorare e condividere in sicurezza.",
    h1: "Costruisci un albero di Natale pieno di sorprese",
    lede:
      "Crea, decora e condividi un albero di Natale digitale personalizzato con regali e messaggi sotto.",
    h2: "Abbinalo ai regali di Natale",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/tree", label: "Albero digitale" },
    ],
    links: [
      { href: "/it/christmas/wishlist", label: "Creatore di liste dei desideri di Natale" },
      { href: "/it/christmas/gift-finder", label: "Ricercatore di regali di Natale" },
      { href: "/it/christmas/messages", label: "Generatore di messaggi di Natale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un albero di Natale digitale?",
      body:
        "Un albero di Natale digitale è un albero di Natale interattivo online che puoi personalizzare e condividere. Su TheDigitalGifter scegli un aspetto per l'albero, aggiungi decorazioni, posizioni scatole regalo con messaggi personali sotto e condividi un link privato affinché qualcuno di speciale possa aprire i regali sul proprio schermo — senza trasformare la pagina condivisa in un risultato di ricerca pubblico.",
    },
    sections: [
      {
        h2: "Costruisci un albero di Natale digitale",
        body:
          "Crea un albero di Natale interattivo e gratuito nel tuo browser. Personalizza lo stile (Classico, Innevato, Dorato, Accogliente, Minimal o Magico), le luci, la neve, la punta e gli addobbi, poi posiziona scatole regalo sotto.",
      },
      {
        h2: "Cosa puoi mettere sotto il tuo albero?",
        body:
          "Oggi puoi aggiungere scatole regalo che contengono messaggi personali di Natale. Ogni regalo può usare uno stile di scatola festoso come rosso, dorato, verde, blu o neve. Altri tipi di regalo potrebbero arrivare più avanti — il creatore attuale si concentra sui regali con messaggio.",
        list: [
          "Messaggi personali di Natale dentro scatole regalo",
          "Stili di scatola festosi (rosso, dorato, verde, blu, neve)",
        ],
      },
      {
        h2: "Condividi il tuo albero di Natale",
        body:
          "Quando sei pronto, attiva la condivisione e invia un link. Chi lo riceve può aprire l'albero per vedere le decorazioni e scartare i regali. I link degli alberi condivisi sono pensati per persone di fiducia e non sono indicizzati per i motori di ricerca.",
      },
      {
        h2: "Un regalo pensato per essere aperto",
        body:
          "Chi riceve il link può toccare i regali sotto l'albero per scoprire i messaggi che hai lasciato — un momento digitale pensato per sembrare qualcosa messo lì apposta per quella persona.",
      },
      {
        h2: "Come funziona",
        body: "Un percorso semplice da un albero vuoto a una sorpresa natalizia condivisibile.",
        list: [
          "Crea e personalizza il tuo albero di Natale digitale",
          "Aggiungi scatole regalo con messaggi",
          "Attiva la condivisione e invia il link",
          "Aprono i regali sotto l'albero",
        ],
      },
      {
        h2: "Altra magia natalizia",
        body:
          "Abbina il tuo albero ad altre creazioni natalizie quando vuoi qualcosa in più nell'atmosfera festiva.",
        list: [
          "Home di Natale → /it/christmas",
          "Video personalizzato di Babbo Natale → /it/christmas/santa-video",
          "Calendario dell'Avvento online → /it/christmas/advent",
        ],
      },
    ],
    faqs: [
      {
        q: "Cos'è un albero di Natale digitale?",
        a: "Un albero di Natale interattivo online che personalizzi, riempi di regali con messaggio e condividi affinché qualcuno possa aprirli sul proprio dispositivo.",
      },
      {
        q: "Cosa posso aggiungere?",
        a: "Oggi puoi aggiungere scatole regalo con messaggi personali di Natale e scegliere stili di scatola festosi.",
      },
      {
        q: "Posso condividerlo con qualcuno?",
        a: "Sì. Attiva la condivisione e invia il link. Trattalo come un link regalo personale.",
      },
      {
        q: "Chi riceve il link può aprire i regali?",
        a: "Sì. Può toccare i regali sotto l'albero per scoprire i messaggi che hai aggiunto.",
      },
      {
        q: "Posso aggiungere un video di Babbo Natale o una foto natalizia sotto l'albero?",
        a: "Non come tipo di regalo dedicato nell'attuale creatore di alberi. Puoi comunque creare quelle esperienze separatamente e menzionarle in un regalo con messaggio.",
      },
      {
        q: "Serve un account?",
        a: "Puoi iniziare a creare un albero senza una configurazione complessa — la proprietà è gestita tramite la sessione di creazione così puoi continuare a modificarlo.",
      },
      {
        q: "L'albero condiviso è pubblico?",
        a: "Gli alberi condivisi sono accessibili a chi ha il link, ma le pagine condivise sono noindex e non pensate per i motori di ricerca.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Calendario dell'Avvento di Natale Online | Una Sorpresa Ogni Giorno",
    description:
      "Apri una nuova sorpresa natalizia digitale ogni giorno dal 1° al 24 dicembre.",
    h1: "Un po' di magia natalizia ogni giorno",
    lede:
      "Apri una nuova sorpresa natalizia digitale ogni giorno dal 1° al 24 dicembre.",
    h2: "Altra magia natalizia",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/advent", label: "Calendario dell'Avvento" },
    ],
    links: [
      { href: "/it/christmas/santa-video", label: "Video personalizzato di Babbo Natale" },
      { href: "/it/christmas/cards", label: "Creatore di biglietti di Natale" },
      { href: "/it/christmas/wishlist", label: "Lista dei desideri di Natale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un calendario dell'Avvento online?",
      body:
        "Un calendario dell'Avvento online è la versione digitale del tradizionale calendario dell'Avvento: ogni giorno di dicembre si apre una nuova porta fino ad arrivare a Natale. Su TheDigitalGifter apri la porta di oggi su un calendario dall'1 al 24 (orario Europa/Bucarest). Le porte dei giorni passati restano chiuse dopo che il giorno è trascorso, e alcuni premi potrebbero richiedere l'accesso quando i riscatti sono attivi.",
    },
    sections: [
      {
        h2: "Un po' di magia natalizia ogni giorno",
        body:
          "Il calendario dell'Avvento è un conto alla rovescia con ventiquattro porte. Ogni giorno di dicembre ha la propria porta — un piccolo rituale di scoprire qualcosa di nuovo man mano che si avvicina il Natale.",
      },
      {
        h2: "Apri una nuova porta ogni giorno",
        body:
          "Le porte seguono il giorno del calendario nel fuso orario Europa/Bucarest. Solo la porta di oggi è disponibile per l'apertura. Le porte future restano bloccate. I giorni persi non si riaprono in seguito.",
      },
      {
        h2: "Cosa può esserci dietro le porte?",
        body:
          "I premi delle porte sono momenti natalizi configurati per la stagione — come un riscatto quando i premi in produzione sono attivi. La disponibilità può dipendere dalle impostazioni della stagione e dall'accesso effettuato.",
      },
      {
        h2: "Prima del 1° dicembre",
        body:
          "Prima che inizi la finestra dell'Avvento, le porte sono mostrate come prossimamente. Torna quando inizia dicembre per aprire il primo giorno.",
      },
      {
        h2: "Come funziona il calendario dell'Avvento",
        body: "Passaggi semplici per l'esperienza digitale dell'Avvento.",
        list: [
          "Apri la pagina del calendario dell'Avvento",
          "Trova la porta di oggi (1–24 in dicembre)",
          "Aprila quando è disponibile",
          "Accedi se un riscatto lo richiede",
        ],
      },
      {
        h2: "Altra magia natalizia",
        body: "Continua la stagione con un albero digitale o la home di Natale.",
        list: [
          "Albero di Natale digitale → /it/christmas/tree",
          "Home di Natale → /it/christmas",
        ],
      },
    ],
    faqs: [
      {
        q: "Quando inizia il calendario dell'Avvento?",
        a: "Le porte corrispondono ai giorni di dicembre dall'1 al 24. Prima del 1° dicembre, le porte appaiono come prossimamente.",
      },
      {
        q: "Quando si apre ogni porta?",
        a: "Ogni porta si apre nel proprio giorno del calendario secondo il fuso orario Europa/Bucarest.",
      },
      {
        q: "Posso aprire porte precedenti?",
        a: "No. I giorni persi restano chiusi — solo la porta di oggi è disponibile.",
      },
      {
        q: "Il calendario è gratuito?",
        a: "Esplorare l'esperienza del calendario è gratuito. Alcuni riscatti dei premi possono richiedere un account quando sono attivi per la stagione.",
      },
      {
        q: "Cosa posso trovare dietro una porta?",
        a: "Sorprese natalizie stagionali configurate per quel giorno quando i riscatti sono attivi — non una garanzia di premi in denaro o crediti negozio ogni giorno.",
      },
      {
        q: "Serve un account?",
        a: "Puoi vedere il calendario senza un account. Riscattare alcuni premi delle porte può richiedere l'accesso.",
      },
      {
        q: "Posso usarlo su mobile?",
        a: "Sì. Il calendario dell'Avvento è progettato per funzionare sia su telefono che su computer.",
      },
      {
        q: "Posso condividerlo?",
        a: "Puoi condividere il link della pagina del calendario dell'Avvento così altri possono aprire le proprie porte giornaliere.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Creatore di Biglietti di Natale | Biglietti di Natale Personalizzati",
    description:
      "Crea un biglietto di Natale personalizzato che vorranno conservare — scegli un design, aggiungi il tuo messaggio e condividi o scarica.",
    h1: "Crea un biglietto di Natale che vorranno conservare",
    lede:
      "Progetta un biglietto di Natale personalizzato con layout festosi e il tuo messaggio. Alcuni messaggi meritano più di un semplice testo.",
    h2: "Abbinalo ai messaggi di Natale",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/cards", label: "Biglietti" },
    ],
    links: [
      { href: "/it/christmas/messages", label: "Generatore di messaggi di Natale" },
      { href: "/it/christmas/photo-generator", label: "Generatore di foto natalizie" },
      { href: "/it/christmas/family", label: "Ritratti di Natale in famiglia" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un creatore online di biglietti di Natale?",
      body:
        "Un creatore online di biglietti di Natale ti permette di creare un biglietto personalizzato con una foto, un design festoso e il tuo messaggio. Su TheDigitalGifter puoi caricare una foto o usare un ritratto natalizio, scegliere uno stile, scrivere il tuo messaggio in italiano e poi scaricare un PNG o condividere il biglietto digitalmente.",
    },
    sections: [
      {
        h2: "Crea un biglietto di Natale personalizzato",
        body:
          "Scegli uno stile di biglietto di Natale, aggiungi la tua foto, scrivi un messaggio e crea un biglietto digitale che puoi scaricare o condividere. Alcuni messaggi meritano più di un semplice testo — questo è pensato per quei momenti.",
      },
      {
        h2: "Esempi di biglietti di Natale",
        body:
          "Esplora direzioni come biglietti familiari, di coppia, con animali domestici, eleganti, divertenti e classici. Gli esempi sono ispirazione di design per gli stili disponibili nel creatore.",
        list: ["Familiare", "Di coppia", "Con animale domestico", "Elegante", "Divertente", "Classico"],
      },
      {
        h2: "Usa il tuo ritratto natalizio",
        body:
          "Se hai già creato un ritratto natalizio, puoi portarlo nel creatore di biglietti e completarlo con un messaggio. Il passaggio dal generatore di foto natalizie è supportato.",
        linkHref: "/it/christmas/photo-generator",
        linkLabel: "Crea prima un ritratto natalizio",
      },
      {
        h2: "Messaggi per biglietti di Natale",
        body:
          "Scrivi le tue parole in italiano. Se vuoi ispirazione aggiuntiva, il generatore di messaggi di Natale offre oggi le sue opzioni di testo in inglese o rumeno, quindi traducile o usale solo come punto di partenza prima di scrivere il tuo messaggio in italiano.",
        linkHref: "/it/christmas/messages",
        linkLabel: "Trova un messaggio di Natale",
      },
      {
        h2: "Come creare un biglietto di Natale online",
        body: "Un percorso semplice da una pagina vuota a un biglietto di Natale condivisibile.",
        list: [
          "Scegli uno stile di biglietto di Natale",
          "Carica una foto o usa un ritratto natalizio",
          "Scrivi il tuo messaggio",
          "Scarica il PNG o condividilo digitalmente",
        ],
      },
    ],
    faqs: [
      {
        q: "Posso caricare la mia foto?",
        a: "Sì. Carica una foto come elemento centrale del tuo biglietto di Natale.",
      },
      {
        q: "Posso usare un ritratto natalizio?",
        a: "Sì. Se hai creato un ritratto nel generatore di foto natalizie, puoi portarlo nel creatore di biglietti.",
      },
      {
        q: "Mi aiutate a scrivere il messaggio in italiano?",
        a: "Puoi scrivere il tuo messaggio direttamente in italiano sul biglietto. L'assistente automatico per i messaggi funziona oggi in inglese o rumeno; per l'italiano, scrivi tu il testo o adatta una tua idea.",
      },
      {
        q: "Posso fare un biglietto familiare?",
        a: "Sì. Stili e layout fotografici pensati per la famiglia fanno parte del creatore.",
      },
      {
        q: "Posso fare un biglietto con il mio animale domestico?",
        a: "Sì. Le foto di animali domestici funzionano bene in diversi stili di biglietto di Natale.",
      },
      {
        q: "Posso scaricare il biglietto?",
        a: "Sì. Scarica un PNG ad alta risoluzione per uso personale.",
      },
      {
        q: "Posso condividerlo digitalmente?",
        a: "Sì. Condividi con le opzioni del tuo dispositivo, WhatsApp, email o copiando un link dove disponibile.",
      },
      {
        q: "Quali stili di biglietto sono disponibili?",
        a: "Gli stili includono look classici, eleganti dorati, accoglienti, paese delle meraviglie invernale, minimal, vintage, giocosi e romantici.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Generatore di Messaggi di Natale | Auguri per Famiglia e Amici",
    description:
      "Trova il messaggio di Natale perfetto per famiglia, amici e colleghi — e usalo poi in un biglietto di Natale personalizzato.",
    h1: "Trova il messaggio di Natale perfetto",
    lede:
      "Genera auguri natalizi caldi, divertenti, romantici o professionali, poi porta il tuo preferito su un biglietto di Natale.",
    h2: "Trasforma le parole in un biglietto",
    breadcrumbs: [
      { href: "/it/christmas", label: "Natale" },
      { href: "/it/christmas/messages", label: "Messaggi" },
    ],
    links: [
      { href: "/it/christmas/cards", label: "Creatore di biglietti di Natale" },
      { href: "/it/christmas/wishlist", label: "Lista dei desideri di Natale" },
      { href: "/it/christmas/tree", label: "Albero di Natale digitale" },
      { href: "/it/christmas", label: "Home di Natale" },
    ],
    geo: {
      h2: "Cos'è un generatore di messaggi di Natale?",
      body:
        "Un generatore di messaggi di Natale ti aiuta a scrivere auguri scegliendo per chi è il messaggio e il tono che desideri — poi genera opzioni di testo modificabili. Su TheDigitalGifter puoi generare oggi messaggi natalizi affettuosi, divertenti, romantici, caldi, brevi, professionali o religiosi in inglese o rumeno, copiarli e adattarli alla tua lingua, oppure continuare verso un biglietto di Natale.",
    },
    sections: [
      {
        h2: "Trova il messaggio di Natale perfetto",
        body:
          "Scegli un destinatario, un tono, una lunghezza (breve, media o lunga), aggiungi facoltativamente un dettaglio personale e genera opzioni di messaggio che puoi modificare e usare.",
      },
      {
        h2: "Messaggi di Natale per destinatario",
        body:
          "Il generatore copre le relazioni natalizie più comuni. Avvia lo strumento e scegli a chi stai scrivendo — le pagine dedicate per destinatario non sono ancora disponibili.",
        list: ["Mamma", "Papà", "Moglie", "Marito", "Fidanzata", "Fidanzato", "Famiglia", "Amico/a", "Collega"],
      },
      {
        h2: "Messaggi di Natale per tono",
        body:
          "Le opzioni di tono disponibili oggi includono caldo, divertente, romantico, affettuoso, breve e semplice, professionale e religioso.",
      },
      {
        h2: "Esempi di messaggi di Natale",
        body:
          "Direzioni dimostrative del tipo di auguri che lo strumento può aiutarti a redigere — modifica qualsiasi testo perché suoni come te.",
        list: [
          "Nota affettuosa per la mamma ringraziandola per un altro anno di gentilezza silenziosa",
          "Augurio breve e caldo per un amico che non vedi abbastanza",
          "Frase romantica di Natale per il primo Natale insieme come coppia",
          "Messaggio leggero e divertente per un collega, restando nei toni professionali",
        ],
      },
      {
        h2: "Come scrivere un messaggio di Natale significativo",
        body:
          "Rivolgiti alla persona per nome o per il vostro legame, menziona un ricordo o una qualità condivisa quando è adatto, esprimi un sentimento chiaro, mantieni un linguaggio naturale e concludi in modo personale. Il generatore è un punto di partenza — la tua modifica lo rende autentico.",
      },
      {
        h2: "Usa il tuo messaggio in un biglietto di Natale",
        body:
          "Quando trovi le parole giuste, continua nel creatore di biglietti di Natale e abbina il messaggio a una foto e a un design.",
        linkHref: "/it/christmas/cards",
        linkLabel: "Metti questo messaggio di Natale su un biglietto",
      },
    ],
    faqs: [
      {
        q: "Come funziona il generatore di messaggi di Natale?",
        a: "Scegli destinatario, tono e lunghezza, aggiungi facoltativamente un dettaglio, poi genera opzioni di messaggio che puoi copiare o modificare.",
      },
      {
        q: "Posso scrivere un messaggio per il mio partner?",
        a: "Sì. Scegli fidanzata, fidanzato, partner, moglie o marito e un tono romantico o caldo.",
      },
      {
        q: "Può creare messaggi di Natale divertenti?",
        a: "Sì. Seleziona il tono divertente — mantieni un tono professionale quando scrivi ai colleghi.",
      },
      {
        q: "In quale lingua vengono generati i messaggi?",
        a: "Oggi il generatore crea il testo in inglese o rumeno. Puoi copiarlo e adattarlo o tradurlo in italiano, oppure usarlo solo come ispirazione prima di scrivere il tuo messaggio in italiano.",
      },
      {
        q: "Posso modificare i messaggi generati?",
        a: "Sì. Considera il testo generato come una bozza e riscrivilo liberamente prima di inviarlo o usarlo su un biglietto.",
      },
      {
        q: "Può creare auguri natalizi brevi?",
        a: "Sì. Scegli la lunghezza breve o il tono breve e semplice.",
      },
      {
        q: "Posso usare un messaggio in un biglietto di Natale?",
        a: "Sì. Continua verso il creatore di biglietti di Natale con il passaggio del messaggio.",
      },
    ],
  },
};

/** @returns {LocalizedSeoPage | null} */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
