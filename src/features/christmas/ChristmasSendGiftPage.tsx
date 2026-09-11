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
import { FONT_HREF } from "./landing/assets";
import "./landing/ChristmasLanding.css";
import "./closeout/ChristmasCloseout.css";

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
  badge1: string;
  badge2: string;
  badge3: string;
  cta: string;
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
  stepsKicker: string;
  stepsH2: string;
  stepsLede: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
  step4Title: string;
  step4Body: string;
  finaleH2: string;
  finaleLede: string;
  finaleCta: string;
  recipientKicker: string;
  heroAlt: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    title: "Send a Christmas Gift Online | TheDigitalGifter",
    description: "Create a private Christmas gift link with a personal message and send a digital Christmas experience in seconds.",
    kicker: "Send a Christmas gift",
    h1: "Send a Magical Christmas Gift",
    lede: "Choose an experience, add a personal message, and share one private gift link in seconds.",
    badge1: "Personal & unique",
    badge2: "Private and secure",
    badge3: "Instant sharing",
    cta: "Send a Christmas Gift",
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
    stepsKicker: "How it works",
    stepsH2: "Four festive steps",
    stepsLede: "Pick an experience, personalize the note, create a private link, and send the magic.",
    step1Title: "Choose a gift",
    step1Body: "Pick the Christmas experience you want to send.",
    step2Title: "Add recipient details",
    step2Body: "Write their name and a warm personal message.",
    step3Title: "Create your gift",
    step3Body: "Generate one private gift link in a moment.",
    step4Title: "Share the magic",
    step4Body: "Copy or share the link — the message stays in the fragment.",
    finaleH2: "It's more than a gift. It's a memory.",
    finaleLede: "A personal message and a magical experience — delivered as one private gift link.",
    finaleCta: "Send a Christmas Gift",
    recipientKicker: "A gift for you",
    heroAlt: "Magical Christmas tree ready for gifts",
  },
  ro: {
    title: "Trimite un Cadou de Crăciun Online | TheDigitalGifter",
    description: "Creează un link privat de Crăciun cu mesaj personal și trimite o experiență digitală în câteva secunde.",
    kicker: "Trimite un cadou de Crăciun",
    h1: "Trimite un Cadou Magic de Crăciun",
    lede: "Alege experiența, adaugă un mesaj și trimite un singur link privat. Mesajul rămâne în fragmentul linkului și nu este stocat pe serverele noastre.",
    badge1: "Link privat",
    badge2: "Mesaj în fragmentul URL",
    badge3: "Gata în câteva secunde",
    cta: "Compune cadoul",
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
    stepsKicker: "Cum funcționează",
    stepsH2: "Patru pași festivi",
    stepsLede: "Alege experiența, personalizează mesajul, creează linkul privat și trimite magia.",
    step1Title: "Alege cadoul",
    step1Body: "Brad, portret, Moș sau felicitare — o experiență magică.",
    step2Title: "Adaugă mesajul",
    step2Body: "Un mesaj scurt care rămâne în fragmentul linkului.",
    step3Title: "Creează linkul",
    step3Body: "Generează un URL privat gata de trimis.",
    step4Title: "Trimite surpriza",
    step4Body: "Împarte sau copiază linkul — destinatarul deschide cadoul.",
    finaleH2: "Fă Crăciunul cuiva mai luminos",
    finaleLede: "Un mesaj personal și o experiență magică — într-un singur link privat.",
    finaleCta: "Începe să compui",
    recipientKicker: "Un cadou pentru tine",
    heroAlt: "Brad magic de Crăciun pregătit pentru cadouri",
  },
  de: {
    title: "Weihnachtsgeschenk Online Versenden | TheDigitalGifter",
    description: "Erstelle einen privaten Weihnachtslink mit persönlicher Nachricht und verschenke ein digitales Weihnachtserlebnis.",
    kicker: "Weihnachtsgeschenk senden",
    h1: "Verschenke ein Magisches Weihnachtsgeschenk",
    lede: "Wähle ein Erlebnis, füge eine persönliche Nachricht hinzu und teile einen privaten Geschenklink.",
    badge1: "Privater Geschenklink",
    badge2: "Nachricht im URL-Fragment",
    badge3: "In Sekunden fertig",
    cta: "Geschenk schreiben",
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
    stepsKicker: "So funktioniert’s",
    stepsH2: "Vier festliche Schritte",
    stepsLede: "Erlebnis wählen, Nachricht personalisieren, privaten Link erstellen und Magie senden.",
    step1Title: "Geschenk wählen",
    step1Body: "Baum, Porträt, Santa oder Karte — ein magisches Erlebnis.",
    step2Title: "Nachricht hinzufügen",
    step2Body: "Eine kurze Notiz, die im Link-Fragment bleibt.",
    step3Title: "Link erstellen",
    step3Body: "Erzeuge eine private Geschenk-URL zum Teilen.",
    step4Title: "Überraschung senden",
    step4Body: "Teile oder kopiere den Link — sie öffnen das Geschenk.",
    finaleH2: "Mach Weihnachten heller",
    finaleLede: "Eine persönliche Nachricht und ein magisches Erlebnis — als ein privater Geschenklink.",
    finaleCta: "Jetzt schreiben",
    recipientKicker: "Ein Geschenk für dich",
    heroAlt: "Magischer Weihnachtsbaum voller Geschenke",
  },
  fr: {
    title: "Envoyer un Cadeau de Noël en Ligne | TheDigitalGifter",
    description: "Créez un lien cadeau privé avec un message personnel et envoyez une expérience de Noël numérique.",
    kicker: "Envoyer un cadeau de Noël",
    h1: "Envoyez un Cadeau de Noël Magique",
    lede: "Choisissez une expérience, ajoutez un message personnel et partagez un lien cadeau privé.",
    badge1: "Lien cadeau privé",
    badge2: "Message dans le fragment URL",
    badge3: "Prêt en quelques secondes",
    cta: "Composer le cadeau",
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
    stepsKicker: "Comment ça marche",
    stepsH2: "Quatre étapes festives",
    stepsLede: "Choisissez une expérience, personnalisez le message, créez un lien privé et envoyez la magie.",
    step1Title: "Choisir un cadeau",
    step1Body: "Sapin, portrait, Père Noël ou carte — une expérience magique.",
    step2Title: "Ajouter votre message",
    step2Body: "Une courte note qui reste dans le fragment du lien.",
    step3Title: "Créer le lien",
    step3Body: "Générez une URL cadeau privée prête à partager.",
    step4Title: "Envoyer la surprise",
    step4Body: "Partagez ou copiez le lien — ils ouvrent le cadeau.",
    finaleH2: "Illuminez le Noël de quelqu’un",
    finaleLede: "Un message personnel et une expérience magique — en un seul lien privé.",
    finaleCta: "Commencer à composer",
    recipientKicker: "Un cadeau pour vous",
    heroAlt: "Sapin de Noël magique prêt pour les cadeaux",
  },
  es: {
    title: "Enviar un Regalo de Navidad Online | TheDigitalGifter",
    description: "Crea un enlace privado de Navidad con un mensaje personal y envía una experiencia digital en segundos.",
    kicker: "Enviar un regalo de Navidad",
    h1: "Envía un Regalo Mágico de Navidad",
    lede: "Elige una experiencia, añade un mensaje personal y comparte un enlace privado.",
    badge1: "Enlace privado",
    badge2: "Mensaje en el fragmento URL",
    badge3: "Listo en segundos",
    cta: "Componer el regalo",
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
    stepsKicker: "Cómo funciona",
    stepsH2: "Cuatro pasos festivos",
    stepsLede: "Elige una experiencia, personaliza el mensaje, crea un enlace privado y envía la magia.",
    step1Title: "Elige un regalo",
    step1Body: "Árbol, retrato, Santa o tarjeta — una experiencia mágica.",
    step2Title: "Añade tu mensaje",
    step2Body: "Una nota breve que permanece en el fragmento del enlace.",
    step3Title: "Crea el enlace",
    step3Body: "Genera una URL privada lista para compartir.",
    step4Title: "Envía la sorpresa",
    step4Body: "Comparte o copia el enlace — abren el regalo.",
    finaleH2: "Haz más brillante su Navidad",
    finaleLede: "Un mensaje personal y una experiencia mágica — en un solo enlace privado.",
    finaleCta: "Empezar a componer",
    recipientKicker: "Un regalo para ti",
    heroAlt: "Árbol de Navidad mágico listo para regalos",
  },
  it: {
    title: "Invia un Regalo di Natale Online | TheDigitalGifter",
    description: "Crea un link regalo privato con un messaggio personale e invia un’esperienza digitale di Natale.",
    kicker: "Invia un regalo di Natale",
    h1: "Invia un Regalo Magico di Natale",
    lede: "Scegli un’esperienza, aggiungi un messaggio personale e condividi un link regalo privato.",
    badge1: "Link regalo privato",
    badge2: "Messaggio nel frammento URL",
    badge3: "Pronto in pochi secondi",
    cta: "Componi il regalo",
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
    stepsKicker: "Come funziona",
    stepsH2: "Quattro passi festivi",
    stepsLede: "Scegli un’esperienza, personalizza il messaggio, crea un link privato e invia la magia.",
    step1Title: "Scegli un regalo",
    step1Body: "Albero, ritratto, Babbo Natale o cartolina — un’esperienza magica.",
    step2Title: "Aggiungi il messaggio",
    step2Body: "Una breve nota che resta nel frammento del link.",
    step3Title: "Crea il link",
    step3Body: "Genera un URL regalo privato pronto da condividere.",
    step4Title: "Invia la sorpresa",
    step4Body: "Condividi o copia il link — aprono il regalo.",
    finaleH2: "Illumina il Natale di qualcuno",
    finaleLede: "Un messaggio personale e un’esperienza magica — in un unico link privato.",
    finaleCta: "Inizia a comporre",
    recipientKicker: "Un regalo per te",
    heroAlt: "Albero di Natale magico pronto per i regali",
  },
  pt: {
    title: "Enviar um Presente de Natal Online | TheDigitalGifter",
    description: "Crie um link privado de Natal com uma mensagem pessoal e envie uma experiência digital em segundos.",
    kicker: "Enviar um presente de Natal",
    h1: "Envie um Presente Mágico de Natal",
    lede: "Escolha uma experiência, adicione uma mensagem pessoal e partilhe um link privado.",
    badge1: "Link privado",
    badge2: "Mensagem no fragmento URL",
    badge3: "Pronto em segundos",
    cta: "Compor o presente",
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
    stepsKicker: "Como funciona",
    stepsH2: "Quatro passos festivos",
    stepsLede: "Escolha uma experiência, personalize a mensagem, crie um link privado e envie a magia.",
    step1Title: "Escolha um presente",
    step1Body: "Árvore, retrato, Pai Natal ou cartão — uma experiência mágica.",
    step2Title: "Adicione a mensagem",
    step2Body: "Uma nota curta que fica no fragmento do link.",
    step3Title: "Crie o link",
    step3Body: "Gere um URL privado pronto para partilhar.",
    step4Title: "Envie a surpresa",
    step4Body: "Partilhe ou copie o link — abrem o presente.",
    finaleH2: "Ilumine o Natal de alguém",
    finaleLede: "Uma mensagem pessoal e uma experiência mágica — num único link privado.",
    finaleCta: "Começar a compor",
    recipientKicker: "Um presente para si",
    heroAlt: "Árvore de Natal mágica pronta para presentes",
  },
  nl: {
    title: "Online Kerstcadeau Versturen | TheDigitalGifter",
    description: "Maak een privé kerstcadeaulink met een persoonlijke boodschap en stuur een digitale kerstervaring.",
    kicker: "Stuur een kerstcadeau",
    h1: "Stuur een Magisch Kerstcadeau",
    lede: "Kies een ervaring, voeg een persoonlijke boodschap toe en deel één privé cadeaulink.",
    badge1: "Privé cadeaulink",
    badge2: "Bericht in URL-fragment",
    badge3: "Klaar in seconden",
    cta: "Stel je cadeau samen",
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
    stepsKicker: "Hoe het werkt",
    stepsH2: "Vier feestelijke stappen",
    stepsLede: "Kies een ervaring, personaliseer het bericht, maak een privélink en stuur de magie.",
    step1Title: "Kies een cadeau",
    step1Body: "Boom, portret, Kerstman of kaart — één magische ervaring.",
    step2Title: "Voeg je bericht toe",
    step2Body: "Een korte notitie die in het linkfragment blijft.",
    step3Title: "Maak de link",
    step3Body: "Genereer een privé cadeau-URL klaar om te delen.",
    step4Title: "Stuur de verrassing",
    step4Body: "Deel of kopieer de link — zij openen het cadeau.",
    finaleH2: "Maak iemands kerst helderder",
    finaleLede: "Een persoonlijk bericht en een magische ervaring — als één privé cadeaulink.",
    finaleCta: "Begin met schrijven",
    recipientKicker: "Een cadeau voor jou",
    heroAlt: "Magische kerstboom klaar voor cadeaus",
  },
  pl: {
    title: "Wyślij Prezent Świąteczny Online | TheDigitalGifter",
    description: "Utwórz prywatny link prezentowy z osobistą wiadomością i wyślij cyfrowe doświadczenie świąteczne.",
    kicker: "Wyślij prezent świąteczny",
    h1: "Wyślij Magiczny Prezent Świąteczny",
    lede: "Wybierz doświadczenie, dodaj osobistą wiadomość i udostępnij prywatny link prezentowy.",
    badge1: "Prywatny link prezentowy",
    badge2: "Wiadomość we fragmencie URL",
    badge3: "Gotowe w kilka sekund",
    cta: "Ułóż prezent",
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
    stepsKicker: "Jak to działa",
    stepsH2: "Cztery świąteczne kroki",
    stepsLede: "Wybierz doświadczenie, spersonalizuj wiadomość, utwórz prywatny link i wyślij magię.",
    step1Title: "Wybierz prezent",
    step1Body: "Choinka, portret, Mikołaj lub kartka — jedno magiczne doświadczenie.",
    step2Title: "Dodaj wiadomość",
    step2Body: "Krótka notatka, która zostaje we fragmencie linku.",
    step3Title: "Utwórz link",
    step3Body: "Wygeneruj prywatny URL prezentowy gotowy do udostępnienia.",
    step4Title: "Wyślij niespodziankę",
    step4Body: "Udostępnij lub skopiuj link — odbiorca otworzy prezent.",
    finaleH2: "Rozjaśnij czyjeś święta",
    finaleLede: "Osobista wiadomość i magiczne doświadczenie — w jednym prywatnym linku.",
    finaleCta: "Zacznij tworzyć",
    recipientKicker: "Prezent dla Ciebie",
    heroAlt: "Magiczna choinka gotowa na prezenty",
  },
};

