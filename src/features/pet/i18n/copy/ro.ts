import type { PetCopyMap } from "./en";

/** Romanian copy for /pet (V1 + V2 funnel). */
export const PET_COPY_RO: PetCopyMap = {
  // Species
  "species.dog": "Câine",
  "species.cat": "Pisică",
  "species.other": "Altul",
  "species.otherHint": "Alt animal",
  "species.pet": "animal de companie",
  "species.dogLower": "câine",
  "species.catLower": "pisică",
  "species.golden": "Golden Retriever",
  "species.tablist": "Tip de animal",

  // Shared chrome
  "chrome.back": "Înapoi",
  "chrome.lang": "Limbă",
  "chrome.before": "Înainte",
  "chrome.after": "După",
  "chrome.clipBadge": "Clip de 5s",
  "chrome.optional": "(opțional)",
  "chrome.endsIn": "Se termină în {countdown}",

  // V2 landing
  "v2.landing.eyebrow": "Încearcă gratuit",
  "v2.landing.h1": "Vezi-ți animalul ca pilot de Formula 1.",
  "v2.landing.lede":
    "Încarcă o fotografie și primești gratuit o previzualizare neclară a vieții secrete a {pet} — fără card.",
  "v2.landing.cta": "Încarcă fotografia animalului",
  "v2.landing.chooseFile": "Alege un JPEG, PNG sau WebP",
  "v2.landing.bullet.lives": "12 vieți secrete",
  "v2.landing.bullet.clips": "2 mini clipuri",
  "v2.landing.bullet.price": "{price} o singură dată",
  "v2.landing.bullet.teaser": "Previzualizare în câteva secunde",
  "v2.landing.bullet.noSub": "Fără abonament",
  "v2.landing.bullet.private": "Fotografia rămâne privată",
  "v2.landing.proofAria": "Exemple de portrete și clipuri",
  "v2.landing.livesH2": "Toate cele 12 vieți secrete",
  "v2.landing.livesLede.dog":
    "Douăsprezece portrete cu același {pet} — fiecare lume inclusă. 2 mini clipuri incluse.",
  "v2.landing.livesLede.other": "Douăsprezece portrete. O fotografie. Multe tipuri de animale.",
  "v2.landing.closingH2": "Descoperă viața secretă a animalului tău.",
  "v2.landing.closingLede":
    "Încarcă o fotografie pentru o previzualizare personalizată gratuită. Deblochează 12 vieți secrete și 2 mini clipuri pentru {price} astăzi.",
  "v2.landing.closingRenew": "{compare} {price} · oferta se reînnoiește la fiecare 24 de ore",
  "v2.landing.saleLine": "{compare} {price} astăzi · mai rămân {countdown}",
  "v2.landing.stickySale": "{compare} → {price} astăzi · mai rămân {countdown}",
  "v2.landing.stickyIdle": "{price} o singură dată · fără card pentru previzualizarea gratuită",
  "v2.landing.originalAlt": "Fotografia originală a {pet} de demonstrație",
  "v2.landing.afterAlt": "Previzualizare ca pilot de Formula 1 a aceluiași {pet} de demonstrație",
  "v2.landing.clipAlt": "Mini clip {title}",
  "v2.landing.exampleAlt": "Exemplu {title}",

  // V2 pack / offer chrome
  "v2.pack.badge": "Ofertă de 24 de ore",
  "v2.pack.headline": "Primești 12 vieți secrete și 2 mini clipuri pentru doar {price}",
  "v2.pack.headlineRich": "Primești 12 vieți secrete și 2 mini clipuri pentru doar",
  "v2.pack.fine": "O singură plată · fără abonament · același animal în fiecare portret și clip",
  "v2.shell.footer": "{headline}. Previzualizare personalizată gratuită — plătești doar ca să deblochezi.",

  // V2 photo
  "v2.photo.h1": "O fotografie clară.",
  "v2.photo.lede":
    "Fața spre cameră, ambii ochi vizibili, lumină uniformă. Un singur {pet} — fără poze de grup sau filtre puternice.",
  "v2.photo.selectedAlt": "Fotografia selectată a animalului",
  "v2.photo.selectedNamed": "Selectat: {fileName}",
  "v2.photo.replace": "Înlocuiește",
  "v2.photo.remove": "Șterge",
  "v2.photo.choose": "Alege o fotografie",
  "v2.photo.formats": "JPEG, PNG sau WebP · max. 15 MB",
  "v2.photo.cta": "Vezi previzualizarea vieții secrete",
  "v2.photo.viewTeaser": "Vezi previzualizarea mea",
  "v2.photo.confirm.dog": "Confirm că această fotografie arată câinele meu (nu o pisică sau alt animal).",
  "v2.photo.confirm.cat": "Confirm că această fotografie arată pisica mea (nu un câine sau alt animal).",
  "v2.photo.confirmErr.dog":
    "Această experiență este gândită pentru câini. Confirmă că fotografia arată câinele tău sau încarcă o fotografie clară cu un câine.",
  "v2.photo.confirmErr.cat":
    "Această experiență este gândită pentru pisici. Confirmă că fotografia arată pisica ta sau încarcă o fotografie clară cu o pisică.",
  "v2.photo.needPhoto": "Alege mai întâi o fotografie.",

  // V2 teaser / checkout
  "v2.teaser.h1": "Viața secretă a {pet} e gata să fie dezvăluită.",
  "v2.teaser.support": "Deblochează colecția personalizată completă 12+2 pentru {price}.",
  "v2.teaser.alt": "Previzualizare neclară a vieții secrete a animalului tău",
  "v2.teaser.bullet.lives": "12 vieți secrete ale aceluiași {pet}",
  "v2.teaser.bullet.clips": "2 mini clipuri cinematice",
  "v2.teaser.bullet.price": "Plată unică de {price} — fără abonament",
  "v2.teaser.petName": "Numele animalului",
  "v2.teaser.email": "Email pentru galerie",
  "v2.teaser.payAria": "Plată securizată",
  "v2.teaser.reupload": "Încarcă din nou fotografia animalului",
  "v2.teaser.hostedHint": "Continuă pe pagina securizată Stripe ca să finalizezi plata unică.",
  "v2.teaser.hostedOpening": "Se deschide checkout-ul securizat Stripe…",
  "v2.teaser.hostedBusy": "Se deschide checkout-ul securizat Stripe…",
  "v2.teaser.hostedCta": "Continuă către checkout-ul securizat Stripe — {price}",
  "v2.teaser.retry": "Deschide checkout-ul securizat Stripe — {price}",
  "v2.teaser.retrying": "Se reîncearcă…",
  "v2.teaser.busyPay": "Se procesează plata securizată…",
  "v2.teaser.loadingPay": "Se încarcă plata securizată…",
  "v2.teaser.preparing": "Se pregătește plata securizată…",
  "v2.teaser.paused":
    "Plata securizată este în pauză până când capacitatea de generare revine. Nu ai fost taxat.",
  "v2.teaser.secureLine": "Plată unică securizată Stripe de {price}. Fără abonament.",
  "v2.teaser.payDog": "Dezvăluie viața secretă a câinelui meu — {price}",
  "v2.teaser.payCat": "Dezvăluie viața secretă a pisicii mele — {price}",
  "v2.teaser.payPet": "Dezvăluie viața secretă a animalului meu — {price}",
  "v2.teaser.sessionExpiredContact": "Sesiunea de plată a expirat. Reîncearcă plata securizată.",

  // V2 offer (legacy step)
  "v2.offer.h1": "Deblochează colecția",
  "v2.offer.lede": "{headline}. O singură plată. Fără abonament.",
  "v2.offer.bullet.lives": "12 vieți secrete ale aceluiași animal",
  "v2.offer.bullet.clips": "2 mini clipuri cinematice",
  "v2.offer.bullet.ready": "De obicei gata la câteva minute după plată",
  "v2.offer.bullet.remake":
    "Dacă un rezultat plătit nu seamănă recognoscibil cu animalul tău, îl refacem",
  "v2.offer.cta": "Primește 12 vieți + 2 clipuri pentru {price}",
  "v2.offer.opening": "Se deschide checkout-ul securizat…",
  "v2.offer.fine": "Checkout securizat Stripe. Nu vei fi taxat de două ori.",

  // V2 generating / preview (legacy)
  "v2.gen.h1": "Creăm previzualizarea F1 a animalului tău",
  "v2.gen.lede":
    "Transformăm animalul tău într-un pilot cinematografic de Formula 1. Aceasta este o previzualizare gratuită — nu colecția completă încă.",
  "v2.gen.retry": "Încearcă din nou",
  "v2.gen.change": "Schimbă fotografia",
  "v2.gen.thumbAlt": "Animalul tău încărcat",
  "v2.preview.eyebrow": "Previzualizare cinematografică gratuită",
  "v2.preview.h1Named": "{name} ca pilot F1",
  "v2.preview.h1": "{pet} ca pilot F1",
  "v2.preview.lede":
    "Viața secretă a {pet} începe aici. Deblochează colecția completă ca să vezi și mai multe transformări incredibile.",
  "v2.preview.yourPhoto": "Fotografia ta",
  "v2.preview.f1": "Previzualizare F1",
  "v2.preview.uploadAlt": "{pet} încărcat",
  "v2.preview.f1Alt": "{pet} ca pilot de Formula 1",
  "v2.preview.mock":
    "Previzualizare prototip: generarea AI live este dezactivată în acest mediu, deci vezi fotografia ta cu un cadru în stil F1.",
  "v2.preview.unlock": "Deblochează colecția completă — {price}",
  "v2.preview.regen": "Încearcă altă previzualizare gratuită",

  // Checkout loading phases
  "v2.checkout.preparing_photo": "Se pregătește fotografia…",
  "v2.checkout.creating_order": "Se pornește checkout-ul securizat…",
  "v2.checkout.uploading": "Se încarcă fotografia…",
  "v2.checkout.creating_session": "Se încarcă plata securizată…",
  "v2.checkout.expired":
    "Sesiunea de checkout securizat a expirat. Te rugăm să încarci din nou fotografia animalului.",
  "v2.checkout.failed":
    "Nu am putut deschide formularul de plată securizată. Te rugăm să încerci din nou. Nu ai fost taxat.",
  "v2.provider.unavailable":
    "Momentan nu putem crea transformări noi. Te rugăm să încerci din nou în curând — nu ai fost taxat.",

  // Preview errors
  "v2.err.invalid_funnel":
    "Această previzualizare nu corespunde experienței actuale. Reîmprospătează și încearcă din nou.",
  "v2.err.rate_limited":
    "Această sesiune a folosit deja previzualizările gratuite. Deblochează colecția sau încearcă mâine.",
  "v2.err.timeout":
    "Previzualizarea încă se generează. Așteaptă un moment, apoi apasă Încearcă din nou — continuăm de unde am rămas.",
  "v2.err.rate_limit":
    "Serviciul de previzualizare este ocupat. Apasă Încearcă din nou peste un moment — de obicei se rezolvă rapid.",
  "v2.err.wrong_species":
    "Fotografia nu se potrivește cu această experiență. Te rugăm să încarci o fotografie clară cu animalul potrivit.",
  "v2.err.invalid_image": "Fotografia nu a putut fi folosită. Încearcă un JPEG, PNG sau WebP mai mic.",
  "v2.err.provider_auth": "Generarea previzualizării este temporar indisponibilă. Încearcă din nou în câteva minute.",
  "v2.err.endpoint_unreachable":
    "Nu am putut contacta serviciul de previzualizare. Verifică conexiunea și încearcă din nou.",
  "v2.err.server_error":
    "Ceva s-a blocat de la o încercare anterioară. Apasă Încearcă din nou sau înlocuiește fotografia pentru o previzualizare nouă.",
  "v2.err.provider_error":
    "Nu am putut finaliza previzualizarea de data aceasta. Încearcă din nou sau înlocuiește fotografia dacă tot eșuează.",

  // V1 product / landing
  "v1.product.name": "My Pet’s Secret Life",
  "v1.product.promise": "O fotografie. 12 vieți secrete. 2 clipuri cinematice.",
  "v1.hero.subtitle":
    "Vezi-ți animalul ca regalitate, astronaut, CEO și multe altele — aceeași față în fiecare lume.",
  "v1.hero.promise": "O fotografie. 12 vieți secrete. 2 clipuri cinematice.",
  "v1.offer.noSub": "Fără abonament",
  "v1.offer.include.portraits": "12 portrete ale aceluiași animal",
  "v1.offer.include.clips": "2 clipuri cinematice de 5 secunde",
  "v1.offer.include.review": "Verificare umană înainte de descărcare",
  "v1.offer.include.price": "Preț unic — fără abonament",
  "v1.landing.dog.heading": "Douăsprezece vieți secrete",
  "v1.landing.dog.description":
    "Treci cu mouse-ul sau apasă pe un portret ca să-l vezi mișcându-se. Același Golden Retriever. O lume diferită în fiecare cadru.",
  "v1.landing.dog.support":
    "Transformă-ți câinele în regalitate, astronaut, CEO și încă nouă vieți secrete.",
  "v1.landing.cat.heading": "Douăsprezece vieți secrete",
  "v1.landing.cat.description":
    "Treci cu mouse-ul sau apasă pe un portret ca să-l vezi mișcându-se. Aceeași pisică. O lume diferită în fiecare cadru.",
  "v1.landing.cat.support":
    "Transformă-ți pisica în regalitate, astronaut, CEO și încă nouă vieți secrete.",
  "v1.landing.other.heading": "Creat pentru tot felul de animale",
  "v1.landing.other.description":
    "Treci cu mouse-ul sau apasă pe un portret ca să-l vezi mișcându-se. Fiecare animal merită o viață secretă.",
  "v1.landing.other.support": "Fiecare animal merită o viață secretă.",
  "v1.clips.heading": "Două clipuri cinematice",
  "v1.clips.dog": "Același animal. Cinci secunde. O lume în mișcare.",
  "v1.clips.cat": "Aceeași pisică. Cinci secunde. O lume în mișcare.",
  "v1.clips.other": "Exemple de mișcare de cinci secunde pentru diferite tipuri de animale.",
  "v1.guarantee.heading": "Garanția Aceluiași Animal",
  "v1.guarantee.body":
    "Fiecare portret și clip este verificat de o persoană. Dacă un rezultat nu seamănă recognoscibil cu animalul tău, îl refacem înainte de livrare.",
  "v1.seo.dog.title": "Portrete și videoclipuri personalizate pentru câini | My Pet’s Secret Life",
  "v1.seo.dog.description":
    "Transformă o fotografie a câinelui tău în 12 portrete personalizate și 2 clipuri cinematice de 5 secunde. Aceeași față în fiecare lume. Plată unică. Fără abonament.",
  "v1.seo.cat.title": "Portrete și videoclipuri personalizate pentru pisici | My Pet’s Secret Life",
  "v1.seo.cat.description":
    "Transformă o fotografie a pisicii tale în 12 portrete personalizate și 2 clipuri cinematice de 5 secunde. Aceeași față în fiecare lume. Plată unică. Fără abonament.",
  "v1.seo.other.title": "Portrete și videoclipuri personalizate pentru animale | My Pet’s Secret Life",
  "v1.seo.other.description":
    "Portrete personalizate și clipuri cinematice pentru iepuri, păsări, animale mici, reptile, cai și alte animale. O fotografie. Verificare umană. Plată unică.",

  // Subtypes
  "subtype.rabbit": "Iepure",
  "subtype.bird": "Pasăre",
  "subtype.small_pet": "Animal mic",
  "subtype.reptile": "Reptilă",
  "subtype.horse": "Cal",
  "subtype.other": "Altul",

  // Other gallery subjects
  "other.royal-portrait": "Broască țestoasă",
  "other.luxury-ceo": "Ara",
  "other.astronaut": "Hamster",
  "other.formula-racer": "Iepure",
  "other.spa-bathtub": "Arici",
  "other.newspaper": "Porcușor de Guineea",
  "other.cinema-boss": "Dragon bărbos",
  "other.renaissance": "Dihor",
  "other.beach-vacation": "Peștișor auriu",
  "other.head-chef": "Purcel miniatural",
  "other.original-superhero": "Cameleon",
  "other.christmas-portrait": "Nimfă",
  "other.mixedGallery": "Exemple mixte de animale",

  // Scenes
  "scene.royal-portrait.title": "Portret regal",
  "scene.royal-portrait.tagline": "Coroana e opțională. Privirea, nu.",
  "scene.luxury-ceo.title": "CEO de lux",
  "scene.luxury-ceo.tagline": "Recompense trimestriale. Birou deschis. Labe închise.",
  "scene.astronaut.title": "Astronaut",
  "scene.astronaut.tagline": "Un pas mic pentru lăbuțe. Un salt uriaș pentru gustări.",
  "scene.formula-racer.title": "Pilot de curse Formula",
  "scene.formula-racer.tagline": "Pole position. Mângâieri pe burtă la pit-stop.",
  "scene.spa-bathtub.title": "Spa / cadă",
  "scene.spa-bathtub.tagline": "Castravetele e opțional. Demnitatea, nu.",
  "scene.newspaper.title": "Citind ziarul",
  "scene.newspaper.tagline": "Știre de ultimă oră: siesta mutată la 14:15.",
  "scene.cinema-boss.title": "Șef de cinema fictiv",
  "scene.cinema-boss.tagline": "Un birou inventat. O privire foarte reală.",
  "scene.renaissance.title": "Pictură renascentistă",
  "scene.renaissance.tagline": "Ulei, catifea și 400 de ani de privire piezișă.",
  "scene.beach-vacation.title": "Vacanță la plajă",
  "scene.beach-vacation.tagline": "Absent de la birou. Tot judecă pescărușii.",
  "scene.head-chef.title": "Bucătar-șef",
  "scene.head-chef.tagline": "Bucătăria e închisă. Criticul e blănos.",
  "scene.original-superhero.title": "Supererou original",
  "scene.original-superhero.tagline": "O pelerină inventată de noi. Un oraș pe care îl dețin deja.",
  "scene.christmas-portrait.title": "Portret de Crăciun",
  "scene.christmas-portrait.tagline": "Felicitarea anuală care chiar ajunge în ramă.",

  // How it works
  "how.1.title": "Dă-i un nume animalului",
  "how.1.body": "Un prenume e de ajuns. Încă nu se plătește nimic.",
  "how.2.title": "Încarcă o fotografie",
  "how.2.body": "Față clară, privirea înainte. Adaugă emailul tău.",
  "how.3.title": "Verifică și plătește o dată",
  "how.3.body": "Fără abonament. Fără reînnoire. Checkout Stripe.",
  "how.4.title": "Primești 12 portrete și 2 clipuri",
  "how.4.body": "Același animal. Replicate începe imediat după plată.",

  // FAQs
  "faq.sub.q": "Este un abonament?",
  "faq.sub.a": "Nu. Plată unică. Nimic nu se reînnoiește.",
  "faq.look.q": "Va semăna cu animalul meu?",
  "faq.look.a":
    "Da — asta e produsul. O fotografie, douăsprezece scene, două clipuri cinematice, aceeași față. O persoană verifică înainte să descarci.",
  "faq.time.q": "Cât durează?",
  "faq.time.a":
    "De obicei câteva minute după plată. Replicate pornește cele douăsprezece portrete imediat.",
  "faq.photo.q": "Ce fotografie funcționează cel mai bine?",
  "faq.photo.a":
    "Un animal, fața spre cameră, ambii ochi vizibili, lumină uniformă. Fără poze de grup sau filtre puternice.",
  "faq.gift.q": "Pot face cadou asta?",
  "faq.gift.a": "Da. Folosește fotografia animalului lor, plătește o dată și trimite linkul galeriei.",
  "faq.remake.q": "Ce se întâmplă dacă un portret nu seamănă cu animalul meu?",
  "faq.remake.a":
    "Deschide Ajutor pe pagina comenzii și trimite un ticket. Dacă un rezultat nu seamănă recognoscibil cu animalul tău, îl refacem.",
  "faq.private.q": "Fotografia sursă rămâne privată?",
  "faq.private.a":
    "Fotografia ta e folosită doar ca să creăm această comandă. Nu e folosită ca marketing public. Nu o vindem.",
  "faq.multi.q": "Pot include mai multe animale?",
  "faq.multi.a":
    "Nu într-o singură comandă. Folosește o fotografie clară cu un singur animal. Pozele de grup sunt respinse înainte de generare.",
  "faq.human.q": "Ce înseamnă „verificat de om”?",
  "faq.human.a":
    "Portretele sunt gata imediat ce generarea se termină. Dacă ceva nu arată bine, deschide Ajutor și le refacem.",
  "faq.formats.q": "Ce formate de fișier primesc?",
  "faq.formats.a":
    "Primești fișierele de portret generate și două clipuri MP4 cinematice din galeria comenzii. Decupaje suplimentare precum wallpaper-uri nu sunt încă incluse.",

  // Validation
  "validate.name": "Dă-i un nume animalului — chiar și o poreclă e în regulă.",
};
