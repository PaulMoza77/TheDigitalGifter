export const SANTA_CALL_PRODUCT_KEY = "christmas_santa_voice_call" as const;
export const SANTA_CALL_EXTENSION_PRODUCT_KEY = "christmas_santa_voice_call_extension" as const;
export const SANTA_CALL_COMMERCIAL_KEY = "xmas_santa_voice_call" as const;
export const SANTA_CALL_EXTENSION_COMMERCIAL_KEY = "xmas_santa_voice_call_extension" as const;
export const SANTA_CALL_ROUTE = "/christmas/santa-call" as const;
export const SANTA_CALL_CONSENT_VERSION = "santa_call_v2_2026_10" as const;
export const SANTA_CALL_MAX_SECONDS = 180;
export const SANTA_CALL_EXTENSION_SECONDS = 300;
/** Server-side seed / TEST amount in minor units (bani). Runtime uses pricing_items. */
/** @deprecated Prefer pricesForSantaCallMarket — RO seed only. */
export const SANTA_CALL_PRICE_MINOR_RON = 5900;
/** @deprecated Prefer pricesForSantaCallMarket — RO seed only. */
export const SANTA_CALL_EXTENSION_PRICE_MINOR_RON = 4900;
export const SANTA_CALL_PRICE_MINOR_USD = 1299;
export const SANTA_CALL_EXTENSION_PRICE_MINOR_USD = 999;

export type SantaCallLanguage = "en" | "ro";

export type SantaCallUiState =
  | "ready"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "reconnecting"
  | "awaiting_extension"
  | "completed"
  | "expired"
  | "failed";

export type SantaCallPersonalization = {
  childFirstName: string;
  language: SantaCallLanguage;
  /** Prefer auto language detection mid-call; parent fallback stays en|ro. */
  languageMode: "auto" | "fixed";
  age: string;
  christmasWish: string;
  hobbies: string;
  petName: string;
  positiveDetail: string;
  guardianConsent: boolean;
  email: string;
};

export const emptySantaCallPersonalization = (): SantaCallPersonalization => ({
  childFirstName: "",
  language: "ro",
  languageMode: "auto",
  age: "",
  christmasWish: "",
  hobbies: "",
  petName: "",
  positiveDetail: "",
  guardianConsent: false,
  email: "",
});

export function validateSantaCallPersonalization(p: SantaCallPersonalization): string | null {
  const name = p.childFirstName.trim();
  if (!name || name.length > 40) return "child_name";
  if (p.language !== "en" && p.language !== "ro") return "language";
  if (!p.guardianConsent) return "consent";
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) return "email";
  if (p.age) {
    const n = Number(p.age);
    if (!Number.isFinite(n) || n < 1 || n > 17) return "age";
  }
  if (p.christmasWish.length > 160) return "wish";
  if (p.hobbies.length > 120) return "hobbies";
  if (p.petName.length > 40) return "pet";
  if (p.positiveDetail.length > 160) return "detail";
  const injection = /ignore\s+(all\s+)?(previous|prior|above)\s+instructions|system\s*prompt/i;
  for (const field of [p.christmasWish, p.hobbies, p.petName, p.positiveDetail, p.childFirstName]) {
    if (injection.test(field)) return "injection";
  }
  return null;
}

