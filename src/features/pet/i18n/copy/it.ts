import type { PetCopyMap } from "./en";

/** Italian copy for /pet (V1 + V2 funnel). */
export const PET_COPY_IT: PetCopyMap = {
  // Species
  "species.dog": "Cane",
  "species.cat": "Gatto",
  "species.other": "Altro",
  "species.otherHint": "Altro animale",
  "species.pet": "animale",
  "species.dogLower": "cane",
  "species.catLower": "gatto",
  "species.golden": "Golden Retriever",
  "species.tablist": "Tipo di animale",

  // Shared chrome
  "chrome.back": "Indietro",
  "chrome.lang": "Lingua",
  "chrome.before": "Prima",
  "chrome.after": "Dopo",
  "chrome.clipBadge": "Clip da 5s",
  "chrome.optional": "(opzionale)",
  "chrome.endsIn": "Termina tra {countdown}",

  // V2 landing
  "v2.landing.eyebrow": "Provalo gratis",
  "v2.landing.h1": "Vedi il tuo animale come pilota di Formula 1.",
  "v2.landing.lede":
    "Carica una foto e ricevi gratis un’anteprima sfocata della vita segreta del tuo {pet} — senza carta.",
  "v2.landing.cta": "Carica la foto del tuo animale",
  "v2.landing.chooseFile": "Scegli un JPEG, PNG o WebP",
  "v2.landing.bullet.lives": "12 vite segrete",
  "v2.landing.bullet.clips": "2 mini clip",
  "v2.landing.bullet.price": "{price} una tantum",
  "v2.landing.bullet.teaser": "Anteprima in pochi secondi",
  "v2.landing.bullet.noSub": "Nessun abbonamento",
  "v2.landing.bullet.private": "La foto resta privata",
  "v2.landing.proofAria": "Esempi di ritratti e clip",
  "v2.landing.livesH2": "Tutte le 12 vite segrete",
  "v2.landing.livesLede.dog":
    "Dodici ritratti dello stesso {pet} — ogni mondo incluso. 2 mini clip incluse.",
  "v2.landing.livesLede.other": "Dodici ritratti. Una foto. Tanti tipi di animali.",
  "v2.landing.closingH2": "Svela la vita segreta del tuo animale.",
  "v2.landing.closingLede":
    "Carica una foto per un’anteprima personalizzata gratuita. Sblocca oggi 12 vite segrete e 2 mini clip per {price}.",
  "v2.landing.closingRenew": "{compare} {price} · l’offerta si rinnova ogni 24 ore",
  "v2.landing.saleLine": "{compare} {price} oggi · restano {countdown}",
  "v2.landing.stickySale": "{compare} → {price} oggi · restano {countdown}",
  "v2.landing.stickyIdle": "{price} una tantum · nessuna carta per l’anteprima gratuita",
  "v2.landing.originalAlt": "Foto originale del {pet} demo",
  "v2.landing.afterAlt": "Anteprima da pilota di Formula 1 dello stesso {pet} demo",
  "v2.landing.clipAlt": "Mini clip {title}",
  "v2.landing.exampleAlt": "Esempio {title}",

  // V2 pack / offer chrome
  "v2.pack.badge": "Offerta di 24 ore",
  "v2.pack.headline": "Ottieni 12 vite segrete e 2 mini clip a soli {price}",
  "v2.pack.headlineRich": "Ottieni 12 vite segrete e 2 mini clip a soli",
  "v2.pack.fine": "Una tantum · nessun abbonamento · lo stesso animale in ogni ritratto e clip",
  "v2.shell.footer": "{headline}. Anteprima personalizzata gratuita — paghi solo per sbloccare.",

  // V2 photo
  "v2.photo.h1": "Una foto chiara.",
  "v2.photo.lede":
    "Volto verso la fotocamera, entrambi gli occhi visibili, luce uniforme. Un solo {pet} — niente foto di gruppo o filtri pesanti.",
  "v2.photo.selectedAlt": "Foto dell’animale selezionata",
  "v2.photo.selectedNamed": "Selezionato: {fileName}",
  "v2.photo.replace": "Sostituisci",
  "v2.photo.remove": "Rimuovi",
  "v2.photo.choose": "Scegli una foto",
  "v2.photo.formats": "JPEG, PNG o WebP · max 15 MB",
  "v2.photo.cta": "Vedi l’anteprima della vita segreta",
  "v2.photo.viewTeaser": "Vedi la mia anteprima",
  "v2.photo.confirm.dog": "Confermo che questa foto mostra il mio cane (non un gatto o altro animale).",
  "v2.photo.confirm.cat": "Confermo che questa foto mostra il mio gatto (non un cane o altro animale).",
  "v2.photo.confirmErr.dog":
    "Questa esperienza è pensata per i cani. Conferma che la foto mostra il tuo cane, oppure carica una foto chiara di un cane.",
  "v2.photo.confirmErr.cat":
    "Questa esperienza è pensata per i gatti. Conferma che la foto mostra il tuo gatto, oppure carica una foto chiara di un gatto.",
  "v2.photo.needPhoto": "Scegli prima una foto.",

  // V2 teaser / checkout
  "v2.teaser.h1": "La vita segreta del tuo {pet} è pronta per essere svelata.",
  "v2.teaser.support": "Sblocca la collezione personalizzata completa 12+2 per {price}.",
  "v2.teaser.alt": "Anteprima sfocata della vita segreta del tuo animale",
  "v2.teaser.bullet.lives": "12 vite segrete dello stesso {pet}",
  "v2.teaser.bullet.clips": "2 mini clip cinematografiche",
  "v2.teaser.bullet.price": "Pagamento unico di {price} — nessun abbonamento",
  "v2.teaser.petName": "Nome dell’animale",
  "v2.teaser.email": "Email per la galleria",
  "v2.teaser.payAria": "Pagamento sicuro",
  "v2.teaser.reupload": "Carica di nuovo la foto del tuo animale",
  "v2.teaser.hostedHint": "Continua sulla pagina di checkout sicura di Stripe per completare il pagamento unico.",
  "v2.teaser.hostedOpening": "Apertura del checkout sicuro Stripe…",
  "v2.teaser.hostedBusy": "Apertura del checkout sicuro Stripe…",
  "v2.teaser.hostedCta": "Continua al checkout sicuro Stripe — {price}",
  "v2.teaser.retry": "Apri il checkout sicuro Stripe — {price}",
  "v2.teaser.retrying": "Nuovo tentativo…",
  "v2.teaser.busyPay": "Elaborazione del pagamento sicuro…",
  "v2.teaser.loadingPay": "Caricamento del pagamento sicuro…",
  "v2.teaser.preparing": "Preparazione del pagamento sicuro…",
  "v2.teaser.paused":
    "Il pagamento sicuro è in pausa finché non torna la capacità di generazione. Non ti è stato addebitato nulla.",
  "v2.teaser.secureLine": "Pagamento Stripe unico e sicuro di {price}. Nessun abbonamento.",
  "v2.teaser.payDog": "Svela la vita segreta del mio cane — {price}",
  "v2.teaser.payCat": "Svela la vita segreta del mio gatto — {price}",
  "v2.teaser.payPet": "Svela la vita segreta del mio animale — {price}",
  "v2.teaser.sessionExpiredContact": "Sessione di pagamento scaduta. Riprova il pagamento sicuro.",

  // V2 offer (legacy step)
  "v2.offer.h1": "Sblocca la collezione",
  "v2.offer.lede": "{headline}. Una tantum. Nessun abbonamento.",
  "v2.offer.bullet.lives": "12 vite segrete dello stesso animale",
  "v2.offer.bullet.clips": "2 mini clip cinematografiche",
  "v2.offer.bullet.ready": "Di solito pronto pochi minuti dopo il pagamento",
  "v2.offer.bullet.remake":
    "Se un risultato a pagamento non assomiglia in modo riconoscibile al tuo animale, lo rifacciamo",
  "v2.offer.cta": "Ottieni 12 vite + 2 clip per {price}",
  "v2.offer.opening": "Apertura del checkout sicuro…",
  "v2.offer.fine": "Checkout Stripe sicuro. Non ti verrà addebitato due volte.",

  // V2 generating / preview (legacy)
  "v2.gen.h1": "Creiamo l’anteprima F1 del tuo animale",
  "v2.gen.lede":
    "Stiamo trasformando il tuo animale in un pilota cinematografico di Formula 1. Questa è un’anteprima gratuita — non ancora la collezione completa.",
  "v2.gen.retry": "Riprova",
  "v2.gen.change": "Cambia foto",
  "v2.gen.thumbAlt": "Il tuo animale caricato",
  "v2.preview.eyebrow": "Anteprima cinematografica gratuita",
  "v2.preview.h1Named": "{name} come pilota F1",
  "v2.preview.h1": "Il tuo {pet} come pilota F1",
  "v2.preview.lede":
    "La vita segreta del tuo {pet} inizia qui. Sblocca la collezione completa per vedere trasformazioni ancora più incredibili.",
  "v2.preview.yourPhoto": "La tua foto",
  "v2.preview.f1": "Anteprima F1",
  "v2.preview.uploadAlt": "Il tuo {pet} caricato",
  "v2.preview.f1Alt": "Il tuo {pet} come pilota di Formula 1",
  "v2.preview.mock":
    "Anteprima prototipo: la generazione AI live è disattivata in questo ambiente, quindi vedi la tua foto con un’inquadratura in stile F1.",
  "v2.preview.unlock": "Sblocca la collezione completa — {price}",
  "v2.preview.regen": "Prova un’altra anteprima gratuita",

  // Checkout loading phases
  "v2.checkout.preparing_photo": "Preparazione della foto…",
  "v2.checkout.creating_order": "Avvio del checkout sicuro…",
  "v2.checkout.uploading": "Caricamento della foto…",
  "v2.checkout.creating_session": "Caricamento del pagamento sicuro…",
  "v2.checkout.expired":
    "La sessione di checkout sicuro è scaduta. Carica di nuovo la foto del tuo animale.",
  "v2.checkout.failed":
    "Non siamo riusciti ad aprire il modulo di pagamento sicuro. Riprova. Non ti è stato addebitato nulla.",
  "v2.provider.unavailable":
    "Al momento non possiamo creare nuove trasformazioni. Riprova a breve — non ti è stato addebitato nulla.",

  // Preview errors
  "v2.err.invalid_funnel":
    "Questa anteprima non corrisponde all’esperienza attuale. Aggiorna e riprova.",
  "v2.err.rate_limited":
    "Questa sessione ha già usato le anteprime gratuite. Sblocca la collezione o riprova domani.",
  "v2.err.timeout":
    "La tua anteprima è ancora in elaborazione. Aspetta un momento, poi tocca Riprova — riprendiamo da dove eravamo.",
  "v2.err.rate_limit":
    "Il servizio di anteprima è occupato. Tocca Riprova tra un momento — di solito si risolve in fretta.",
  "v2.err.wrong_species":
    "Quella foto non corrisponde a questa esperienza. Carica una foto chiara dell’animale giusto.",
  "v2.err.invalid_image": "Quella foto non può essere usata. Prova un JPEG, PNG o WebP più piccolo.",
  "v2.err.provider_auth": "La generazione dell’anteprima non è temporaneamente disponibile. Riprova tra pochi minuti.",
  "v2.err.endpoint_unreachable":
    "Non siamo riusciti a raggiungere il servizio di anteprima. Controlla la connessione e riprova.",
  "v2.err.server_error":
    "Qualcosa si è bloccato da un tentativo precedente. Tocca Riprova o sostituisci la foto per un’anteprima nuova.",
  "v2.err.provider_error":
    "Non siamo riusciti a completare l’anteprima questa volta. Riprova, o sostituisci la foto se continua a fallire.",

  // V1 product / landing
  "v1.product.name": "My Pet’s Secret Life",
  "v1.product.promise": "Una foto. 12 vite segrete. 2 clip cinematografiche.",
  "v1.hero.subtitle":
    "Vedi il tuo animale come reale, astronauta, CEO e molto altro — lo stesso volto in ogni mondo.",
  "v1.hero.promise": "Una foto. 12 vite segrete. 2 clip cinematografiche.",
  "v1.offer.noSub": "Nessun abbonamento",
  "v1.offer.include.portraits": "12 ritratti dello stesso animale",
  "v1.offer.include.clips": "2 clip cinematografiche da 5 secondi",
  "v1.offer.include.review": "Revisione umana prima del download",
  "v1.offer.include.price": "Prezzo unico — nessun abbonamento",
  "v1.landing.dog.heading": "Dodici vite segrete",
  "v1.landing.dog.description":
    "Passa il mouse o tocca un ritratto per vederlo muoversi. Lo stesso Golden Retriever. Un mondo diverso in ogni fotogramma.",
  "v1.landing.dog.support":
    "Trasforma il tuo cane in reale, astronauta, CEO e altre nove vite segrete.",
  "v1.landing.cat.heading": "Dodici vite segrete",
  "v1.landing.cat.description":
    "Passa il mouse o tocca un ritratto per vederlo muoversi. Lo stesso gatto. Un mondo diverso in ogni fotogramma.",
  "v1.landing.cat.support":
    "Trasforma il tuo gatto in reale, astronauta, CEO e altre nove vite segrete.",
  "v1.landing.other.heading": "Pensato per tanti tipi di animali",
  "v1.landing.other.description":
    "Passa il mouse o tocca un ritratto per vederlo muoversi. Ogni animale merita una vita segreta.",
  "v1.landing.other.support": "Ogni animale merita una vita segreta.",
  "v1.clips.heading": "Due clip cinematografiche",
  "v1.clips.dog": "Lo stesso animale. Cinque secondi. Un mondo in movimento.",
  "v1.clips.cat": "Lo stesso gatto. Cinque secondi. Un mondo in movimento.",
  "v1.clips.other": "Esempi di movimento da cinque secondi per diversi tipi di animali.",
  "v1.guarantee.heading": "La Garanzia dello Stesso Animale",
  "v1.guarantee.body":
    "Ogni ritratto e clip è controllato da una persona. Se un risultato non assomiglia in modo riconoscibile al tuo animale, lo rifacciamo prima della consegna.",
  "v1.seo.dog.title": "Ritratti e video personalizzati per cani | My Pet’s Secret Life",
  "v1.seo.dog.description":
    "Trasforma una foto del tuo cane in 12 ritratti personalizzati e 2 clip cinematografiche da 5 secondi. Lo stesso volto in ogni mondo. Pagamento unico. Nessun abbonamento.",
  "v1.seo.cat.title": "Ritratti e video personalizzati per gatti | My Pet’s Secret Life",
  "v1.seo.cat.description":
    "Trasforma una foto del tuo gatto in 12 ritratti personalizzati e 2 clip cinematografiche da 5 secondi. Lo stesso volto in ogni mondo. Pagamento unico. Nessun abbonamento.",
  "v1.seo.other.title": "Ritratti e video personalizzati per animali | My Pet’s Secret Life",
  "v1.seo.other.description":
    "Ritratti personalizzati e clip cinematografiche per conigli, uccelli, piccoli animali, rettili, cavalli e altri animali. Una foto. Revisione umana. Pagamento unico.",

  // Subtypes
  "subtype.rabbit": "Coniglio",
  "subtype.bird": "Uccello",
  "subtype.small_pet": "Piccolo animale",
  "subtype.reptile": "Rettile",
  "subtype.horse": "Cavallo",
  "subtype.other": "Altro",

  // Other gallery subjects
  "other.royal-portrait": "Tartaruga",
  "other.luxury-ceo": "Ara",
  "other.astronaut": "Criceto",
  "other.formula-racer": "Coniglio",
  "other.spa-bathtub": "Riccio",
  "other.newspaper": "Porcellino d’India",
  "other.cinema-boss": "Drago barbuto",
  "other.renaissance": "Furetto",
  "other.beach-vacation": "Pesce rosso",
  "other.head-chef": "Maialino nano",
  "other.original-superhero": "Camaleonte",
  "other.christmas-portrait": "Calopsitte",
  "other.mixedGallery": "Esempi misti di animali",

  // Scenes
  "scene.royal-portrait.title": "Ritratto reale",
  "scene.royal-portrait.tagline": "La corona è opzionale. Lo sguardo no.",
  "scene.luxury-ceo.title": "CEO di lusso",
  "scene.luxury-ceo.tagline": "Premi trimestrali. Ufficio aperto. Zampe chiuse.",
  "scene.astronaut.title": "Astronauta",
  "scene.astronaut.tagline": "Un piccolo passo per le zampe. Un grande salto per gli snack.",
  "scene.formula-racer.title": "Pilota di Formula",
  "scene.formula-racer.tagline": "Pole position. Coccole sulla pancia al pit-stop.",
  "scene.spa-bathtub.title": "Spa / vasca",
  "scene.spa-bathtub.tagline": "Cetrioli opzionali. La dignità non si negozia.",
  "scene.newspaper.title": "Legge il giornale",
  "scene.newspaper.tagline": "Ultim’ora: il pisolino spostato alle 14:15.",
  "scene.cinema-boss.title": "Boss del cinema immaginario",
  "scene.cinema-boss.tagline": "Un ufficio inventato. Uno sguardo molto reale.",
  "scene.renaissance.title": "Dipinto rinascimentale",
  "scene.renaissance.tagline": "Olio, velluto e 400 anni di occhiatacce di lato.",
  "scene.beach-vacation.title": "Vacanza al mare",
  "scene.beach-vacation.tagline": "Fuori ufficio. Continua a giudicare i gabbiani.",
  "scene.head-chef.title": "Chef executive",
  "scene.head-chef.tagline": "La cucina è chiusa. Il critico è peloso.",
  "scene.original-superhero.title": "Supereroe originale",
  "scene.original-superhero.tagline": "Un mantello inventato da noi. Una città che già possiedono.",
  "scene.christmas-portrait.title": "Ritratto di Natale",
  "scene.christmas-portrait.tagline": "La cartolina annuale che finisce davvero incorniciata.",

  // How it works
  "how.1.title": "Dai un nome al tuo animale",
  "how.1.body": "Basta un nome. Nessun addebito ancora.",
  "how.2.title": "Carica una foto",
  "how.2.body": "Un volto chiaro, che guarda avanti. Aggiungi la tua email.",
  "how.3.title": "Controlla e paga una volta",
  "how.3.body": "Nessun abbonamento. Nessun rinnovo. Checkout Stripe.",
  "how.4.title": "Ricevi 12 ritratti e 2 clip",
  "how.4.body": "Lo stesso animale. Replicate parte subito dopo il pagamento.",

  // FAQs
  "faq.sub.q": "È un abbonamento?",
  "faq.sub.a": "No. Pagamento unico. Niente si rinnova.",
  "faq.look.q": "Assomiglierà al mio animale?",
  "faq.look.a":
    "Sì — è il prodotto. Una foto, dodici scene, due clip cinematografiche, lo stesso volto. Una persona controlla prima che scarichi.",
  "faq.time.q": "Quanto ci vuole?",
  "faq.time.a":
    "Di solito pochi minuti dopo il pagamento. Replicate avvia subito i dodici ritratti.",
  "faq.photo.q": "Quale foto funziona meglio?",
  "faq.photo.a":
    "Un animale, volto verso la fotocamera, entrambi gli occhi visibili, luce uniforme. Niente foto di gruppo o filtri pesanti.",
  "faq.gift.q": "Posso farne un regalo?",
  "faq.gift.a": "Sì. Usa la foto del loro animale, paga una volta e invia il link della galleria.",
  "faq.remake.q": "E se un ritratto non assomiglia al mio animale?",
  "faq.remake.a":
    "Apri Aiuto nella pagina dell’ordine e invia un ticket. Se un risultato non assomiglia in modo riconoscibile al tuo animale, lo rifacciamo.",
  "faq.private.q": "La foto originale resta privata?",
  "faq.private.a":
    "La tua foto serve solo a creare questo ordine. Non viene usata come marketing pubblico. Non la vendiamo.",
  "faq.multi.q": "Posso includere più animali?",
  "faq.multi.a":
    "Non in un solo ordine. Usa una foto chiara con un solo animale. Le foto di gruppo vengono rifiutate prima della generazione.",
  "faq.human.q": "Cosa significa «controllato da una persona»?",
  "faq.human.a":
    "I ritratti sono pronti non appena termina la generazione. Se qualcosa non torna, apri Aiuto e lo rifacciamo.",
  "faq.formats.q": "Quali formati di file ricevo?",
  "faq.formats.a":
    "Ricevi i file dei ritratti generati e due clip MP4 cinematografiche dalla galleria dell’ordine. Ritagli extra come wallpaper non sono ancora inclusi.",

  // Validation
  "validate.name": "Dai un nome al tuo animale — anche un soprannome va bene.",
};
