/**
 * Christmas localized SEO content loader (P3B).
 */
import { getChristmasSeoContent as getRo } from "./ro.mjs";
import { getChristmasSeoContent as getDe } from "./de.mjs";
import { getChristmasSeoContent as getFr } from "./fr.mjs";
import { getChristmasSeoContent as getEs } from "./es.mjs";
import { getChristmasSeoContent as getIt } from "./it.mjs";
import { getChristmasSeoContent as getPt } from "./pt.mjs";
import { getChristmasSeoContent as getNl } from "./nl.mjs";
import { getChristmasSeoContent as getPl } from "./pl.mjs";

const LOADERS = {
  ro: getRo,
  de: getDe,
  fr: getFr,
  es: getEs,
  it: getIt,
  pt: getPt,
  nl: getNl,
  pl: getPl,
};

/**
 * Closeout routes added after the P3B packs. Keeping them here avoids eight
 * nearly-identical file edits while still giving crawlers genuinely localized
 * title/description/H1/lede content for every Wave 1 locale.
 */
const CLOSEOUT = {
  ro: {
    "/christmas/send-a-gift": {
      title: "Trimite un Cadou de Crăciun Online | TheDigitalGifter",
      description: "Creează un link privat de Crăciun cu mesaj personal și trimite o experiență digitală în câteva secunde.",
      h1: "Trimite Puțină Magie de Crăciun",
      lede: "Alege o experiență, adaugă un mesaj personal și trimite un singur link privat de Crăciun.",
    },
    "/christmas/kids": {
      title: "Portrete de Crăciun pentru Copii | TheDigitalGifter",
      description: "Creează un portret de Crăciun privacy-first pentru un copil sau frați, cu acordul părintelui sau tutorelui.",
      h1: "Creează un Portret Magic de Crăciun pentru Copilul Tău",
      lede: "Încarcă doar o fotografie pe care ai dreptul să o folosești și creează un portret privat, fără galerie publică.",
    },
  },
  de: {
    "/christmas/send-a-gift": {
      title: "Weihnachtsgeschenk Online Versenden | TheDigitalGifter",
      description: "Erstelle einen privaten Weihnachtslink mit persönlicher Nachricht und verschenke ein digitales Weihnachtserlebnis.",
      h1: "Verschenke ein Bisschen Weihnachtsmagie",
      lede: "Wähle ein Erlebnis, füge eine persönliche Nachricht hinzu und teile einen privaten Geschenklink.",
    },
    "/christmas/kids": {
      title: "Weihnachtsporträts für Kinder | TheDigitalGifter",
      description: "Erstelle mit Erlaubnis der Eltern oder Erziehungsberechtigten ein datenschutzorientiertes Weihnachtsporträt für Kinder.",
      h1: "Erstelle ein Magisches Weihnachtsporträt für Dein Kind",
      lede: "Nutze nur ein Foto, das du verwenden darfst, und erstelle ein privates Weihnachtsporträt ohne öffentliche Galerie.",
    },
  },
  fr: {
    "/christmas/send-a-gift": {
      title: "Envoyer un Cadeau de Noël en Ligne | TheDigitalGifter",
      description: "Créez un lien cadeau privé avec un message personnel et envoyez une expérience de Noël numérique.",
      h1: "Envoyez un Peu de Magie de Noël",
      lede: "Choisissez une expérience, ajoutez un message personnel et partagez un lien cadeau privé.",
    },
    "/christmas/kids": {
      title: "Portraits de Noël pour Enfants | TheDigitalGifter",
      description: "Créez un portrait de Noël axé sur la confidentialité avec l’autorisation d’un parent ou tuteur.",
      h1: "Créez un Portrait de Noël Magique pour Votre Enfant",
      lede: "Utilisez uniquement une photo autorisée et créez un portrait privé sans galerie publique.",
    },
  },
  es: {
    "/christmas/send-a-gift": {
      title: "Enviar un Regalo de Navidad Online | TheDigitalGifter",
      description: "Crea un enlace privado de Navidad con un mensaje personal y envía una experiencia digital en segundos.",
      h1: "Envía un Poco de Magia Navideña",
      lede: "Elige una experiencia, añade un mensaje personal y comparte un enlace de regalo privado.",
    },
    "/christmas/kids": {
      title: "Retratos de Navidad para Niños | TheDigitalGifter",
      description: "Crea un retrato navideño privado para un menor con permiso de su padre, madre o tutor.",
      h1: "Crea un Retrato Navideño Mágico para Tu Hijo",
      lede: "Usa solo una foto que tengas permiso para utilizar y crea un retrato privado sin galería pública.",
    },
  },
  it: {
    "/christmas/send-a-gift": {
      title: "Invia un Regalo di Natale Online | TheDigitalGifter",
      description: "Crea un link regalo privato con un messaggio personale e invia un’esperienza digitale di Natale.",
      h1: "Invia un Po’ di Magia Natalizia",
      lede: "Scegli un’esperienza, aggiungi un messaggio personale e condividi un link regalo privato.",
    },
    "/christmas/kids": {
      title: "Ritratti di Natale per Bambini | TheDigitalGifter",
      description: "Crea un ritratto natalizio privato per bambini con il consenso di un genitore o tutore.",
      h1: "Crea un Ritratto di Natale Magico per Tuo Figlio",
      lede: "Usa solo una foto che hai il permesso di utilizzare e crea un ritratto privato senza galleria pubblica.",
    },
  },
  pt: {
    "/christmas/send-a-gift": {
      title: "Enviar um Presente de Natal Online | TheDigitalGifter",
      description: "Crie um link privado de Natal com uma mensagem pessoal e envie uma experiência digital em segundos.",
      h1: "Envie um Pouco de Magia de Natal",
      lede: "Escolha uma experiência, adicione uma mensagem pessoal e partilhe um link de presente privado.",
    },
    "/christmas/kids": {
      title: "Retratos de Natal para Crianças | TheDigitalGifter",
      description: "Crie um retrato de Natal privado para crianças com autorização de um pai, mãe ou tutor.",
      h1: "Crie um Retrato de Natal Mágico para a Sua Criança",
      lede: "Use apenas uma fotografia que tenha autorização para utilizar e crie um retrato privado sem galeria pública.",
    },
  },
  nl: {
    "/christmas/send-a-gift": {
      title: "Online Kerstcadeau Versturen | TheDigitalGifter",
      description: "Maak een privé kerstcadeaulink met een persoonlijke boodschap en stuur een digitale kerstervaring.",
      h1: "Stuur een Beetje Kerstmagie",
      lede: "Kies een ervaring, voeg een persoonlijke boodschap toe en deel één privé cadeaulink.",
    },
    "/christmas/kids": {
      title: "Kerstportretten voor Kinderen | TheDigitalGifter",
      description: "Maak met toestemming van een ouder of voogd een privacy-first kerstportret voor kinderen.",
      h1: "Maak een Magisch Kerstportret voor Je Kind",
      lede: "Gebruik alleen een foto die je mag gebruiken en maak een privé kerstportret zonder openbare galerij.",
    },
  },
  pl: {
    "/christmas/send-a-gift": {
      title: "Wyślij Prezent Świąteczny Online | TheDigitalGifter",
      description: "Utwórz prywatny link prezentowy z osobistą wiadomością i wyślij cyfrowe doświadczenie świąteczne.",
      h1: "Wyślij Odrobinę Świątecznej Magii",
      lede: "Wybierz doświadczenie, dodaj osobistą wiadomość i udostępnij prywatny link prezentowy.",
    },
    "/christmas/kids": {
      title: "Portrety Świąteczne dla Dzieci | TheDigitalGifter",
      description: "Stwórz prywatny portret świąteczny dla dziecka za zgodą rodzica lub opiekuna.",
      h1: "Stwórz Magiczny Portret Świąteczny dla Swojego Dziecka",
      lede: "Używaj tylko zdjęcia, do którego masz prawo, i stwórz prywatny portret bez publicznej galerii.",
    },
  },
};

export const CHRISTMAS_SEO_CONTENT_LOCALES = Object.keys(LOADERS);

/**
 * @param {string} localeCode
 * @param {string} basePath English base path e.g. /christmas/cards
 */
export function getChristmasLocalizedSeoContent(localeCode, basePath) {
  const closeout = CLOSEOUT[localeCode]?.[basePath];
  if (closeout) return closeout;
  const loader = LOADERS[localeCode];
  if (!loader) return null;
  return loader(basePath) || null;
}

export {
  faqHeadingForLocale,
  homeLabelForLocale,
  localeHref,
  localizeLinks,
} from "./_helpers.mjs";
