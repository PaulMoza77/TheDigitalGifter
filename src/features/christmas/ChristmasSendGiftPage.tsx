import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "./analytics";
import {
  christmasPathForLocale,
  parseChristmasLocalePath,
  type ChristmasLocaleCode,
} from "./seo/localeRouting";
import { normalizeWave1GenerationLocale } from "./i18n/wave1Locale";
import { AmbientSnow } from "./landing/AmbientSnow";
import "./landing/ChristmasLanding.css";

const SITE_ORIGIN = "https://www.thedigitalgifter.com";
const BASE_PATH = "/christmas/send-a-gift";

type Locale = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";
type GiftKey = "tree" | "portrait" | "santa" | "card";

type Copy = {
  title: string;
  description: string;
  kicker: string;
  h1: string;
  lede: string;
  recipient: string;
  sender: string;
  message: string;
  messageHint: string;
  choose: string;
  create: string;
  privacy: string;
  preview: string;
  share: string;
  copy: string;
  copied: string;
  another: string;
  openGift: string;
  from: string;
  for: string;
  noMessage: string;
  tree: string;
  treeBody: string;
  portrait: string;
  portraitBody: string;
  santa: string;
  santaBody: string;
  card: string;
  cardBody: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    title: "Send a Christmas Gift Online | TheDigitalGifter",
    description: "Create a private Christmas gift link with a personal message and send a digital Christmas experience in seconds.",
    kicker: "Send a Christmas gift",
    h1: "Send a little Christmas magic.",
    lede: "Choose an experience, add a personal message, and share one private gift link. The message stays in the link fragment and is not stored on our servers.",
    recipient: "Recipient name",
    sender: "Your name (optional)",
    message: "Your Christmas message",
    messageHint: "Keep it warm and simple — up to 280 characters.",
    choose: "Choose the gift experience",
    create: "Create gift link",
    privacy: "Privacy-first: recipient and message are kept in the URL fragment, which is not sent to our server. Any paid creation continues through the existing secure checkout.",
    preview: "Gift preview",
    share: "Share gift",
    copy: "Copy gift link",
    copied: "Copied",
    another: "Create another gift",
    openGift: "Open my Christmas gift",
    from: "From",
    for: "For",
    noMessage: "A Christmas surprise is waiting for you.",
    tree: "Open a Christmas Gift",
    treeBody: "Let them pick a present under the interactive Christmas tree.",
    portrait: "Christmas Portrait",
    portraitBody: "Turn a favorite photo into a magical Christmas portrait.",
    santa: "Personalized Santa Video",
    santaBody: "Create a private Santa message made for someone special.",
    card: "Christmas Card",
    cardBody: "Create and share a personalized digital Christmas card.",
  },
  ro: {
    title: "Trimite un Cadou de Crăciun Online | TheDigitalGifter",
    description: "Creează un link privat de Crăciun cu mesaj personal și trimite o experiență digitală în câteva secunde.",
    kicker: "Trimite un cadou de Crăciun",
    h1: "Trimite puțină magie de Crăciun.",
    lede: "Alege experiența, adaugă un mesaj și trimite un singur link privat. Mesajul rămâne în fragmentul linkului și nu este stocat pe serverele noastre.",
    recipient: "Numele destinatarului",
    sender: "Numele tău (opțional)",
    message: "Mesajul tău de Crăciun",
    messageHint: "Simplu și personal — maximum 280 de caractere.",
    choose: "Alege experiența cadou",
    create: "Creează linkul cadou",
    privacy: "Privacy-first: numele și mesajul rămân în fragmentul URL, care nu este trimis serverului. Orice produs plătit continuă prin checkout-ul securizat existent.",
    preview: "Previzualizare cadou",
    share: "Trimite cadoul",
    copy: "Copiază linkul",
    copied: "Copiat",
    another: "Creează alt cadou",
    openGift: "Deschide cadoul meu de Crăciun",
    from: "De la",
    for: "Pentru",
    noMessage: "Te așteaptă o surpriză de Crăciun.",
    tree: "Deschide un Cadou de Crăciun",
    treeBody: "Lasă-l să aleagă un cadou de sub bradul interactiv.",
    portrait: "Portret de Crăciun",
    portraitBody: "Transformă o fotografie preferată într-un portret magic de Crăciun.",
    santa: "Video Personalizat de la Moș Crăciun",
    santaBody: "Creează un mesaj privat de la Moș Crăciun pentru cineva special.",
    card: "Felicitare de Crăciun",
    cardBody: "Creează și trimite o felicitare digitală personalizată.",
  },
  de: {
    title: "Weihnachtsgeschenk Online Versenden | TheDigitalGifter",
    description: "Erstelle einen privaten Weihnachtslink mit persönlicher Nachricht und verschenke ein digitales Weihnachtserlebnis.",
    kicker: "Weihnachtsgeschenk senden",
    h1: "Verschenke ein bisschen Weihnachtsmagie.",
    lede: "Wähle ein Erlebnis, füge eine persönliche Nachricht hinzu und teile einen privaten Geschenklink.",
    recipient: "Name des Empfängers",
    sender: "Dein Name (optional)",
    message: "Deine Weihnachtsnachricht",
    messageHint: "Persönlich und kurz — maximal 280 Zeichen.",
    choose: "Geschenkerlebnis wählen",
    create: "Geschenklink erstellen",
    privacy: "Datenschutz: Name und Nachricht bleiben im URL-Fragment und werden nicht an unseren Server gesendet. Bezahlte Produkte nutzen den bestehenden sicheren Checkout.",
    preview: "Geschenkvorschau",
    share: "Geschenk teilen",
    copy: "Geschenklink kopieren",
    copied: "Kopiert",
    another: "Weiteres Geschenk erstellen",
    openGift: "Mein Weihnachtsgeschenk öffnen",
    from: "Von",
    for: "Für",
    noMessage: "Eine Weihnachtsüberraschung wartet auf dich.",
    tree: "Weihnachtsgeschenk öffnen",
    treeBody: "Lass sie ein Geschenk unter dem interaktiven Weihnachtsbaum wählen.",
    portrait: "Weihnachtsporträt",
    portraitBody: "Verwandle ein Lieblingsfoto in ein magisches Weihnachtsporträt.",
    santa: "Personalisierte Santa-Nachricht",
    santaBody: "Erstelle eine private Santa-Videobotschaft für einen besonderen Menschen.",
    card: "Weihnachtskarte",
    cardBody: "Erstelle und teile eine personalisierte digitale Weihnachtskarte.",
  },
  fr: {
    title: "Envoyer un Cadeau de Noël en Ligne | TheDigitalGifter",
    description: "Créez un lien cadeau privé avec un message personnel et envoyez une expérience de Noël numérique.",
    kicker: "Envoyer un cadeau de Noël",
    h1: "Envoyez un peu de magie de Noël.",
    lede: "Choisissez une expérience, ajoutez un message personnel et partagez un lien cadeau privé.",
    recipient: "Nom du destinataire",
    sender: "Votre nom (facultatif)",
    message: "Votre message de Noël",
    messageHint: "Simple et personnel — 280 caractères maximum.",
    choose: "Choisissez l’expérience cadeau",
    create: "Créer le lien cadeau",
    privacy: "Confidentialité : le nom et le message restent dans le fragment de l’URL et ne sont pas envoyés à notre serveur. Les créations payantes utilisent le paiement sécurisé existant.",
    preview: "Aperçu du cadeau",
    share: "Partager le cadeau",
    copy: "Copier le lien",
    copied: "Copié",
    another: "Créer un autre cadeau",
    openGift: "Ouvrir mon cadeau de Noël",
    from: "De",
    for: "Pour",
    noMessage: "Une surprise de Noël vous attend.",
    tree: "Ouvrir un Cadeau de Noël",
    treeBody: "Laissez la personne choisir un cadeau sous le sapin interactif.",
    portrait: "Portrait de Noël",
    portraitBody: "Transformez une photo préférée en portrait de Noël magique.",
    santa: "Vidéo du Père Noël Personnalisée",
    santaBody: "Créez un message vidéo privé du Père Noël pour quelqu’un de spécial.",
    card: "Carte de Noël",
    cardBody: "Créez et partagez une carte de Noël numérique personnalisée.",
  },
  es: {
    title: "Enviar un Regalo de Navidad Online | TheDigitalGifter",
    description: "Crea un enlace privado de Navidad con un mensaje personal y envía una experiencia digital en segundos.",
    kicker: "Enviar un regalo de Navidad",
    h1: "Envía un poco de magia navideña.",
    lede: "Elige una experiencia, añade un mensaje personal y comparte un enlace privado.",
    recipient: "Nombre del destinatario",
    sender: "Tu nombre (opcional)",
    message: "Tu mensaje de Navidad",
    messageHint: "Personal y sencillo — máximo 280 caracteres.",
    choose: "Elige la experiencia regalo",
    create: "Crear enlace de regalo",
    privacy: "Privacidad: el nombre y el mensaje permanecen en el fragmento de la URL y no se envían a nuestro servidor. Los productos de pago usan el checkout seguro existente.",
    preview: "Vista previa del regalo",
    share: "Compartir regalo",
    copy: "Copiar enlace",
    copied: "Copiado",
    another: "Crear otro regalo",
    openGift: "Abrir mi regalo de Navidad",
    from: "De",
    for: "Para",
    noMessage: "Te espera una sorpresa de Navidad.",
    tree: "Abrir un Regalo de Navidad",
    treeBody: "Deja que elija un regalo bajo el árbol interactivo.",
    portrait: "Retrato de Navidad",
    portraitBody: "Convierte una foto favorita en un retrato navideño mágico.",
    santa: "Video Personalizado de Santa",
    santaBody: "Crea un mensaje privado de Santa para alguien especial.",
    card: "Tarjeta de Navidad",
    cardBody: "Crea y comparte una tarjeta navideña digital personalizada.",
  },
  it: {
    title: "Invia un Regalo di Natale Online | TheDigitalGifter",
    description: "Crea un link regalo privato con un messaggio personale e invia un’esperienza digitale di Natale.",
    kicker: "Invia un regalo di Natale",
    h1: "Invia un po’ di magia natalizia.",
    lede: "Scegli un’esperienza, aggiungi un messaggio personale e condividi un link regalo privato.",
    recipient: "Nome del destinatario",
    sender: "Il tuo nome (opzionale)",
    message: "Il tuo messaggio di Natale",
    messageHint: "Semplice e personale — massimo 280 caratteri.",
    choose: "Scegli l’esperienza regalo",
    create: "Crea link regalo",
    privacy: "Privacy: nome e messaggio restano nel frammento dell’URL e non vengono inviati al server. I prodotti a pagamento usano il checkout sicuro esistente.",
    preview: "Anteprima regalo",
    share: "Condividi regalo",
    copy: "Copia link regalo",
    copied: "Copiato",
    another: "Crea un altro regalo",
    openGift: "Apri il mio regalo di Natale",
    from: "Da",
    for: "Per",
    noMessage: "Ti aspetta una sorpresa di Natale.",
    tree: "Apri un Regalo di Natale",
    treeBody: "Lascia scegliere un regalo sotto l’albero interattivo.",
    portrait: "Ritratto di Natale",
    portraitBody: "Trasforma una foto preferita in un magico ritratto di Natale.",
    santa: "Video Personalizzato di Babbo Natale",
    santaBody: "Crea un messaggio video privato di Babbo Natale per una persona speciale.",
    card: "Cartolina di Natale",
    cardBody: "Crea e condividi una cartolina digitale personalizzata.",
  },
  pt: {
    title: "Enviar um Presente de Natal Online | TheDigitalGifter",
    description: "Crie um link privado de Natal com uma mensagem pessoal e envie uma experiência digital em segundos.",
    kicker: "Enviar um presente de Natal",
    h1: "Envie um pouco de magia de Natal.",
    lede: "Escolha uma experiência, adicione uma mensagem pessoal e partilhe um link privado.",
    recipient: "Nome do destinatário",
    sender: "O seu nome (opcional)",
    message: "A sua mensagem de Natal",
    messageHint: "Pessoal e simples — máximo 280 caracteres.",
    choose: "Escolha a experiência presente",
    create: "Criar link de presente",
    privacy: "Privacidade: o nome e a mensagem ficam no fragmento do URL e não são enviados ao servidor. Produtos pagos usam o checkout seguro existente.",
    preview: "Pré-visualização do presente",
    share: "Partilhar presente",
    copy: "Copiar link",
    copied: "Copiado",
    another: "Criar outro presente",
    openGift: "Abrir o meu presente de Natal",
    from: "De",
    for: "Para",
    noMessage: "Uma surpresa de Natal está à sua espera.",
    tree: "Abrir um Presente de Natal",
    treeBody: "Deixe a pessoa escolher um presente debaixo da árvore interativa.",
    portrait: "Retrato de Natal",
    portraitBody: "Transforme uma fotografia favorita num retrato mágico de Natal.",
    santa: "Vídeo Personalizado do Pai Natal",
    santaBody: "Crie uma mensagem privada do Pai Natal para alguém especial.",
    card: "Cartão de Natal",
    cardBody: "Crie e partilhe um cartão digital de Natal personalizado.",
  },
  nl: {
    title: "Online Kerstcadeau Versturen | TheDigitalGifter",
    description: "Maak een privé kerstcadeaulink met een persoonlijke boodschap en stuur een digitale kerstervaring.",
    kicker: "Stuur een kerstcadeau",
    h1: "Stuur een beetje kerstmagie.",
    lede: "Kies een ervaring, voeg een persoonlijke boodschap toe en deel één privé cadeaulink.",
    recipient: "Naam van ontvanger",
    sender: "Jouw naam (optioneel)",
    message: "Jouw kerstboodschap",
    messageHint: "Persoonlijk en kort — maximaal 280 tekens.",
    choose: "Kies de cadeau-ervaring",
    create: "Cadeaulink maken",
    privacy: "Privacy: naam en boodschap blijven in het URL-fragment en worden niet naar onze server gestuurd. Betaalde producten gebruiken de bestaande veilige checkout.",
    preview: "Cadeauvoorbeeld",
    share: "Cadeau delen",
    copy: "Cadeaulink kopiëren",
    copied: "Gekopieerd",
    another: "Nog een cadeau maken",
    openGift: "Mijn kerstcadeau openen",
    from: "Van",
    for: "Voor",
    noMessage: "Er wacht een kerstverrassing op je.",
    tree: "Open een Kerstcadeau",
    treeBody: "Laat iemand een cadeau kiezen onder de interactieve kerstboom.",
    portrait: "Kerstportret",
    portraitBody: "Verander een favoriete foto in een magisch kerstportret.",
    santa: "Gepersonaliseerde Kerstmanvideo",
    santaBody: "Maak een privé videoboodschap van de Kerstman voor iemand speciaal.",
    card: "Kerstkaart",
    cardBody: "Maak en deel een gepersonaliseerde digitale kerstkaart.",
  },
  pl: {
    title: "Wyślij Prezent Świąteczny Online | TheDigitalGifter",
    description: "Utwórz prywatny link prezentowy z osobistą wiadomością i wyślij cyfrowe doświadczenie świąteczne.",
    kicker: "Wyślij prezent świąteczny",
    h1: "Wyślij odrobinę świątecznej magii.",
    lede: "Wybierz doświadczenie, dodaj osobistą wiadomość i udostępnij prywatny link prezentowy.",
    recipient: "Imię odbiorcy",
    sender: "Twoje imię (opcjonalnie)",
    message: "Twoja wiadomość świąteczna",
    messageHint: "Osobiście i krótko — maksymalnie 280 znaków.",
    choose: "Wybierz doświadczenie prezentowe",
    create: "Utwórz link prezentowy",
    privacy: "Prywatność: imię i wiadomość pozostają we fragmencie URL i nie są wysyłane na nasz serwer. Płatne produkty korzystają z istniejącego bezpiecznego checkoutu.",
    preview: "Podgląd prezentu",
    share: "Udostępnij prezent",
    copy: "Kopiuj link",
    copied: "Skopiowano",
    another: "Utwórz kolejny prezent",
    openGift: "Otwórz mój prezent świąteczny",
    from: "Od",
    for: "Dla",
    noMessage: "Czeka na Ciebie świąteczna niespodzianka.",
    tree: "Otwórz Prezent Świąteczny",
    treeBody: "Pozwól wybrać prezent spod interaktywnej choinki.",
    portrait: "Portret Świąteczny",
    portraitBody: "Zmień ulubione zdjęcie w magiczny portret świąteczny.",
    santa: "Spersonalizowane Wideo od Mikołaja",
    santaBody: "Utwórz prywatną wiadomość wideo od Mikołaja dla wyjątkowej osoby.",
    card: "Kartka Świąteczna",
    cardBody: "Utwórz i udostępnij spersonalizowaną cyfrową kartkę świąteczną.",
  },
};

