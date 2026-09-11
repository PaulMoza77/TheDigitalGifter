/**
 * Christmas Club hub UI copy — Wave 1 locale packs (en, ro, de, fr, es, it, pt, nl, pl).
 * Soft Santa only where appropriate: this surface is countdown/join, not spoken Santa.
 * pt = European Portuguese (Portugal). Romanian uses full diacritics.
 */

export type ClubLocale = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";

export const CLUB_UI_LOCALES: ClubLocale[] = [
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

type Dict = Record<string, string>;

const EN: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter presents",
  "hero.h1": "Something magical is coming this Christmas.",
  "hero.lede": "Join our Christmas countdown and discover little surprises along the way.",
  "countdown.note": "A few gifts already waiting inside the countdown.",
  "join.srHeading": "Join the Christmas Countdown",
  "join.lede": "Be part of the magic. We’ll have little surprises waiting for you along the way.",
  "join.emailLabel": "Email",
  "join.emailPlaceholder": "Enter your email",
  "join.cta": "Join the Countdown",
  "join.ctaBusy": "Joining…",
  "join.or": "or",
  "join.google": "Continue with Google",
  "email.empty": "Please enter your email.",
  "email.invalid": "Please enter a valid email.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "You’re on the list.",
  "success.lede": "The countdown has begun.",
  "success.body": "We’ll have something special waiting for you as Christmas gets closer.",
  "success.whisper": "Come back tomorrow. You never know what might appear beneath the tree.",
  "countdown.days": "Days",
  "countdown.hours": "Hours",
  "countdown.minutes": "Minutes",
  "countdown.seconds": "Seconds",
  "countdown.merry": "Merry Christmas ✨",
  "countdown.ready": "Your Christmas surprise is ready.",
  "countdown.aria":
    "{days} days, {hours} hours, {minutes} minutes, {seconds} seconds until Christmas",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Could not join just now.",
  "error.googleSave": "Google sign-in finished, but we couldn’t save your place.",
  "error.save": "We couldn’t save your place just now.",
  "error.googleUnavailable":
    "Google sign-in isn’t available right now. You can still join with email.",
};

const RO: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter prezintă",
  "hero.h1": "Ceva magic vine de Crăciun.",
  "hero.lede": "Alătură-te numărătoarei noastre de Crăciun și descoperă mici surprize pe drum.",
  "countdown.note": "Câteva cadouri te așteaptă deja în numărătoare.",
  "join.srHeading": "Alătură-te Numărătoarei de Crăciun",
  "join.lede": "Fii parte din magie. Vom avea mici surprize pentru tine pe parcurs.",
  "join.emailLabel": "Email",
  "join.emailPlaceholder": "Introdu adresa de email",
  "join.cta": "Intră în Numărătoare",
  "join.ctaBusy": "Se înscrie…",
  "join.or": "sau",
  "join.google": "Continuă cu Google",
  "email.empty": "Te rugăm să introduci emailul.",
  "email.invalid": "Te rugăm să introduci un email valid.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Ești pe listă.",
  "success.lede": "Numărătoarea a început.",
  "success.body": "Vom avea ceva special pentru tine pe măsură ce se apropie Crăciunul.",
  "success.whisper": "Revino mâine. Nu se știe ce ar putea apărea sub brad.",
  "countdown.days": "Zile",
  "countdown.hours": "Ore",
  "countdown.minutes": "Minute",
  "countdown.seconds": "Secunde",
  "countdown.merry": "Crăciun fericit ✨",
  "countdown.ready": "Surpriza ta de Crăciun e gata.",
  "countdown.aria":
    "{days} zile, {hours} ore, {minutes} minute, {seconds} secunde până la Crăciun",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Nu te-am putut înscrie acum.",
  "error.googleSave": "Autentificarea Google a reușit, dar nu ți-am putut salva locul.",
  "error.save": "Nu ți-am putut salva locul acum.",
  "error.googleUnavailable":
    "Autentificarea Google nu e disponibilă acum. Poți totuși să te înscrii cu emailul.",
};

