import type { PetCopyMap } from "./en";

/** Dutch copy for /pet (V1 + V2 funnel). */
export const PET_COPY_NL: PetCopyMap = {
  // Species
  "species.dog": "Hond",
  "species.cat": "Kat",
  "species.other": "Anders",
  "species.otherHint": "Ander huisdier",
  "species.pet": "huisdier",
  "species.dogLower": "hond",
  "species.catLower": "kat",
  "species.golden": "Golden Retriever",
  "species.tablist": "Soort huisdier",

  // Shared chrome
  "chrome.back": "Terug",
  "chrome.lang": "Taal",
  "chrome.before": "Voor",
  "chrome.after": "Na",
  "chrome.clipBadge": "5s clip",
  "chrome.optional": "(optioneel)",
  "chrome.endsIn": "Eindigt over {countdown}",

  // V2 landing
  "v2.landing.eyebrow": "Probeer gratis",
  "v2.landing.h1": "Zie je huisdier als Formule 1-coureur.",
  "v2.landing.lede":
    "Upload één foto en krijg een gratis vervaagde teaser van het geheime leven van {pet} — geen kaart nodig.",
  "v2.landing.cta": "Upload de foto van je huisdier",
  "v2.landing.chooseFile": "Kies een JPEG, PNG of WebP",
  "v2.landing.bullet.lives": "12 geheime levens",
  "v2.landing.bullet.clips": "2 miniclips",
  "v2.landing.bullet.price": "{price} eenmalig",
  "v2.landing.bullet.teaser": "Teaser in seconden",
  "v2.landing.bullet.noSub": "Geen abonnement",
  "v2.landing.bullet.private": "Foto blijft privé",
  "v2.landing.proofAria": "Voorbeeldportretten en clips",
  "v2.landing.livesH2": "Alle 12 geheime levens",
  "v2.landing.livesLede.dog":
    "Twaalf portretten van dezelfde {pet} — elke wereld inbegrepen. 2 miniclips inbegrepen.",
  "v2.landing.livesLede.other": "Twaalf portretten. Eén foto. Veel soorten huisdieren.",
  "v2.landing.closingH2": "Onthul het geheime leven van je huisdier.",
  "v2.landing.closingLede":
    "Upload één foto voor een gratis persoonlijke teaser. Ontgrendel 12 geheime levens en 2 miniclips voor {price} vandaag.",
  "v2.landing.closingRenew": "{compare} {price} · aanbieding vernieuwt elke 24 uur",
  "v2.landing.saleLine": "{compare} {price} vandaag · {countdown} resterend",
  "v2.landing.stickySale": "{compare} → {price} vandaag · {countdown} resterend",
  "v2.landing.stickyIdle": "{price} eenmalig · geen kaart voor de gratis preview",
  "v2.landing.originalAlt": "Originele foto van de demo-{pet}",
  "v2.landing.afterAlt": "Formule 1-coureurpreview van dezelfde demo-{pet}",
  "v2.landing.clipAlt": "{title} miniclip",
  "v2.landing.exampleAlt": "{title} voorbeeld",

  // V2 pack / offer chrome
  "v2.pack.badge": "24-uursaanbieding",
  "v2.pack.headline": "Krijg 12 geheime levens en 2 miniclips voor slechts {price}",
  "v2.pack.headlineRich": "Krijg 12 geheime levens en 2 miniclips voor slechts",
  "v2.pack.fine": "Eenmalig · geen abonnement · hetzelfde huisdier in elk portret en elke clip",
  "v2.shell.footer": "{headline}. Gratis persoonlijke teaser — betaal alleen om te ontgrendelen.",

  // V2 photo
  "v2.photo.h1": "Eén scherpe foto.",
  "v2.photo.lede":
    "Gezicht naar de camera, beide ogen zichtbaar, gelijkmatig licht. Alleen één {pet} — geen groepsfoto’s of zware filters.",
  "v2.photo.selectedAlt": "Geselecteerde huisdierfoto",
  "v2.photo.selectedNamed": "Geselecteerd {fileName}",
  "v2.photo.replace": "Vervangen",
  "v2.photo.remove": "Verwijderen",
  "v2.photo.choose": "Kies een foto",
  "v2.photo.formats": "JPEG, PNG of WebP · max. 15 MB",
  "v2.photo.cta": "Bekijk mijn geheime-leven-teaser",
  "v2.photo.viewTeaser": "Bekijk mijn teaser",
  "v2.photo.confirm.dog": "Ik bevestig dat deze foto mijn hond toont (geen kat of ander dier).",
  "v2.photo.confirm.cat": "Ik bevestig dat deze foto mijn kat toont (geen hond of ander dier).",
  "v2.photo.confirmErr.dog":
    "Deze ervaring is gemaakt voor honden. Bevestig dat de foto je hond toont, of upload een duidelijke hondenfoto.",
  "v2.photo.confirmErr.cat":
    "Deze ervaring is gemaakt voor katten. Bevestig dat de foto je kat toont, of upload een duidelijke kattenfoto.",
  "v2.photo.needPhoto": "Kies eerst een foto.",

  // V2 teaser / checkout
  "v2.teaser.h1": "Het geheime leven van je {pet} is klaar om onthuld te worden.",
  "v2.teaser.support": "Ontgrendel de complete persoonlijke 12+2-collectie voor {price}.",
  "v2.teaser.alt": "Vervaagde preview van het geheime leven van je huisdier",
  "v2.teaser.bullet.lives": "12 geheime levens van dezelfde {pet}",
  "v2.teaser.bullet.clips": "2 cinematische miniclips",
  "v2.teaser.bullet.price": "Eenmalige betaling van {price} — geen abonnement",
  "v2.teaser.petName": "Naam van je huisdier",
  "v2.teaser.email": "E-mail voor de galerij",
  "v2.teaser.payAria": "Veilige betaling",
  "v2.teaser.reupload": "Upload de foto van je huisdier opnieuw",
  "v2.teaser.hostedHint": "Ga verder op de beveiligde checkoutpagina van Stripe om je eenmalige betaling af te ronden.",
  "v2.teaser.hostedOpening": "Beveiligde Stripe-checkout openen…",
  "v2.teaser.hostedBusy": "Beveiligde Stripe-checkout openen…",
  "v2.teaser.hostedCta": "Doorgaan naar beveiligde Stripe-checkout — {price}",
  "v2.teaser.retry": "Open beveiligde Stripe-checkout — {price}",
  "v2.teaser.retrying": "Opnieuw proberen…",
  "v2.teaser.busyPay": "Veilige betaling verwerken…",
  "v2.teaser.loadingPay": "Veilige betaling laden…",
  "v2.teaser.preparing": "Veilige betaling voorbereiden…",
  "v2.teaser.paused":
    "Veilige betaling is gepauzeerd tot de generatiecapaciteit is hersteld. Je bent niet belast.",
  "v2.teaser.secureLine": "Veilige eenmalige Stripe-betaling van {price}. Geen abonnement.",
  "v2.teaser.payDog": "Onthul het geheime leven van mijn hond — {price}",
  "v2.teaser.payCat": "Onthul het geheime leven van mijn kat — {price}",
  "v2.teaser.payPet": "Onthul het geheime leven van mijn huisdier — {price}",
  "v2.teaser.sessionExpiredContact": "Betaalsessie verlopen. Probeer de veilige betaling opnieuw.",

  // V2 offer (legacy step)
  "v2.offer.h1": "Ontgrendel de collectie",
  "v2.offer.lede": "{headline}. Eenmalig. Geen abonnement.",
  "v2.offer.bullet.lives": "12 geheime levens van hetzelfde huisdier",
  "v2.offer.bullet.clips": "2 cinematische miniclips",
  "v2.offer.bullet.ready": "Meestal klaar enkele minuten na betaling",
  "v2.offer.bullet.remake":
    "Als een betaald resultaat niet herkenbaar op je huisdier lijkt, maken we het opnieuw",
  "v2.offer.cta": "Krijg 12 levens + 2 clips voor {price}",
  "v2.offer.opening": "Beveiligde checkout openen…",
  "v2.offer.fine": "Beveiligde Stripe-checkout. Je wordt niet twee keer belast.",

  // V2 generating / preview (legacy)
  "v2.gen.h1": "De F1-coureurpreview van je huisdier maken",
  "v2.gen.lede":
    "We maken van je huisdier een cinematische Formule 1-coureur. Dit is één gratis preview — nog niet de volledige collectie.",
  "v2.gen.retry": "Opnieuw proberen",
  "v2.gen.change": "Foto wijzigen",
  "v2.gen.thumbAlt": "Je geüploade huisdier",
  "v2.preview.eyebrow": "Gratis cinematische preview",
  "v2.preview.h1Named": "{name} als F1-coureur",
  "v2.preview.h1": "Je {pet} als F1-coureur",
  "v2.preview.lede":
    "Het geheime leven van je {pet} begint hier. Ontgrendel de volledige collectie voor nóg meer indrukwekkende transformaties.",
  "v2.preview.yourPhoto": "Jouw foto",
  "v2.preview.f1": "F1-preview",
  "v2.preview.uploadAlt": "Je geüploade {pet}",
  "v2.preview.f1Alt": "Je {pet} als Formule 1-coureur",
  "v2.preview.mock":
    "Prototypepreview: live AI-generatie staat uit in deze omgeving, dus dit is je foto met F1-achtige framing.",
  "v2.preview.unlock": "Volledige collectie ontgrendelen — {price}",
  "v2.preview.regen": "Nog een gratis preview proberen",

  // Checkout loading phases
  "v2.checkout.preparing_photo": "Je foto voorbereiden…",
  "v2.checkout.creating_order": "Beveiligde checkout starten…",
  "v2.checkout.uploading": "Je foto uploaden…",
  "v2.checkout.creating_session": "Veilige betaling laden…",
  "v2.checkout.expired":
    "Je beveiligde checkoutsessie is verlopen. Upload de foto van je huisdier opnieuw.",
  "v2.checkout.failed":
    "We konden het beveiligde betaalformulier niet openen. Probeer het opnieuw. Je bent niet belast.",
  "v2.provider.unavailable":
    "We kunnen tijdelijk geen nieuwe transformaties maken. Probeer het zo opnieuw — je bent niet belast.",

  // Preview errors
  "v2.err.invalid_funnel":
    "Deze preview past niet bij de huidige ervaring. Vernieuw en probeer opnieuw.",
  "v2.err.rate_limited":
    "Deze sessie heeft de gratis previews al gebruikt. Ontgrendel de collectie of probeer morgen opnieuw.",
  "v2.err.timeout":
    "Je preview wordt nog gerenderd. Wacht even en tik op Opnieuw proberen — we gaan verder waar we gebleven waren.",
  "v2.err.rate_limit":
    "De previewservice is druk. Tik zo op Opnieuw proberen — dit lost meestal snel op.",
  "v2.err.wrong_species":
    "Die foto past niet bij deze ervaring. Upload een duidelijke foto van het juiste huisdier.",
  "v2.err.invalid_image": "Die foto kon niet worden gebruikt. Probeer een kleinere JPEG, PNG of WebP.",
  "v2.err.provider_auth": "Previewgeneratie is tijdelijk niet beschikbaar. Probeer het over een paar minuten opnieuw.",
  "v2.err.endpoint_unreachable":
    "We konden de previewservice niet bereiken. Controleer je verbinding en probeer opnieuw.",
  "v2.err.server_error":
    "Er ging iets vast van een eerdere poging. Tik op Opnieuw proberen of vervang de foto voor een verse preview.",
  "v2.err.provider_error":
    "We konden de preview deze keer niet afronden. Probeer opnieuw, of vervang de foto als het blijft misgaan.",

  // V1 product / landing
  "v1.product.name": "Het Geheime Leven van Mijn Huisdier",
  "v1.product.promise": "Eén foto. 12 geheime levens. 2 cinematische clips.",
  "v1.hero.subtitle":
    "Zie je huisdier als royalty, astronaut, CEO en meer — hetzelfde gezicht in elke wereld.",
  "v1.hero.promise": "Eén foto. 12 geheime levens. 2 cinematische clips.",
  "v1.offer.noSub": "Geen abonnement",
  "v1.offer.include.portraits": "12 portretten van hetzelfde huisdier",
  "v1.offer.include.clips": "2 cinematische clips van 5 seconden",
  "v1.offer.include.review": "Menselijke controle vóór download",
  "v1.offer.include.price": "Eenmalige prijs — geen abonnement",
  "v1.landing.dog.heading": "Twaalf geheime levens",
  "v1.landing.dog.description":
    "Hover of tik op een portret om het te laten bewegen. Dezelfde Golden Retriever. Een andere wereld in elk frame.",
  "v1.landing.dog.support":
    "Maak van je hond royalty, astronaut, CEO en nog negen geheime levens.",
  "v1.landing.cat.heading": "Twaalf geheime levens",
  "v1.landing.cat.description":
    "Hover of tik op een portret om het te laten bewegen. Dezelfde kat. Een andere wereld in elk frame.",
  "v1.landing.cat.support":
    "Maak van je kat royalty, astronaut, CEO en nog negen geheime levens.",
  "v1.landing.other.heading": "Gemaakt voor veel soorten huisdieren",
  "v1.landing.other.description":
    "Hover of tik op een portret om het te laten bewegen. Elk huisdier verdient een geheim leven.",
  "v1.landing.other.support": "Elk huisdier verdient een geheim leven.",
  "v1.clips.heading": "Twee cinematische clips",
  "v1.clips.dog": "Hetzelfde huisdier. Vijf seconden. Een wereld in beweging.",
  "v1.clips.cat": "Dezelfde kat. Vijf seconden. Een wereld in beweging.",
  "v1.clips.other": "Bewegingsvoorbeelden van vijf seconden voor verschillende soorten huisdieren.",
  "v1.guarantee.heading": "De Zelfde-Huisdiergarantie",
  "v1.guarantee.body":
    "Elk portret en elke clip wordt door een persoon gecontroleerd. Als een resultaat niet herkenbaar op je huisdier lijkt, maken we het opnieuw vóór levering.",
  "v1.seo.dog.title": "Persoonlijke Hondenportretten & Video’s | Het Geheime Leven van Mijn Huisdier",
  "v1.seo.dog.description":
    "Maak van één foto van je hond 12 persoonlijke portretten en 2 cinematische clips van 5 seconden. Hetzelfde gezicht in elke wereld. Eenmalige betaling. Geen abonnement.",
  "v1.seo.cat.title": "Persoonlijke Kattenportretten & Video’s | Het Geheime Leven van Mijn Huisdier",
  "v1.seo.cat.description":
    "Maak van één foto van je kat 12 persoonlijke portretten en 2 cinematische clips van 5 seconden. Hetzelfde gezicht in elke wereld. Eenmalige betaling. Geen abonnement.",
  "v1.seo.other.title": "Persoonlijke Huisdierportretten & Video’s | Het Geheime Leven van Mijn Huisdier",
  "v1.seo.other.description":
    "Persoonlijke portretten en cinematische clips voor konijnen, vogels, kleine huisdieren, reptielen, paarden en andere dieren. Eén foto. Menselijk nagekeken. Eenmalige betaling.",

  // Subtypes
  "subtype.rabbit": "Konijn",
  "subtype.bird": "Vogel",
  "subtype.small_pet": "Klein huisdier",
  "subtype.reptile": "Reptiel",
  "subtype.horse": "Paard",
  "subtype.other": "Anders",

  // Other gallery subjects
  "other.royal-portrait": "Schildpad",
  "other.luxury-ceo": "Ara",
  "other.astronaut": "Hamster",
  "other.formula-racer": "Konijn",
  "other.spa-bathtub": "Egel",
  "other.newspaper": "Cavia",
  "other.cinema-boss": "Baardagaam",
  "other.renaissance": "Fret",
  "other.beach-vacation": "Goudvis",
  "other.head-chef": "Minivarken",
  "other.original-superhero": "Kameleon",
  "other.christmas-portrait": "Valkparkiet",
  "other.mixedGallery": "Gemengde huisdiervoorbeelden",

  // Scenes
  "scene.royal-portrait.title": "Koninklijk portret",
  "scene.royal-portrait.tagline": "De kroon is optioneel. De blik niet.",
  "scene.luxury-ceo.title": "Luxe-CEO",
  "scene.luxury-ceo.tagline": "Kwartaaltraktaties. Open kantoor. Gesloten poten.",
  "scene.astronaut.title": "Astronaut",
  "scene.astronaut.tagline": "Eén kleine stap voor poten. Eén grote sprong voor snacks.",
  "scene.formula-racer.title": "Formule-coureur",
  "scene.formula-racer.tagline": "Poleposition. Buikkrabjes in de pitstop.",
  "scene.spa-bathtub.title": "Spa / badkuip",
  "scene.spa-bathtub.tagline": "Komkommers optioneel. Waardigheid niet onderhandelbaar.",
  "scene.newspaper.title": "Krant lezen",
  "scene.newspaper.tagline": "Breaking news: dutje verplaatst naar 14:15.",
  "scene.cinema-boss.title": "Fictieve bioscoopbaas",
  "scene.cinema-boss.tagline": "Een verzonnen kantoor. Een heel echte blik.",
  "scene.renaissance.title": "Renaissanceschilderij",
  "scene.renaissance.tagline": "Olieverf, fluweel en 400 jaar zijwaartse blikken.",
  "scene.beach-vacation.title": "Strandvakantie",
  "scene.beach-vacation.tagline": "Out of office. Nog steeds oordelend over de meeuwen.",
  "scene.head-chef.title": "Chef-kok",
  "scene.head-chef.tagline": "De keuken is dicht. De criticus is harig.",
  "scene.original-superhero.title": "Originele superheld",
  "scene.original-superhero.tagline": "Een cape die we bedachten. Een stad die zij al bezitten.",
  "scene.christmas-portrait.title": "Kerstportret",
  "scene.christmas-portrait.tagline": "De jaarlijkse kaart die écht wordt ingelijst.",

  // How it works
  "how.1.title": "Geef je huisdier een naam",
  "how.1.body": "Een voornaam is genoeg. Nog geen betaling.",
  "how.2.title": "Upload één foto",
  "how.2.body": "Een duidelijk gezicht, naar voren. Voeg je e-mail toe.",
  "how.3.title": "Controleer en betaal één keer",
  "how.3.body": "Geen abonnement. Geen verlenging. Stripe-checkout.",
  "how.4.title": "Krijg 12 portretten en 2 clips",
  "how.4.body": "Hetzelfde huisdier. Replicate start direct na betaling.",

  // FAQs
  "faq.sub.q": "Is dit een abonnement?",
  "faq.sub.a": "Nee. Eenmalige betaling. Niets vernieuwt.",
  "faq.look.q": "Zal het op mijn huisdier lijken?",
  "faq.look.a":
    "Ja — dat is het product. Eén foto, twaalf scènes, twee cinematische clips, hetzelfde gezicht. Een persoon controleert vóór je download.",
  "faq.time.q": "Hoe lang duurt het?",
  "faq.time.a":
    "Meestal een paar minuten na betaling. Replicate start de twaalf portretten meteen.",
  "faq.photo.q": "Welke foto werkt het best?",
  "faq.photo.a":
    "Eén huisdier, gezicht naar de camera, beide ogen zichtbaar, gelijkmatig licht. Geen groepsfoto’s of zware filters.",
  "faq.gift.q": "Kan ik dit cadeau doen?",
  "faq.gift.a": "Ja. Gebruik de foto van hun huisdier, betaal één keer en stuur de galerijlink.",
  "faq.remake.q": "Wat als een portret niet op mijn huisdier lijkt?",
  "faq.remake.a":
    "Open Help op je bestelpagina en stuur een ticket. Als een resultaat niet herkenbaar op je huisdier lijkt, maken we het opnieuw.",
  "faq.private.q": "Is mijn bronfoto privé?",
  "faq.private.a":
    "Je foto wordt alleen gebruikt om deze bestelling te maken. Hij wordt niet als openbare marketing gebruikt. We verkopen hem niet.",
  "faq.multi.q": "Kan ik meerdere huisdieren meenemen?",
  "faq.multi.a":
    "Niet in één bestelling. Gebruik één duidelijke foto met één huisdier. Groepsfoto’s worden vóór generatie geweigerd.",
  "faq.human.q": "Wat betekent “door mensen gecontroleerd”?",
  "faq.human.a":
    "Portretten zijn klaar zodra de generatie klaar is. Als iets niet klopt, open Help en we maken het opnieuw.",
  "faq.formats.q": "Welke bestandsformaten ontvang ik?",
  "faq.formats.a":
    "Je ontvangt de gegenereerde portretbestanden en twee cinematische MP4-clips uit de bestelgalerij. Extra uitsnedes zoals wallpapers zijn nog niet inbegrepen.",

  // Validation
  "validate.name": "Geef je huisdier een naam — zelfs een bijnaam is prima.",
};
