/** English source-of-truth copy for /pet (V1 + V2 funnel). */

export type PetCopyMap = Record<string, string>;

export const PET_COPY_EN: PetCopyMap = {
  // Species
  "species.dog": "Dog",
  "species.cat": "Cat",
  "species.other": "Other",
  "species.otherHint": "Other pet",
  "species.pet": "pet",
  "species.dogLower": "dog",
  "species.catLower": "cat",
  "species.yourDog": "your dog",
  "species.yourCat": "your cat",
  "species.yourPet": "your pet",
  "species.golden": "Golden Retriever",
  "species.tablist": "Pet type",

  // Shared chrome
  "chrome.back": "Back",
  "chrome.lang": "Language",
  "chrome.before": "Before",
  "chrome.after": "After",
  "chrome.clipBadge": "5s clip",
  "chrome.optional": "(optional)",
  "chrome.endsIn": "Ends in {countdown}",

  // V2 landing
  "v2.landing.eyebrow": "Try it free",
  "v2.landing.h1": "See your pet as a Formula 1 driver.",
  "v2.landing.lede":
    "Upload one photo and get a free blurred teaser of {pet}’s secret life — no card required.",
  "v2.landing.lede.dog": "Upload one photo and get a free blurred teaser of your dog’s secret life — no card required.",
  "v2.landing.lede.cat": "Upload one photo and get a free blurred teaser of your cat’s secret life — no card required.",
  "v2.landing.lede.other": "Upload one photo and get a free blurred teaser of your pet’s secret life — no card required.",
  "v2.landing.cta": "Upload your pet photo",
  "v2.landing.chooseFile": "Choose a JPEG, PNG, or WebP",
  "v2.landing.bullet.lives": "12 secret lives",
  "v2.landing.bullet.clips": "2 mini clips",
  "v2.landing.bullet.price": "{price} one-time",
  "v2.landing.bullet.teaser": "Teaser in seconds",
  "v2.landing.bullet.noSub": "No subscription",
  "v2.landing.bullet.private": "Photo stays private",
  "v2.landing.proofAria": "Example portraits and clips",
  "v2.landing.livesH2": "All 12 secret lives",
  "v2.landing.livesLede.dog":
    "Twelve portraits of the same {pet} — every world included. 2 mini clips included.",
  "v2.landing.livesLede.other": "Twelve portraits. One photo. Many kinds of pets.",
  "v2.landing.closingH2": "Reveal your pet’s secret life.",
  "v2.landing.closingLede":
    "Upload one photo for a free personalized teaser. Unlock 12 secret lives and 2 mini clips for {price} today.",
  "v2.landing.closingRenew": "{price} · offer renews every 24 hours",
  "v2.landing.saleLine": "{price} today · {countdown} left",
  "v2.landing.stickySale": "{price} today · {countdown} left",
  "v2.landing.stickyIdle": "{price} one-time · no card for the free preview",
  "v2.landing.originalAlt": "Original photo of the demo {pet}",
  "v2.landing.afterAlt": "Formula 1 driver preview of the same demo {pet}",
  "v2.landing.clipAlt": "{title} mini clip",
  "v2.landing.exampleAlt": "{title} example",

  // V2 pack / offer chrome
  "v2.pack.badge": "24-hour offer",
  "v2.pack.headline": "Get 12 secret lives and 2 mini clips for only {price}",
  "v2.pack.headlineRich": "Get 12 secret lives and 2 mini clips for only",
  "v2.pack.fine": "One-time · no subscription · same pet in every portrait and clip",
  "v2.shell.footer": "{headline}. Free personalized teaser — pay only to unlock.",

  // V2 photo
  "v2.photo.h1": "One clear photo.",
  "v2.photo.lede":
    "Face toward the camera, both eyes visible, even light. One {pet} only — no group shots or heavy filters.",
  "v2.photo.selectedAlt": "Selected pet photo",
  "v2.photo.selectedNamed": "Selected {fileName}",
  "v2.photo.replace": "Replace",
  "v2.photo.remove": "Remove",
  "v2.photo.choose": "Choose a photo",
  "v2.photo.formats": "JPEG, PNG, or WebP · 15 MB max",
  "v2.photo.cta": "See my secret-life teaser",
  "v2.photo.viewTeaser": "View my teaser",
  "v2.photo.confirm.dog": "I confirm this photo shows my dog (not a cat or other animal).",
  "v2.photo.confirm.cat": "I confirm this photo shows my cat (not a dog or other animal).",
  "v2.photo.confirmErr.dog":
    "This experience is designed for dogs. Please confirm the photo shows your dog, or upload a clear dog photo.",
  "v2.photo.confirmErr.cat":
    "This experience is designed for cats. Please confirm the photo shows your cat, or upload a clear cat photo.",
  "v2.photo.needPhoto": "Choose a photo first.",

  // V2 teaser / checkout
  "v2.teaser.h1": "Your {pet}’s secret life is ready to be revealed.",
  "v2.teaser.h1.dog": "Your dog’s secret life is ready to be revealed.",
  "v2.teaser.h1.cat": "Your cat’s secret life is ready to be revealed.",
  "v2.teaser.h1.other": "Your pet’s secret life is ready to be revealed.",
  "v2.teaser.support": "Unlock the complete personalized 12+2 image collection for {price}.",
  "v2.teaser.alt": "Blurred preview of your pet’s secret life",
  "v2.teaser.bullet.lives": "12 secret lives of the same {pet}",
  "v2.teaser.bullet.clips": "2 mini cinematic clips",
  "v2.teaser.bullet.price": "One-time {price} payment — no subscription",
  "v2.teaser.petName": "Pet’s name",
  "v2.teaser.email": "Email for the gallery",
  "v2.teaser.payAria": "Secure payment",
  "v2.teaser.reupload": "Upload your pet photo again",
  "v2.teaser.hostedHint": "Continue on Stripe’s secure checkout page to finish your one-time payment.",
  "v2.teaser.hostedOpening": "Opening Stripe’s secure checkout…",
  "v2.teaser.hostedBusy": "Opening secure Stripe checkout…",
  "v2.teaser.hostedCta": "Continue to secure Stripe checkout — {price}",
  "v2.teaser.retry": "Open secure Stripe checkout — {price}",
  "v2.teaser.retrying": "Retrying…",
  "v2.teaser.busyPay": "Processing secure payment…",
  "v2.teaser.loadingPay": "Loading secure payment…",
  "v2.teaser.preparing": "Preparing secure payment…",
  "v2.teaser.paused":
    "Secure payment is paused until generation capacity is restored. You haven’t been charged.",
  "v2.teaser.secureLine": "Secure one-time {price} Stripe payment. No subscription.",
  "v2.teaser.payDog": "Reveal My Dog’s Secret Life — {price}",
  "v2.teaser.payCat": "Reveal My Cat’s Secret Life — {price}",
  "v2.teaser.payPet": "Reveal My Pet’s Secret Life — {price}",
  "v2.teaser.sessionExpiredContact": "Payment session expired. Retry secure payment.",

  // V2 offer (legacy step)
  "v2.offer.h1": "Unlock the collection",
  "v2.offer.lede": "{headline}. One-time. No subscription.",
  "v2.offer.bullet.lives": "12 secret lives of the same pet",
  "v2.offer.bullet.clips": "2 mini cinematic clips",
  "v2.offer.bullet.ready": "Usually ready a few minutes after payment",
  "v2.offer.bullet.remake":
    "If a paid result does not recognizably look like your pet, we remake it",
  "v2.offer.cta": "Get 12 lives + 2 clips for {price}",
  "v2.offer.opening": "Opening secure checkout…",
  "v2.offer.fine": "Secure Stripe checkout. You won’t be charged twice.",

  // V2 generating / preview (legacy)
  "v2.gen.h1": "Creating your pet’s F1 driver preview",
  "v2.gen.lede":
    "We’re turning your pet into a cinematic Formula 1 driver. This is one free preview — not the full collection yet.",
  "v2.gen.retry": "Try again",
  "v2.gen.change": "Change photo",
  "v2.gen.thumbAlt": "Your uploaded pet",
  "v2.preview.eyebrow": "Free cinematic preview",
  "v2.preview.h1Named": "{name} as an F1 driver",
  "v2.preview.h1": "Your {pet} as an F1 driver",
  "v2.preview.lede":
    "Your {pet}’s secret life starts here. Unlock the full collection to see even more incredible transformations.",
  "v2.preview.yourPhoto": "Your photo",
  "v2.preview.f1": "F1 preview",
  "v2.preview.uploadAlt": "Your uploaded {pet}",
  "v2.preview.f1Alt": "Your {pet} as a Formula 1 driver",
  "v2.preview.mock":
    "Prototype preview: live AI generation is off in this environment, so this is your photo with F1-styled framing.",
  "v2.preview.unlock": "Unlock full collection — {price}",
  "v2.preview.regen": "Try another free preview",

  // Checkout loading phases
  "v2.checkout.preparing_photo": "Preparing your photo…",
  "v2.checkout.creating_order": "Starting secure checkout…",
  "v2.checkout.uploading": "Uploading your photo…",
  "v2.checkout.creating_session": "Loading secure payment…",
  "v2.checkout.expired":
    "Your secure checkout session expired. Please upload your pet photo again.",
  "v2.checkout.failed":
    "We couldn’t open the secure payment form. Please try again. You haven’t been charged.",
  "v2.provider.unavailable":
    "We’re temporarily unable to create new transformations. Please try again shortly — you haven’t been charged.",

  // Preview errors
  "v2.err.invalid_funnel":
    "This preview doesn’t match the current experience. Refresh and try again.",
  "v2.err.rate_limited":
    "This session already used its free previews. Unlock the collection or try again tomorrow.",
  "v2.err.timeout":
    "Your preview is still rendering. Wait a moment, then tap Try again — we’ll pick up where it left off.",
  "v2.err.rate_limit":
    "The preview service is busy. Tap Try again in a moment — this usually clears quickly.",
  "v2.err.wrong_species":
    "That photo doesn’t match this experience. Please upload a clear photo of the right pet.",
  "v2.err.invalid_image": "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
  "v2.err.provider_auth": "Preview generation is temporarily unavailable. Try again in a few minutes.",
  "v2.err.endpoint_unreachable":
    "We couldn’t reach the preview service. Check your connection and try again.",
  "v2.err.server_error":
    "Something got stuck from an earlier attempt. Tap Try again or replace the photo for a fresh preview.",
  "v2.err.provider_error":
    "We couldn’t finish the preview this time. Try again, or replace the photo if it keeps failing.",

  // V1 product / landing
  "v1.product.name": "My Pet’s Secret Life",
  "v1.product.promise": "One photo. 12 secret lives. 2 cinematic clips.",
  "v1.hero.subtitle":
    "See your pet as royalty, an astronaut, a CEO and more — the same face in every world.",
  "v1.hero.promise": "One photo. 12 secret lives. 2 cinematic clips.",
  "v1.offer.noSub": "No subscription",
  "v1.offer.include.portraits": "12 portraits of the same pet",
  "v1.offer.include.clips": "2 cinematic 5-second clips",
  "v1.offer.include.review": "Human review before download",
  "v1.offer.include.price": "One-time price — no subscription",
  "v1.landing.dog.heading": "Twelve secret lives",
  "v1.landing.dog.description":
    "Hover or tap a portrait to watch it move. Same Golden Retriever. A different world in every frame.",
  "v1.landing.dog.support":
    "Turn your dog into royalty, an astronaut, a CEO and nine more secret lives.",
  "v1.landing.cat.heading": "Twelve secret lives",
  "v1.landing.cat.description":
    "Hover or tap a portrait to watch it move. Same cat. A different world in every frame.",
  "v1.landing.cat.support":
    "Turn your cat into royalty, an astronaut, a CEO and nine more secret lives.",
  "v1.landing.other.heading": "Made for many kinds of pets",
  "v1.landing.other.description":
    "Hover or tap a portrait to watch it move. Every pet deserves a secret life.",
  "v1.landing.other.support": "Every pet deserves a secret life.",
  "v1.clips.heading": "Two cinematic clips",
  "v1.clips.dog": "Same pet. Five seconds. A world in motion.",
  "v1.clips.cat": "Same cat. Five seconds. A world in motion.",
  "v1.clips.other": "Five-second motion examples for different kinds of pets.",
  "v1.guarantee.heading": "The Same Pet Guarantee",
  "v1.guarantee.body":
    "Every portrait and clip is checked by a person. If a result does not recognizably look like your pet, we remake it before delivery.",
  "v1.seo.dog.title": "Custom Dog Portraits & Videos | My Pet’s Secret Life",
  "v1.seo.dog.description":
    "Turn one photo of your dog into 12 personalized portraits and 2 cinematic 5-second clips. Same face in every world. One-time payment. No subscription.",
  "v1.seo.cat.title": "Custom Cat Portraits & Videos | My Pet’s Secret Life",
  "v1.seo.cat.description":
    "Turn one photo of your cat into 12 personalized portraits and 2 cinematic 5-second clips. Same face in every world. One-time payment. No subscription.",
  "v1.seo.other.title": "Custom Pet Portraits & Videos | My Pet’s Secret Life",
  "v1.seo.other.description":
    "Custom portraits and cinematic clips for rabbits, birds, small pets, reptiles, horses, and other animals. One photo. Human reviewed. One-time payment.",

  // Subtypes
  "subtype.rabbit": "Rabbit",
  "subtype.bird": "Bird",
  "subtype.small_pet": "Small pet",
  "subtype.reptile": "Reptile",
  "subtype.horse": "Horse",
  "subtype.other": "Other",

  // Other gallery subjects (gheară / mixed pets)
  "other.royal-portrait": "Turtle",
  "other.luxury-ceo": "Macaw",
  "other.astronaut": "Hamster",
  "other.formula-racer": "Rabbit",
  "other.spa-bathtub": "Hedgehog",
  "other.newspaper": "Guinea pig",
  "other.cinema-boss": "Bearded dragon",
  "other.renaissance": "Ferret",
  "other.beach-vacation": "Goldfish",
  "other.head-chef": "Mini pig",
  "other.original-superhero": "Chameleon",
  "other.christmas-portrait": "Cockatiel",
  "other.mixedGallery": "Mixed pet examples",

  // Scenes
  "scene.royal-portrait.title": "Royal portrait",
  "scene.royal-portrait.tagline": "A crown is optional. The stare is not.",
  "scene.luxury-ceo.title": "Luxury CEO",
  "scene.luxury-ceo.tagline": "Quarterly treats. Open office. Closed paws.",
  "scene.astronaut.title": "Astronaut",
  "scene.astronaut.tagline": "One small step for paws. One giant leap for snacks.",
  "scene.formula-racer.title": "Formula racing driver",
  "scene.formula-racer.tagline": "Pole position. Pit-stop belly rubs.",
  "scene.spa-bathtub.title": "Spa / bathtub",
  "scene.spa-bathtub.tagline": "Cucumbers optional. Dignity non-negotiable.",
  "scene.newspaper.title": "Reading a newspaper",
  "scene.newspaper.tagline": "Breaking news: nap moved to 2:15.",
  "scene.cinema-boss.title": "Fictional cinema boss",
  "scene.cinema-boss.tagline": "A made-up office. A very real glare.",
  "scene.renaissance.title": "Renaissance painting",
  "scene.renaissance.tagline": "Oil, velvet, and 400 years of side-eye.",
  "scene.beach-vacation.title": "Beach vacation",
  "scene.beach-vacation.tagline": "Out of office. Still judging the seagulls.",
  "scene.head-chef.title": "Head chef",
  "scene.head-chef.tagline": "The kitchen is closed. The critic is furry.",
  "scene.original-superhero.title": "Original superhero",
  "scene.original-superhero.tagline": "A cape we invented. A city they already own.",
  "scene.christmas-portrait.title": "Christmas portrait",
  "scene.christmas-portrait.tagline": "The annual card that actually gets framed.",

  // How it works
  "how.1.title": "Name your pet",
  "how.1.body": "A first name is enough. No charge yet.",
  "how.2.title": "Upload one photo",
  "how.2.body": "A clear face, looking forward. Add your email.",
  "how.3.title": "Review and pay once",
  "how.3.body": "No subscription. No renewal. Stripe checkout.",
  "how.4.title": "Get 12 portraits and 2 clips",
  "how.4.body": "Same pet. Replicate starts right after payment.",

  // FAQs
  "faq.sub.q": "Is this a subscription?",
  "faq.sub.a": "No. One-time payment. Nothing renews.",
  "faq.look.q": "Will it look like my pet?",
  "faq.look.a":
    "Yes — that is the product. One photo, twelve scenes, two cinematic clips, the same face. A person checks before you download.",
  "faq.time.q": "How long does it take?",
  "faq.time.a":
    "Usually a few minutes after payment. Replicate starts the twelve portraits immediately.",
  "faq.photo.q": "What photo works best?",
  "faq.photo.a":
    "One pet, face toward the camera, both eyes visible, even light. No group shots or heavy filters.",
  "faq.gift.q": "Can I gift this?",
  "faq.gift.a": "Yes. Use their pet’s photo, pay once, and send the gallery link.",
  "faq.remake.q": "What if a portrait does not look like my pet?",
  "faq.remake.a":
    "Open Help on your order page and send a ticket. If a result does not recognizably look like your pet, we remake it.",
  "faq.private.q": "Is my source photo private?",
  "faq.private.a":
    "Your photo is used only to create this order. It is not used as public marketing. We do not sell it.",
  "faq.multi.q": "Can I include multiple pets?",
  "faq.multi.a":
    "Not in one order. Use one clear photo with one pet. Group photos are rejected before generation.",
  "faq.human.q": "What does “human checked” mean?",
  "faq.human.a":
    "Portraits are ready as soon as generation finishes. If something looks off, open Help and we will remake it.",
  "faq.formats.q": "What file formats do I receive?",
  "faq.formats.a":
    "You receive the generated portrait files and two cinematic MP4 clips from the order gallery. Extra crops such as wallpapers are not included yet.",

  // Validation
  "validate.name": "Give your pet a name — even a nickname works.",
};