const GIFT_OPTIONS: Array<{ key: GiftKey; path: string; image: string }> = [
  { key: "tree", path: "/christmas/tree-gifts", image: "/christmas/gifts/tree-hero-desktop.webp" },
  { key: "portrait", path: "/christmas/photo-generator", image: "/christmas/prints/portraits-480.webp" },
  { key: "santa", path: "/christmas/santa-video", image: "/assets/christmas/santa-idle.webp" },
  { key: "card", path: "/christmas/cards", image: "/christmas/prints/cards-480.webp" },
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

function ensureFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
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
    ensureFonts();
  }, []);

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

  function scrollToComposer() {
    document.getElementById("gift-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const steps = [
    { title: copy.step1Title, body: copy.step1Body },
    { title: copy.step2Title, body: copy.step2Body },
    { title: copy.step3Title, body: copy.step3Body },
    { title: copy.step4Title, body: copy.step4Body },
  ];

  if (incoming) {
    return (
      <main className="xmas-landing xco-page" lang={locale}>
        <PageHead
          title={copy.title}
          description={copy.description}
          url={`${SITE_ORIGIN}${pathFor(BASE_PATH)}`}
          exactTitle
          noindex
        />
        <AmbientSnow />
        <section className="xco-recipient">
          <div className="xco-recipient__card">
            <p className="xmas-kicker">{copy.recipientKicker}</p>
            <p className="xmas-lede" style={{ marginTop: "1rem" }}>
              {copy.for}: <strong>{incoming.to}</strong>
            </p>
            <h1>{giftTitle}</h1>
            <p className="xmas-lede" style={{ fontSize: "1.05rem" }}>
              {incoming.message || copy.noMessage}
            </p>
            {incoming.from ? (
              <p className="xmas-lede" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
                {copy.from}: <strong>{incoming.from}</strong>
              </p>
            ) : null}
            <p className="xmas-lede" style={{ marginTop: "1.4rem", fontSize: "0.9rem" }}>
              {giftBody}
            </p>
            <Link
              className="xmas-btn xmas-btn--crimson"
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
    <main className="xmas-landing xco-page" lang={locale}>
      <PageHead
        title={copy.title}
        description={copy.description}
        url={`${SITE_ORIGIN}${pathFor(BASE_PATH)}`}
        exactTitle
      />
      <AmbientSnow />

      <section className="xco-hero" aria-labelledby="gift-hero-title">
        <div className="xco-hero__stage" aria-hidden="true">
          <picture>
            <source
              media="(max-width: 719px)"
              srcSet="/christmas/gifts/tree-hero-mobile.webp"
              type="image/webp"
            />
            <img
              src="/christmas/gifts/tree-hero-desktop.webp"
              alt={copy.heroAlt}
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="xco-hero__veil" />
          <div className="xco-hero__glow" />
        </div>
        <div className="xco-hero__content">
          <p className="xmas-kicker">{copy.kicker}</p>
          <h1 id="gift-hero-title">{copy.h1}</h1>
          <p className="xmas-lede">{copy.lede}</p>
          <div className="xco-badges" aria-label="Highlights">
            <span className="xco-badge">{copy.badge1}</span>
            <span className="xco-badge">{copy.badge2}</span>
            <span className="xco-badge">{copy.badge3}</span>
          </div>
          <div className="xco-actions">
            <button type="button" className="xmas-btn xmas-btn--crimson" onClick={scrollToComposer}>
              {copy.cta}
            </button>
          </div>
        </div>
      </section>

      <section className="xco-band xco-band--ink" id="gift-composer" aria-labelledby="gift-composer-title">
        <div className="xco-band__inner">
          <p className="xmas-kicker">{copy.kicker}</p>
          <h2 id="gift-composer-title">{copy.choose}</h2>
          <p className="xco-band__lede">{copy.lede}</p>

          <div className="xco-grid xco-grid--gifts" style={{ marginTop: "1.75rem" }}>
            {GIFT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`xco-gift-card${gift === option.key ? " is-selected" : ""}`}
                onClick={() => setGift(option.key)}
                aria-pressed={gift === option.key}
              >
                <div className="xco-gift-card__media">
                  <img src={option.image} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="xco-gift-card__body">
                  <strong>{copy[option.key]}</strong>
                  <span>{copy[`${option.key}Body` as keyof Copy]}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="xco-composer">
            <div className="xco-fields">
              <label className="xco-field">
                <span>{copy.recipient}</span>
                <input
                  value={recipient}
                  maxLength={60}
                  onChange={(event) => setRecipient(event.target.value)}
                />
              </label>
              <label className="xco-field">
                <span>{copy.sender}</span>
                <input
                  value={sender}
                  maxLength={60}
                  onChange={(event) => setSender(event.target.value)}
                />
              </label>
              <label className="xco-field">
                <span>{copy.message}</span>
                <textarea
                  rows={4}
                  value={message}
                  maxLength={280}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <small>
                  {copy.messageHint} {message.length}/280
                </small>
              </label>
            </div>

            <button
              type="button"
              className="xmas-btn xmas-btn--crimson"
              style={{ width: "100%", marginTop: "1.2rem" }}
              disabled={!recipient.trim()}
              onClick={buildGiftLink}
            >
              {copy.create}
            </button>
            <p className="xmas-lede" style={{ fontSize: "0.78rem", marginTop: "0.8rem" }}>
              {copy.privacy}
            </p>

            {giftUrl ? (
              <div className="xco-preview">
                <p className="xmas-kicker">{copy.preview}</p>
                <h3>{copy[gift]}</h3>
                <p className="xmas-lede">
                  {copy.for}: <strong>{recipient.trim()}</strong>
                  {sender.trim() ? ` · ${copy.from}: ${sender.trim()}` : ""}
                </p>
                <p className="xmas-lede" style={{ marginTop: "0.8rem" }}>
                  {message.trim() || copy.noMessage}
                </p>
                <div className="xco-actions">
                  <button type="button" className="xmas-btn xmas-btn--crimson" onClick={() => void shareGift()}>
                    {copy.share}
                  </button>
                  <button type="button" className="xmas-btn xmas-btn--ghost" onClick={() => void copyGift()}>
                    {copied ? copy.copied : copy.copy}
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => {
                      setGiftUrl("");
                      setRecipient("");
                      setSender("");
                      setMessage("");
                    }}
                  >
                    {copy.another}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="xco-band xco-band--cream" aria-labelledby="gift-steps-title">
        <div className="xco-band__inner">
          <p className="xmas-kicker" style={{ color: "#7a1520" }}>{copy.stepsKicker}</p>
          <h2 id="gift-steps-title">{copy.stepsH2}</h2>
          <p className="xco-band__lede">{copy.stepsLede}</p>
          <div className="xco-grid xco-grid--steps">
            {steps.map((step, index) => (
              <article key={step.title} className="xco-step">
                <span className="xco-step__num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="xco-band xco-band--ink" aria-labelledby="gift-finale-title">
        <div className="xco-band__inner">
          <div className="xco-finale">
            <img
              className="xco-finale__bg"
              src="/christmas/gifts/tree-hero-desktop.webp"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="xco-finale__veil" />
            <div className="xco-finale__content">
              <h2 id="gift-finale-title">{copy.finaleH2}</h2>
              <p>{copy.finaleLede}</p>
              <div className="xco-actions">
                <button type="button" className="xmas-btn xmas-btn--crimson" onClick={scrollToComposer}>
                  {copy.finaleCta}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