const GIFT_OPTIONS: Array<{ key: GiftKey; path: string }> = [
  { key: "tree", path: "/christmas/tree-gifts" },
  { key: "portrait", path: "/christmas/photo-generator" },
  { key: "santa", path: "/christmas/santa-video" },
  { key: "card", path: "/christmas/cards" },
];

function clamp(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function readGiftFragment(): { gift: GiftKey; to: string; from: string; message: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (params.get("gift") !== "1") return null;
  const gift = params.get("type") as GiftKey | null;
  if (!GIFT_OPTIONS.some((option) => option.key === gift)) return null;
  return {
    gift,
    to: clamp(params.get("to") || "", 60),
    from: clamp(params.get("from") || "", 60),
    message: clamp(params.get("message") || "", 280),
  };
}

export default function ChristmasSendGiftPage() {
  const { pathname } = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(pathname).locale,
  ) as Locale;
  const copy = COPY[locale] || COPY.en;
  const pathFor = (path: string) =>
    christmasPathForLocale(path, locale as ChristmasLocaleCode);
  const incoming = useMemo(() => readGiftFragment(), [pathname]);
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [gift, setGift] = useState<GiftKey>("tree");
  const [giftUrl, setGiftUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void trackChristmasEvent("christmas_page_view", {
      productKey: "christmas_send_gift",
      pathname: BASE_PATH,
      locale,
      metadata: { mode: incoming ? "recipient" : "creator" },
    });
  }, [incoming, locale]);

  const giftOption = GIFT_OPTIONS.find((option) => option.key === (incoming?.gift || gift))!;
  const giftTitle = copy[giftOption.key] as string;
  const giftBody = copy[`${giftOption.key}Body` as keyof Copy] as string;

  function buildGiftLink() {
    const cleanRecipient = clamp(recipient, 60);
    if (!cleanRecipient) return;
    const cleanSender = clamp(sender, 60);
    const cleanMessage = clamp(message, 280);
    const params = new URLSearchParams({
      gift: "1",
      type: gift,
      to: cleanRecipient,
      from: cleanSender,
      message: cleanMessage,
    });
    const localizedPath = pathFor(BASE_PATH);
    const next = `${window.location.origin}${localizedPath}#${params.toString()}`;
    setGiftUrl(next);
    setCopied(false);
    void trackChristmasEvent("personalization_completed", {
      productKey: "christmas_send_gift",
      pathname: BASE_PATH,
      locale,
      metadata: {
        gift_type: gift,
        has_sender: Boolean(cleanSender),
        has_message: Boolean(cleanMessage),
      },
    });
  }

  async function shareGift() {
    if (!giftUrl) return;
    void trackChristmasEvent("share", {
      productKey: "christmas_send_gift",
      pathname: BASE_PATH,
      locale,
      metadata: { gift_type: gift },
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: copy.h1, text: message || copy.noMessage, url: giftUrl });
        return;
      } catch {
        // Fall back to clipboard below.
      }
    }
    await navigator.clipboard.writeText(giftUrl);
    setCopied(true);
  }

  async function copyGift() {
    if (!giftUrl) return;
    await navigator.clipboard.writeText(giftUrl);
    setCopied(true);
  }

  if (incoming) {
    return (
      <main className="xmas-landing" lang={locale}>
        <PageHead
          title={copy.title}
          description={copy.description}
          url={`${SITE_ORIGIN}${pathFor(BASE_PATH)}`}
          exactTitle
          noindex
        />
        <AmbientSnow />
        <section className="xmas-section" style={{ minHeight: "72vh", display: "grid", placeItems: "center", paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div className="xmas-card" style={{ maxWidth: 720, width: "100%", textAlign: "center", padding: "clamp(1.5rem, 4vw, 3rem)" }}>
            <p className="xmas-kicker">🎁 {copy.kicker}</p>
            <p className="xmas-lede" style={{ marginTop: "1rem" }}>{copy.for}: <strong>{incoming.to}</strong></p>
            <h1 style={{ fontSize: "clamp(2.2rem, 7vw, 4.6rem)", lineHeight: 0.98, margin: "1rem 0", color: "#fffaf1" }}>{giftTitle}</h1>
            <p className="xmas-lede" style={{ fontSize: "1.05rem" }}>{incoming.message || copy.noMessage}</p>
            {incoming.from ? <p className="xmas-lede" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>{copy.from}: <strong>{incoming.from}</strong></p> : null}
            <p className="xmas-lede" style={{ marginTop: "1.4rem", fontSize: "0.9rem" }}>{giftBody}</p>
            <Link
              className="xmas-btn xmas-btn--gold"
              to={pathFor(giftOption.path)}
              style={{ display: "inline-flex", marginTop: "1.5rem", textAlign: "center" }}
              onClick={() => void trackChristmasEvent("product_selected", {
                productKey: "christmas_send_gift",
                pathname: BASE_PATH,
                locale,
                metadata: { gift_type: incoming.gift, recipient_open: true },
              })}
            >
              {copy.openGift}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="xmas-landing" lang={locale}>
      <PageHead
        title={copy.title}
        description={copy.description}
        url={`${SITE_ORIGIN}${pathFor(BASE_PATH)}`}
        exactTitle
      />
      <AmbientSnow />
      <section className="xmas-section" style={{ paddingTop: "4rem", paddingBottom: "5rem" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <p className="xmas-kicker">🎁 {copy.kicker}</p>
          <h1 style={{ fontSize: "clamp(2.3rem, 7vw, 5rem)", lineHeight: 0.98, margin: "0.75rem 0 1rem", color: "#fffaf1" }}>{copy.h1}</h1>
          <p className="xmas-lede" style={{ maxWidth: 760 }}>{copy.lede}</p>

          <div className="xmas-card" style={{ marginTop: "2rem", padding: "clamp(1rem, 3vw, 2rem)" }}>
            <h2 style={{ color: "#fffaf1", fontSize: "1.25rem" }}>{copy.choose}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
              {GIFT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={gift === option.key ? "xmas-btn xmas-btn--gold" : "xmas-btn xmas-btn--ghost"}
                  style={{ textAlign: "left", minHeight: 92 }}
                  onClick={() => setGift(option.key)}
                >
                  <strong style={{ display: "block" }}>{copy[option.key]}</strong>
                  <span style={{ display: "block", marginTop: 5, fontSize: "0.78rem", opacity: 0.82 }}>{copy[`${option.key}Body` as keyof Copy]}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: "0.9rem", marginTop: "1.4rem" }}>
              <label>
                <span style={{ display: "block", marginBottom: 6 }}>{copy.recipient}</span>
                <input className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white" value={recipient} maxLength={60} onChange={(event) => setRecipient(event.target.value)} />
              </label>
              <label>
                <span style={{ display: "block", marginBottom: 6 }}>{copy.sender}</span>
                <input className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white" value={sender} maxLength={60} onChange={(event) => setSender(event.target.value)} />
              </label>
              <label>
                <span style={{ display: "block", marginBottom: 6 }}>{copy.message}</span>
                <textarea className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white" rows={4} value={message} maxLength={280} onChange={(event) => setMessage(event.target.value)} />
                <small style={{ opacity: 0.7 }}>{copy.messageHint} {message.length}/280</small>
              </label>
            </div>

            <button type="button" className="xmas-btn xmas-btn--gold" style={{ width: "100%", marginTop: "1.2rem" }} disabled={!recipient.trim()} onClick={buildGiftLink}>
              {copy.create}
            </button>
            <p className="xmas-lede" style={{ fontSize: "0.78rem", marginTop: "0.8rem" }}>{copy.privacy}</p>
          </div>

          {giftUrl ? (
            <div className="xmas-card" style={{ marginTop: "1.25rem", padding: "clamp(1rem, 3vw, 2rem)" }}>
              <p className="xmas-kicker">{copy.preview}</p>
              <h2 style={{ color: "#fffaf1", marginTop: "0.5rem", fontSize: "1.6rem" }}>{copy[gift]}</h2>
              <p className="xmas-lede">{copy.for}: <strong>{recipient.trim()}</strong>{sender.trim() ? ` · ${copy.from}: ${sender.trim()}` : ""}</p>
              <p className="xmas-lede" style={{ marginTop: "0.8rem" }}>{message.trim() || copy.noMessage}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.2rem" }}>
                <button type="button" className="xmas-btn xmas-btn--gold" onClick={() => void shareGift()}>{copy.share}</button>
                <button type="button" className="xmas-btn xmas-btn--ghost" onClick={() => void copyGift()}>{copied ? copy.copied : copy.copy}</button>
                <button type="button" className="xmas-btn xmas-btn--ghost" onClick={() => { setGiftUrl(""); setRecipient(""); setSender(""); setMessage(""); }}>{copy.another}</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