const DE: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter präsentiert",
  "hero.h1": "Dieses Weihnachten kommt etwas Magisches.",
  "hero.lede":
    "Mach mit bei unserem Weihnachts-Countdown und entdecke unterwegs kleine Überraschungen.",
  "countdown.note": "Im Countdown warten schon ein paar Geschenke.",
  "join.srHeading": "Mitmachen beim Weihnachts-Countdown",
  "join.lede": "Sei Teil der Magie. Unterwegs warten kleine Überraschungen auf dich.",
  "join.emailLabel": "E-Mail",
  "join.emailPlaceholder": "E-Mail-Adresse eingeben",
  "join.cta": "Am Countdown teilnehmen",
  "join.ctaBusy": "Wird beigetreten…",
  "join.or": "oder",
  "join.google": "Weiter mit Google",
  "email.empty": "Bitte gib deine E-Mail-Adresse ein.",
  "email.invalid": "Bitte gib eine gültige E-Mail-Adresse ein.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Du bist auf der Liste.",
  "success.lede": "Der Countdown hat begonnen.",
  "success.body": "Wenn Weihnachten näher kommt, wartet etwas Besonderes auf dich.",
  "success.whisper": "Komm morgen wieder. Man weiß nie, was unter dem Baum erscheint.",
  "countdown.days": "Tage",
  "countdown.hours": "Stunden",
  "countdown.minutes": "Minuten",
  "countdown.seconds": "Sekunden",
  "countdown.merry": "Frohe Weihnachten ✨",
  "countdown.ready": "Deine Weihnachtsüberraschung ist bereit.",
  "countdown.aria":
    "{days} Tage, {hours} Stunden, {minutes} Minuten, {seconds} Sekunden bis Weihnachten",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Beitritt gerade nicht möglich.",
  "error.googleSave":
    "Google-Anmeldung fertig, aber dein Platz konnte nicht gespeichert werden.",
  "error.save": "Dein Platz konnte gerade nicht gespeichert werden.",
  "error.googleUnavailable":
    "Google-Anmeldung ist gerade nicht verfügbar. Du kannst dich weiter per E-Mail anmelden.",
};

const FR: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter présente",
  "hero.h1": "Quelque chose de magique arrive pour Noël.",
  "hero.lede":
    "Rejoignez notre compte à rebours de Noël et découvrez de petites surprises en chemin.",
  "countdown.note": "Quelques cadeaux vous attendent déjà dans le compte à rebours.",
  "join.srHeading": "Rejoindre le compte à rebours de Noël",
  "join.lede": "Faites partie de la magie. De petites surprises vous attendront en chemin.",
  "join.emailLabel": "E-mail",
  "join.emailPlaceholder": "Entrez votre e-mail",
  "join.cta": "Rejoindre le compte à rebours",
  "join.ctaBusy": "Inscription…",
  "join.or": "ou",
  "join.google": "Continuer avec Google",
  "email.empty": "Veuillez entrer votre e-mail.",
  "email.invalid": "Veuillez entrer un e-mail valide.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Vous êtes sur la liste.",
  "success.lede": "Le compte à rebours a commencé.",
  "success.body": "Nous aurons quelque chose de spécial pour vous à l’approche de Noël.",
  "success.whisper":
    "Revenez demain. On ne sait jamais ce qui pourrait apparaître sous le sapin.",
  "countdown.days": "Jours",
  "countdown.hours": "Heures",
  "countdown.minutes": "Minutes",
  "countdown.seconds": "Secondes",
  "countdown.merry": "Joyeux Noël ✨",
  "countdown.ready": "Votre surprise de Noël est prête.",
  "countdown.aria":
    "{days} jours, {hours} heures, {minutes} minutes, {seconds} secondes avant Noël",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Impossible de vous inscrire pour le moment.",
  "error.googleSave":
    "La connexion Google a réussi, mais nous n’avons pas pu enregistrer votre place.",
  "error.save": "Nous n’avons pas pu enregistrer votre place pour le moment.",
  "error.googleUnavailable":
    "La connexion Google n’est pas disponible pour le moment. Vous pouvez toujours vous inscrire par e-mail.",
};