export const SANTA_CALL_COPY = {
  ro: {
    brand: "The Digital Gifter",
    kicker: "Colecția de Crăciun",
    title: "Moș Crăciun vrea să vorbească cu tine!",
    subtitle: "Trei minute magice, în timp real — Moșul îi știe numele și îi răspunde copilului tău.",
    priceHint: "59,00 RON",
    extensionHint: "Prelungire opțională: +5 minute · 49,00 RON",
    cta: "Sună-l pe Moș Crăciun",
    ctaSticky: "Sună-l pe Moș",
    trust: "Plată securizată · Fără abonament · Un singur apel",
    marketLabel: "Piață / monedă",
    langLabel: "Limbă",
    comingSoon: "Vânzările publice nu sunt încă active. Poți explora experiența; plata se activează la lansare.",
    interests: "Interese sau dorințe",
    continueCheckout: "Continuă la plată",
    emailRequired: "Email pentru linkul privat",
    legalSummary: "Personaj AI · Supraveghere parentală · Fără telefonul copilului",
    processTitle: "Cum funcționează",
    process: [
      "Completezi câteva detalii despre copil (doar ce vrei să știe Moșul).",
      "Plătești în siguranță cu Stripe (prețul pieței alese).",
      "Primești pe email un link privat către apel.",
      "Copilul vorbește 3 minute; poți prelungi o singură dată cu încă 5 minute.",
    ],
    specialTitle: "Ce face experiența specială",
    special: [
      "Voce realistă în timp real, cu răspunsuri personalizate.",
      "Scenă cinematică de la Polul Nord pe tot ecranul telefonului.",
      "Detectare automată a limbii vorbite în timpul apelului.",
      "Un singur link privat, fără număr de telefon al copilului.",
    ],
    previewTitle: "Personalizare pentru părinte",
    previewBody: "Spui numele copilului, o dorință sau un hobby — Moșul le folosește natural în conversație.",
    visualTitle: "Polul Nord, pe ecranul tău",
    visualBody: "Un loop video muted, de înaltă calitate: Moșul, spiridușii și atmosfera atelierului.",
    pricingTitle: "Prețuri clare",
    pricingInitial: "Apel inițial — 3 minute",
    pricingExtension: "Prelungire opțională — +5 minute (o singură dată)",
    faqTitle: "Întrebări frecvente",
    faqs: [
      {
        q: "Moșul este o persoană reală?",
        a: "Nu. Moș Crăciun este un personaj AI. Experiența este magică, dar transparentă: copilul vorbește cu un personaj generat de inteligență artificială.",
      },
      {
        q: "Moșul sună pe telefonul copilului?",
        a: "Nu. Apelul rulează în browser (Safari/Chrome), pe linkul privat pe care îl primești pe email. Nu colectăm numărul de telefon al copilului.",
      },
      {
        q: "Ce limbi sunt suportate?",
        a: "Interfața este în română și engleză. În apel, limba vorbită poate fi detectată automat; părintele alege un fallback.",
      },
      {
        q: "Pot prelungi apelul?",
        a: "Da, o singură dată, cu încă 5 minute, printr-o plată separată după cele 3 minute inițiale.",
      },
    ],
    finalCtaTitle: "Gata de magie?",
    finalCtaBody: "Personalizează apelul și trimite copilului o amintire de neuitat.",
    exampleTitle: "Exemplu de conversație",
    example:
      "„Ho, ho, ho! Bună, Andrei! Ce bucurie să te aud! Spiridușii mi-au spus că îți plac dinozaurii. Este adevărat?”",
    duration: "Durată: 180 de secunde pe server. Prelungire: încă 300 de secunde, o singură dată.",
    tech: "Necesită microfon, conexiune stabilă și un browser modern (Safari iOS, Chrome Android, desktop).",
    parents: "Pentru părinți: copilul trebuie supravegheat. Nu colectăm adresă, școală sau telefonul copilului.",
    ai: "Moș Crăciun este un personaj AI. Nu promite livrarea cadourilor și nu este un apel telefonic clasic.",
    policy: "Un link = un apel inițial + maximum o prelungire. Accesul expiră în ~30 de zile.",
    privacyLink: "Confidențialitate",
    supportLink: "Suport",
    consent:
      "Confirm că sunt părintele sau tutorele legal, am citit informațiile despre AI și accept condițiile de utilizare.",
    formTitle: "Personalizare pentru părinte",
    name: "Numele copilului",
    language: "Limba preferată (fallback)",
    languageAuto: "Detectare automată în conversație (recomandat)",
    age: "Vârsta (opțional)",
    wish: "Cadoul dorit (opțional)",
    hobbies: "Hobby-uri și interese (opțional)",
    pet: "Nume animal de companie (opțional)",
    detail: "O realizare sau amintire frumoasă (opțional)",
    email: "Email pentru linkul privat",
    successNote: "Plata a fost înregistrată. Verifică emailul pentru linkul privat al apelului.",
    errorConsent: "Confirmarea parentală este obligatorie.",
    errorCheckoutDisabled: "Checkout-ul nu este încă activ pentru acest produs.",
    errorGeneric: "Verifică formularul și încearcă din nou.",
    upsellTitle: "Mai vorbești 5 minute cu Moșul?",
    upsellPrice: "Încă 5 minute magice",
    upsellContinue: "Continuă conversația",
    upsellEnd: "Încheie apelul",
    thankYouTitle: "Mulțumim pentru magie",
    thankYouBody: "Moșul a fost bucuros să vorbească. Crăciun fericit!",
    micDenied: "Permite accesul la microfon pentru a începe apelul.",
    connecting: "Se conectează…",
    listening: "Moșul te ascultă…",
    speaking: "Moșul vorbește…",
    timeLeft: "Timp rămas",
    timeBudgetOf: "Timp rămas din {total}",
    forChild: "Pentru {name}",
    startCall: "Începe apelul",
    endCall: "Încheie",
    endCallAria: "Încheie apelul",
    mic: "Microfon",
    speaker: "Difuzor",
    paymentConfirming: "Confirmăm plata…",
    concurrentDevice: "Apelul este deja activ pe alt dispozitiv.",
    linkExpired: "Linkul a expirat.",
    startFailed: "Nu am putut porni apelul. Încearcă din nou.",
    decorativeScene: "Scenă decorativă North Pole — nu este video live și nu are lip-sync.",
    muteMic: "Mute microfon",
    unmuteMic: "Activează microfonul",
    muteSpeaker: "Oprește difuzorul",
    unmuteSpeaker: "Pornește difuzorul",
    confirmEndYes: "Da, închide",
    confirmEndNo: "Continuă",
    backToProduct: "Înapoi la produs",
    roomTitle: "Apel cu Moș Crăciun",
    santaLabel: "Moș Crăciun",
    ogTitle: "Apel magic cu Moș Crăciun | The Digital Gifter",
    ogDescription:
      "Conversație personalizată cu Moș Crăciun AI — 3 minute în timp real, pe un link privat pentru copilul tău.",
  },
  en: {
    brand: "The Digital Gifter",
    kicker: "Christmas Collection",
    title: "Santa Wants to Talk to You!",
    subtitle: "Three magical realtime minutes — Santa knows their name and talks with your child.",
    priceHint: "$12.99",
    extensionHint: "Optional extension: +5 minutes · $9.99",
    cta: "Call Santa",
    ctaSticky: "Call Santa",
    trust: "Secure payment · No subscription · One private call",
    marketLabel: "Market / currency",
    langLabel: "Language",
    comingSoon: "Public sales are not active yet. You can explore the experience; checkout unlocks at launch.",
    interests: "Interests or wishes",
    continueCheckout: "Continue to checkout",
    emailRequired: "Email for the private link",
    legalSummary: "AI character · Adult supervision · No child’s phone number",
    processTitle: "How it works",
    process: [
      "Share a few details about your child (only what Santa should know).",
      "Pay securely with Stripe (your selected market price).",
      "Receive a private call link by email.",
      "Your child talks for 3 minutes; you may extend once with +5 minutes.",
    ],
    specialTitle: "What makes it special",
    special: [
      "Realtime voice with personalized responses.",
      "Fullscreen cinematic North Pole scene on mobile.",
      "Automatic detection of the spoken language during the call.",
      "One private link — we never collect your child's phone number.",
    ],
    previewTitle: "Parent personalization",
    previewBody: "Share a name, a wish, or a hobby — Santa weaves them naturally into the conversation.",
    visualTitle: "The North Pole on your screen",
    visualBody: "A high-quality muted video loop: Santa, elves, and the workshop atmosphere.",
    pricingTitle: "Clear pricing",
    pricingInitial: "Initial call — 3 minutes",
    pricingExtension: "Optional extension — +5 minutes (once)",
    faqTitle: "FAQ",
    faqs: [
      {
        q: "Is Santa a real person?",
        a: "No. Santa is an AI character. The experience is magical and transparent: your child talks with an AI-generated character.",
      },
      {
        q: "Does Santa dial my child's phone?",
        a: "No. The call runs in the browser (Safari/Chrome) via the private link emailed to you. We do not collect the child's phone number.",
      },
      {
        q: "Which languages are supported?",
        a: "The interface is Romanian and English. During the call, spoken language can be auto-detected; you choose a fallback.",
      },
      {
        q: "Can I extend the call?",
        a: "Yes — once — for 5 more minutes, with a separate payment after the initial 3 minutes.",
      },
    ],
    finalCtaTitle: "Ready for magic?",
    finalCtaBody: "Personalize the call and give your child an unforgettable moment.",
    exampleTitle: "Sample conversation",
    example:
      "“Ho, ho, ho! Hello, Andrei! What a joy to hear you! The elves told me you like dinosaurs. Is that true?”",
    duration: "Duration: 180 seconds server-enforced. Extension: +300 seconds, once per call.",
    tech: "Requires a microphone, stable connection, and a modern browser (Safari iOS, Chrome Android, desktop).",
    parents: "For parents: adult supervision required. We do not collect address, school, or the child’s phone number.",
    ai: "Santa is an AI character. He does not promise gift delivery and this is not a traditional phone call.",
    policy: "One link = one initial call + at most one extension. Access expires in ~30 days.",
    privacyLink: "Privacy",
    supportLink: "Support",
    consent:
      "I confirm I am the parent or legal guardian, I understand this is an AI experience, and I accept the terms of use.",
    formTitle: "Parent personalization",
    name: "Child’s first name",
    language: "Preferred language (fallback)",
    languageAuto: "Auto-detect language in conversation (recommended)",
    age: "Age (optional)",
    wish: "Christmas wish (optional)",
    hobbies: "Hobbies and interests (optional)",
    pet: "Pet name (optional)",
    detail: "A lovely achievement or memory (optional)",
    email: "Email for the private link",
    successNote: "Payment recorded. Check your email for the private call link.",
    errorConsent: "Parental confirmation is required.",
    errorCheckoutDisabled: "Checkout is not enabled for this product yet.",
    errorGeneric: "Please check the form and try again.",
    upsellTitle: "Talk with Santa 5 more minutes?",
    upsellPrice: "5 more magical minutes",
    upsellContinue: "Continue conversation",
    upsellEnd: "End the call",
    thankYouTitle: "Thank you for the magic",
    thankYouBody: "Santa was glad to talk. Merry Christmas!",
    micDenied: "Allow microphone access to start the call.",
    connecting: "Connecting…",
    listening: "Santa is listening…",
    speaking: "Santa is speaking…",
    timeLeft: "Time remaining",
    timeBudgetOf: "{total} remaining",
    forChild: "For {name}",
    startCall: "Start call",
    endCall: "End",
    endCallAria: "End call",
    mic: "Mic",
    speaker: "Speaker",
    paymentConfirming: "Confirming payment…",
    concurrentDevice: "This call is already active on another device.",
    linkExpired: "This link has expired.",
    startFailed: "Could not start the call. Please try again.",
    decorativeScene: "Decorative North Pole scene — not a live video call and no lip-sync.",
    muteMic: "Mute microphone",
    unmuteMic: "Unmute microphone",
    muteSpeaker: "Mute speaker",
    unmuteSpeaker: "Unmute speaker",
    confirmEndYes: "Yes, end",
    confirmEndNo: "Keep talking",
    backToProduct: "Back to product",
    roomTitle: "Call with Santa Claus",
    santaLabel: "Santa Claus",
    ogTitle: "A Magical Call with Santa | The Digital Gifter",
    ogDescription:
      "A personalized AI Santa voice call — 3 realtime minutes on a private link made just for your child.",
  },
} as const;