const ES: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter presenta",
  "hero.h1": "Algo mágico llega esta Navidad.",
  "hero.lede":
    "Únete a nuestra cuenta atrás de Navidad y descubre pequeñas sorpresas por el camino.",
  "countdown.note": "Ya hay unos cuantos regalos esperando en la cuenta atrás.",
  "join.srHeading": "Únete a la cuenta atrás de Navidad",
  "join.lede": "Sé parte de la magia. Tendremos pequeñas sorpresas esperándote por el camino.",
  "join.emailLabel": "Correo",
  "join.emailPlaceholder": "Introduce tu correo",
  "join.cta": "Unirme a la cuenta atrás",
  "join.ctaBusy": "Uniéndote…",
  "join.or": "o",
  "join.google": "Continuar con Google",
  "email.empty": "Introduce tu correo.",
  "email.invalid": "Introduce un correo válido.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Estás en la lista.",
  "success.lede": "La cuenta atrás ha comenzado.",
  "success.body": "Tendremos algo especial para ti a medida que se acerque la Navidad.",
  "success.whisper": "Vuelve mañana. Nunca se sabe qué puede aparecer bajo el árbol.",
  "countdown.days": "Días",
  "countdown.hours": "Horas",
  "countdown.minutes": "Minutos",
  "countdown.seconds": "Segundos",
  "countdown.merry": "Feliz Navidad ✨",
  "countdown.ready": "Tu sorpresa de Navidad está lista.",
  "countdown.aria":
    "{days} días, {hours} horas, {minutes} minutos, {seconds} segundos hasta Navidad",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "No hemos podido unirte ahora.",
  "error.googleSave":
    "El inicio de sesión con Google terminó, pero no pudimos guardar tu sitio.",
  "error.save": "No pudimos guardar tu sitio ahora.",
  "error.googleUnavailable":
    "El inicio de sesión con Google no está disponible ahora. Aún puedes unirte con el correo.",
};

const IT: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter presenta",
  "hero.h1": "Qualcosa di magico arriva questo Natale.",
  "hero.lede":
    "Unisciti al nostro conto alla rovescia di Natale e scopri piccole sorprese lungo il percorso.",
  "countdown.note": "Qualche regalo ti aspetta già nel conto alla rovescia.",
  "join.srHeading": "Unisciti al conto alla rovescia di Natale",
  "join.lede": "Fai parte della magia. Avremo piccole sorprese ad aspettarti lungo il percorso.",
  "join.emailLabel": "Email",
  "join.emailPlaceholder": "Inserisci la tua email",
  "join.cta": "Unisciti al conto alla rovescia",
  "join.ctaBusy": "Iscrizione…",
  "join.or": "oppure",
  "join.google": "Continua con Google",
  "email.empty": "Inserisci la tua email.",
  "email.invalid": "Inserisci un’email valida.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Sei in lista.",
  "success.lede": "Il conto alla rovescia è iniziato.",
  "success.body": "Avremo qualcosa di speciale per te man mano che si avvicina il Natale.",
  "success.whisper": "Torna domani. Non si sa mai cosa possa apparire sotto l’albero.",
  "countdown.days": "Giorni",
  "countdown.hours": "Ore",
  "countdown.minutes": "Minuti",
  "countdown.seconds": "Secondi",
  "countdown.merry": "Buon Natale ✨",
  "countdown.ready": "La tua sorpresa di Natale è pronta.",
  "countdown.aria":
    "{days} giorni, {hours} ore, {minutes} minuti, {seconds} secondi a Natale",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Non è stato possibile iscriverti adesso.",
  "error.googleSave":
    "Accesso Google completato, ma non siamo riusciti a salvare il tuo posto.",
  "error.save": "Non siamo riusciti a salvare il tuo posto adesso.",
  "error.googleUnavailable":
    "L’accesso Google non è disponibile in questo momento. Puoi comunque iscriverti con l’email.",
};

const PT: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter apresenta",
  "hero.h1": "Algo mágico está a chegar neste Natal.",
  "hero.lede":
    "Junte-se à nossa contagem decrescente de Natal e descubra pequenas surpresas pelo caminho.",
  "countdown.note": "Já há alguns presentes à espera na contagem decrescente.",
  "join.srHeading": "Junte-se à contagem decrescente de Natal",
  "join.lede": "Faça parte da magia. Teremos pequenas surpresas à sua espera pelo caminho.",
  "join.emailLabel": "E-mail",
  "join.emailPlaceholder": "Introduza o seu e-mail",
  "join.cta": "Entrar na contagem",
  "join.ctaBusy": "A juntar…",
  "join.or": "ou",
  "join.google": "Continuar com o Google",
  "email.empty": "Introduza o seu e-mail.",
  "email.invalid": "Introduza um e-mail válido.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Está na lista.",
  "success.lede": "A contagem decrescente começou.",
  "success.body": "Teremos algo especial para si à medida que o Natal se aproxima.",
  "success.whisper": "Volte amanhã. Nunca se sabe o que pode aparecer debaixo da árvore.",
  "countdown.days": "Dias",
  "countdown.hours": "Horas",
  "countdown.minutes": "Minutos",
  "countdown.seconds": "Segundos",
  "countdown.merry": "Feliz Natal ✨",
  "countdown.ready": "A sua surpresa de Natal está pronta.",
  "countdown.aria":
    "{days} dias, {hours} horas, {minutes} minutos, {seconds} segundos até ao Natal",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Não foi possível juntá-lo agora.",
  "error.googleSave":
    "O início de sessão com o Google terminou, mas não conseguimos guardar o seu lugar.",
  "error.save": "Não conseguimos guardar o seu lugar agora.",
  "error.googleUnavailable":
    "O início de sessão com o Google não está disponível neste momento. Ainda pode juntar-se com o e-mail.",
};

const NL: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter presenteert",
  "hero.h1": "Er komt iets magisch aan dit kerstfeest.",
  "hero.lede":
    "Doe mee met onze kerstaftelling en ontdek onderweg kleine verrassingen.",
  "countdown.note": "Er wachten al een paar cadeaus in de aftelling.",
  "join.srHeading": "Doe mee met de kerstaftelling",
  "join.lede": "Maak deel uit van de magie. Onderweg wachten kleine verrassingen op je.",
  "join.emailLabel": "E-mail",
  "join.emailPlaceholder": "Voer je e-mailadres in",
  "join.cta": "Meedoen met de aftelling",
  "join.ctaBusy": "Bezig met aanmelden…",
  "join.or": "of",
  "join.google": "Doorgaan met Google",
  "email.empty": "Voer je e-mailadres in.",
  "email.invalid": "Voer een geldig e-mailadres in.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Je staat op de lijst.",
  "success.lede": "De aftelling is begonnen.",
  "success.body": "We hebben iets bijzonders voor je klaarstaan naarmate Kerst dichterbij komt.",
  "success.whisper": "Kom morgen terug. Je weet nooit wat er onder de boom verschijnt.",
  "countdown.days": "Dagen",
  "countdown.hours": "Uren",
  "countdown.minutes": "Minuten",
  "countdown.seconds": "Seconden",
  "countdown.merry": "Vrolijk kerstfeest ✨",
  "countdown.ready": "Je kerstverrassing is klaar.",
  "countdown.aria":
    "{days} dagen, {hours} uur, {minutes} minuten, {seconds} seconden tot Kerst",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Meedoen lukte net niet.",
  "error.googleSave":
    "Google-aanmelding is gelukt, maar we konden je plek niet opslaan.",
  "error.save": "We konden je plek net niet opslaan.",
  "error.googleUnavailable":
    "Google-aanmelding is nu niet beschikbaar. Je kunt nog steeds meedoen met e-mail.",
};

const PL: Dict = {
  "brand": "The Digital Gifter",
  "hero.eyebrow": "The Digital Gifter przedstawia",
  "hero.h1": "Na te święta nadchodzi coś magicznego.",
  "hero.lede":
    "Dołącz do naszej świątecznej odliczanki i odkrywaj małe niespodzianki po drodze.",
  "countdown.note": "Kilka prezentów już czeka w odliczaniu.",
  "join.srHeading": "Dołącz do świątecznej odliczanki",
  "join.lede": "Bądź częścią magii. Po drodze będą na ciebie czekać małe niespodzianki.",
  "join.emailLabel": "E-mail",
  "join.emailPlaceholder": "Wpisz swój e-mail",
  "join.cta": "Dołącz do odliczania",
  "join.ctaBusy": "Dołączanie…",
  "join.or": "lub",
  "join.google": "Kontynuuj z Google",
  "email.empty": "Podaj swój e-mail.",
  "email.invalid": "Podaj prawidłowy e-mail.",
  "success.eyebrow": "The Digital Gifter",
  "success.h2": "Jesteś na liście.",
  "success.lede": "Odliczanie się zaczęło.",
  "success.body": "Przygotujemy coś wyjątkowego, gdy zbliży się Boże Narodzenie.",
  "success.whisper": "Wróć jutro. Nigdy nie wiadomo, co pojawi się pod choinką.",
  "countdown.days": "Dni",
  "countdown.hours": "Godziny",
  "countdown.minutes": "Minuty",
  "countdown.seconds": "Sekundy",
  "countdown.merry": "Wesołych Świąt ✨",
  "countdown.ready": "Twoja świąteczna niespodzianka jest gotowa.",
  "countdown.aria":
    "{days} dni, {hours} godzin, {minutes} minut, {seconds} sekund do świąt",
  "countdown.unitAria": "{value} {label} · {product}",
  "error.join": "Nie udało się dołączyć w tej chwili.",
  "error.googleSave":
    "Logowanie Google się udało, ale nie udało się zapisać Twojego miejsca.",
  "error.save": "Nie udało się zapisać Twojego miejsca w tej chwili.",
  "error.googleUnavailable":
    "Logowanie Google jest teraz niedostępne. Nadal możesz dołączyć przez e-mail.",
};

export const PACKS: Record<ClubLocale, Dict> = {
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

/** Club hub UI keys that must be localized for Wave 1 (P3D coverage). */
export const REQUIRED_UI_KEYS = [
  "hero.eyebrow",
  "hero.h1",
  "hero.lede",
  "countdown.note",
  "join.lede",
  "join.emailPlaceholder",
  "join.cta",
  "join.google",
  "join.or",
  "success.h2",
  "success.lede",
  "countdown.days",
  "countdown.merry",
  "email.empty",
  "email.invalid",
] as const;

const _enKeySet = Object.keys(PACKS.en).sort().join("\0");
for (const loc of CLUB_UI_LOCALES) {
  const keys = Object.keys(PACKS[loc]);
  if (keys.length !== Object.keys(PACKS.en).length || keys.sort().join("\0") !== _enKeySet) {
    throw new Error(`Christmas club UI pack key mismatch for locale: ${loc}`);
  }
}

export function clubT(
  key: string,
  locale: ClubLocale = "en",
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

export function resolveClubLocale(value: unknown): ClubLocale {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-");
  if (raw === "pt-pt" || raw === "pt_pt" || raw.startsWith("pt-")) return "pt";
  const code = raw.split("-")[0];
  if ((CLUB_UI_LOCALES as readonly string[]).includes(code)) {
    return code as ClubLocale;
  }
  return "en";
}
