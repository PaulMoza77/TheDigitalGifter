import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChristmasPageHead } from "./seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "./seo/localeRouting";
import { normalizeWave1GenerationLocale } from "./i18n/wave1Locale";
import { trackChristmasEvent } from "./analytics";
import { AmbientSnow } from "./landing/AmbientSnow";
import { CabinHeroScene } from "./landing/CabinHeroScene";
import { FONT_HREF } from "./landing/assets";
import ChristmasPortraitFunnelPage from "./ChristmasPortraitFunnelPage";
import "./landing/ChristmasLanding.css";
import "./closeout/ChristmasCloseout.css";

const CONSENT_KEY = "tdg.christmas.kids.guardian-consent.v1";

type Locale = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";
type Copy = {
  kicker: string;
  h1: string;
  lede: string;
  badge1: string;
  badge2: string;
  badge3: string;
  cta: string;
  consent: string;
  privateTitle: string;
  p1: string;
  p2: string;
  p3: string;
  continue: string;
  close: string;
  examplesKicker: string;
  examplesH2: string;
  examplesLede: string;
  exSanta: string;
  exPortrait: string;
  exCabin: string;
  exCard: string;
  exWishlist: string;
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
  modalKicker: string;
  modalH2: string;
  heroAlt: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    kicker: "Kids Christmas portraits",
    h1: "Kids Christmas AI Generator",
    lede: "A privacy-first Christmas portrait flow for a child or siblings. Before uploading, confirm that you are the parent or guardian, or that you have permission to use the photo.",
    badge1: "Parent / guardian gate",
    badge2: "No public gallery",
    badge3: "Private by default",
    cta: "Start Kids Portrait",
    consent: "I am the parent/guardian or I have permission to upload and transform this child’s photo.",
    privateTitle: "Built for family-safe use",
    p1: "No public gallery — uploads and results are private by default.",
    p2: "We do not ask for a child’s school, address, phone number, or social profile.",
    p3: "Use a photo you are allowed to use. Clear, visible faces work best.",
    continue: "Continue to Kids Christmas Portrait",
    close: "Close",
    examplesKicker: "Look & feel",
    examplesH2: "Soft magic, family-safe scenes",
    examplesLede: "Warm cabin light, classic portraits, and playful Christmas moments — tuned for kids.",
    exSanta: "Santa visit",
    exPortrait: "Kids portrait",
    exCabin: "Cabin glow",
    exCard: "Holiday card",
    exWishlist: "Wishlist letter",
    stepsKicker: "How it works",
    stepsH2: "Four gentle steps",
    stepsLede: "Confirm permission, upload a clear photo, pick a style, and keep the result private.",
    step1Title: "Confirm permission",
    step1Body: "A parent/guardian checkbox opens the private kids flow.",
    step2Title: "Upload a clear photo",
    step2Body: "One child or siblings — faces visible, soft indoor light preferred.",
    step3Title: "Choose a Christmas style",
    step3Body: "Family-safe scenes only. No public gallery, ever.",
    step4Title: "Download privately",
    step4Body: "Your portrait stays in your session — share only if you choose.",
    finaleH2: "Ready for a magical keepsake?",
    finaleLede: "Create a private Christmas portrait your family will treasure — with guardian consent first.",
    finaleCta: "Open consent & continue",
    modalKicker: "Privacy gate",
    modalH2: "Parent or guardian confirmation",
    heroAlt: "Snowy Christmas cabin with warm fireplace light",
  },
  ro: {
    kicker: "Portrete de Crăciun pentru copii",
    h1: "Generator AI de Crăciun pentru Copii",
    lede: "Un flow de Crăciun gândit privacy-first pentru un copil sau frați. Înainte să încarci poza, confirmă că ești părinte/tutore sau că ai permisiunea să o folosești.",
    badge1: "Poartă părinte / tutore",
    badge2: "Fără galerie publică",
    badge3: "Privat implicit",
    cta: "Începe portretul",
    consent: "Sunt părinte/tutore sau am permisiunea de a încărca și transforma fotografia copilului.",
    privateTitle: "Creat pentru utilizare sigură în familie",
    p1: "Fără galerie publică — pozele și rezultatele sunt private implicit.",
    p2: "Nu cerem școala, adresa, telefonul sau profilul social al copilului.",
    p3: "Folosește doar o fotografie pe care ai dreptul să o folosești. Fețele clare dau rezultate mai bune.",
    continue: "Continuă la Portretul de Crăciun",
    close: "Închide",
    examplesKicker: "Atmosferă",
    examplesH2: "Magie blândă, scene sigure",
    examplesLede: "Lumină de cabană, portrete clasice și momente de Crăciun — potrivite pentru copii.",
    exSanta: "Vizită Moș",
    exPortrait: "Portret copii",
    exCabin: "Cabană",
    exCard: "Felicitare",
    exWishlist: "Scrisoare dorințe",
    stepsKicker: "Cum funcționează",
    stepsH2: "Patru pași simpli",
    stepsLede: "Confirmă permisiunea, încarcă o poză clară, alege stilul și păstrează rezultatul privat.",
    step1Title: "Confirmă permisiunea",
    step1Body: "Checkbox-ul de părinte/tutore deschide flow-ul privat.",
    step2Title: "Încarcă o poză clară",
    step2Body: "Un copil sau frați — fețe vizibile, lumină blândă.",
    step3Title: "Alege un stil",
    step3Body: "Doar scene sigure pentru familie. Fără galerie publică.",
    step4Title: "Descarcă privat",
    step4Body: "Portretul rămâne în sesiune — îl împarți doar dacă vrei.",
    finaleH2: "Pregătit pentru o amintire magică?",
    finaleLede: "Creează un portret privat de Crăciun pe care familia îl va prețui — cu consimțământul tutorelui.",
    finaleCta: "Deschide consimțământul",
    modalKicker: "Poartă de confidențialitate",
    modalH2: "Confirmare părinte sau tutore",
    heroAlt: "Cabană de Crăciun cu lumină caldă de șemineu",
  },
  de: {
    kicker: "Weihnachtsporträts für Kinder",
    h1: "KI-Weihnachtsgenerator für Kinder",
    lede: "Ein datenschutzorientierter Weihnachts-Porträtflow für Kinder oder Geschwister. Bestätige vor dem Upload, dass du Elternteil/Erziehungsberechtigte(r) bist oder die Erlaubnis zur Nutzung des Fotos hast.",
    badge1: "Eltern- / Vormund-Gate",
    badge2: "Keine öffentliche Galerie",
    badge3: "Standardmäßig privat",
    cta: "Kinderporträt starten",
    consent: "Ich bin Elternteil/Erziehungsberechtigte(r) oder habe die Erlaubnis, dieses Kinderfoto hochzuladen und zu bearbeiten.",
    privateTitle: "Für familiengerechte Nutzung entwickelt",
    p1: "Keine öffentliche Galerie — Uploads und Ergebnisse sind standardmäßig privat.",
    p2: "Wir fragen nicht nach Schule, Adresse, Telefonnummer oder Social-Media-Profil des Kindes.",
    p3: "Nutze nur ein Foto, das du verwenden darfst. Klare Gesichter funktionieren am besten.",
    continue: "Zum Kinder-Weihnachtsporträt",
    close: "Schließen",
    examplesKicker: "Look & Feeling",
    examplesH2: "Sanfte Magie, familiensichere Szenen",
    examplesLede: "Warmes Kabinenlicht, klassische Porträts und verspielte Weihnachtsmomente — für Kinder.",
    exSanta: "Santa-Besuch",
    exPortrait: "Kinderporträt",
    exCabin: "Kabinenlicht",
    exCard: "Weihnachtskarte",
    exWishlist: "Wunschzettel",
    stepsKicker: "So funktioniert’s",
    stepsH2: "Vier sanfte Schritte",
    stepsLede: "Erlaubnis bestätigen, klares Foto hochladen, Stil wählen, Ergebnis privat halten.",
    step1Title: "Erlaubnis bestätigen",
    step1Body: "Die Eltern-/Vormund-Checkbox öffnet den privaten Flow.",
    step2Title: "Klares Foto hochladen",
    step2Body: "Ein Kind oder Geschwister — sichtbare Gesichter, weiches Licht.",
    step3Title: "Weihnachtsstil wählen",
    step3Body: "Nur familiensichere Szenen. Nie eine öffentliche Galerie.",
    step4Title: "Privat herunterladen",
    step4Body: "Das Porträt bleibt in deiner Sitzung — teile nur, wenn du willst.",
    finaleH2: "Bereit für ein magisches Andenken?",
    finaleLede: "Erstelle ein privates Weihnachtsporträt — zuerst mit Einwilligung der Erziehungsberechtigten.",
    finaleCta: "Einwilligung öffnen",
    modalKicker: "Datenschutz-Gate",
    modalH2: "Bestätigung durch Eltern oder Vormund",
    heroAlt: "Verschneite Weihnachtskabine mit warmem Kaminlicht",
  },
  fr: {
    kicker: "Portraits de Noël pour enfants",
    h1: "Générateur IA de Noël pour Enfants",
    lede: "Un parcours de portrait de Noël axé sur la confidentialité pour un enfant ou des frères et sœurs. Confirmez que vous êtes parent/tuteur ou que vous avez l’autorisation d’utiliser la photo.",
    badge1: "Contrôle parent / tuteur",
    badge2: "Aucune galerie publique",
    badge3: "Privé par défaut",
    cta: "Commencer le portrait",
    consent: "Je suis le parent/tuteur ou j’ai l’autorisation de téléverser et transformer cette photo d’enfant.",
    privateTitle: "Conçu pour un usage familial sûr",
    p1: "Aucune galerie publique — les photos et résultats sont privés par défaut.",
    p2: "Nous ne demandons ni école, ni adresse, ni téléphone, ni profil social de l’enfant.",
    p3: "Utilisez uniquement une photo que vous êtes autorisé à utiliser. Les visages nets donnent de meilleurs résultats.",
    continue: "Continuer vers le Portrait de Noël",
    close: "Fermer",
    examplesKicker: "Ambiance",
    examplesH2: "Magie douce, scènes adaptées",
    examplesLede: "Lumière de chalet, portraits classiques et moments de Noël ludiques — pour les enfants.",
    exSanta: "Visite du Père Noël",
    exPortrait: "Portrait enfants",
    exCabin: "Chalet",
    exCard: "Carte de vœux",
    exWishlist: "Liste de souhaits",
    stepsKicker: "Comment ça marche",
    stepsH2: "Quatre étapes simples",
    stepsLede: "Confirmez l’autorisation, téléversez une photo nette, choisissez un style, gardez le résultat privé.",
    step1Title: "Confirmer l’autorisation",
    step1Body: "La case parent/tuteur ouvre le parcours privé.",
    step2Title: "Téléverser une photo nette",
    step2Body: "Un enfant ou des frères et sœurs — visages visibles, lumière douce.",
    step3Title: "Choisir un style",
    step3Body: "Scènes adaptées aux familles uniquement. Jamais de galerie publique.",
    step4Title: "Télécharger en privé",
    step4Body: "Le portrait reste dans votre session — partagez seulement si vous le souhaitez.",
    finaleH2: "Prêt pour un souvenir magique ?",
    finaleLede: "Créez un portrait de Noël privé que votre famille chérira — avec le consentement du tuteur.",
    finaleCta: "Ouvrir le consentement",
    modalKicker: "Contrôle confidentialité",
    modalH2: "Confirmation parent ou tuteur",
    heroAlt: "Chalet de Noël enneigé avec lumière chaude de cheminée",
  },
  es: {
    kicker: "Retratos de Navidad para niños",
    h1: "Generador IA de Navidad para Niños",
    lede: "Un flujo de retrato navideño centrado en la privacidad para un niño o hermanos. Confirma que eres padre/madre/tutor o que tienes permiso para usar la foto.",
    badge1: "Puerta padre / tutor",
    badge2: "Sin galería pública",
    badge3: "Privado por defecto",
    cta: "Empezar retrato",
    consent: "Soy padre/madre/tutor o tengo permiso para subir y transformar la foto de este menor.",
    privateTitle: "Diseñado para uso familiar seguro",
    p1: "Sin galería pública — fotos y resultados son privados por defecto.",
    p2: "No pedimos escuela, dirección, teléfono ni perfil social del menor.",
    p3: "Usa solo una foto que tengas permiso para utilizar. Los rostros claros funcionan mejor.",
    continue: "Continuar al Retrato Navideño",
    close: "Cerrar",
    examplesKicker: "Ambiente",
    examplesH2: "Magia suave, escenas seguras",
    examplesLede: "Luz de cabaña, retratos clásicos y momentos navideños — pensados para niños.",
    exSanta: "Visita de Santa",
    exPortrait: "Retrato infantil",
    exCabin: "Cabaña",
    exCard: "Tarjeta",
    exWishlist: "Lista de deseos",
    stepsKicker: "Cómo funciona",
    stepsH2: "Cuatro pasos suaves",
    stepsLede: "Confirma permiso, sube una foto clara, elige un estilo y mantén el resultado privado.",
    step1Title: "Confirmar permiso",
    step1Body: "La casilla de padre/tutor abre el flujo privado.",
    step2Title: "Subir una foto clara",
    step2Body: "Un niño o hermanos — rostros visibles, luz suave.",
    step3Title: "Elegir un estilo",
    step3Body: "Solo escenas seguras para familias. Sin galería pública.",
    step4Title: "Descargar en privado",
    step4Body: "El retrato permanece en tu sesión — comparte solo si quieres.",
    finaleH2: "¿Listo para un recuerdo mágico?",
    finaleLede: "Crea un retrato navideño privado que tu familia atesorará — con consentimiento del tutor.",
    finaleCta: "Abrir consentimiento",
    modalKicker: "Puerta de privacidad",
    modalH2: "Confirmación de padre o tutor",
    heroAlt: "Cabaña navideña nevada con luz cálida de chimenea",
  },
  it: {
    kicker: "Ritratti di Natale per bambini",
    h1: "Generatore IA di Natale per Bambini",
    lede: "Un flusso di ritratto natalizio privacy-first per un bambino o fratelli. Conferma di essere genitore/tutore o di avere il permesso di usare la foto.",
    badge1: "Controllo genitore / tutore",
    badge2: "Nessuna galleria pubblica",
    badge3: "Privato di default",
    cta: "Inizia il ritratto",
    consent: "Sono genitore/tutore o ho il permesso di caricare e trasformare questa foto del minore.",
    privateTitle: "Pensato per un uso familiare sicuro",
    p1: "Nessuna galleria pubblica — caricamenti e risultati sono privati per impostazione predefinita.",
    p2: "Non chiediamo scuola, indirizzo, telefono o profilo social del minore.",
    p3: "Usa solo una foto che hai il permesso di utilizzare. I volti nitidi funzionano meglio.",
    continue: "Continua al Ritratto di Natale",
    close: "Chiudi",
    examplesKicker: "Atmosfera",
    examplesH2: "Magia delicata, scene sicure",
    examplesLede: "Luce di baita, ritratti classici e momenti natalizi giocosi — per i bambini.",
    exSanta: "Visita di Babbo Natale",
    exPortrait: "Ritratto bambini",
    exCabin: "Baita",
    exCard: "Biglietto",
    exWishlist: "Lista dei desideri",
    stepsKicker: "Come funziona",
    stepsH2: "Quattro passi semplici",
    stepsLede: "Conferma il permesso, carica una foto nitida, scegli uno stile e tieni il risultato privato.",
    step1Title: "Conferma il permesso",
    step1Body: "La casella genitore/tutore apre il flusso privato.",
    step2Title: "Carica una foto nitida",
    step2Body: "Un bambino o fratelli — volti visibili, luce morbida.",
    step3Title: "Scegli uno stile",
    step3Body: "Solo scene adatte alle famiglie. Mai galleria pubblica.",
    step4Title: "Scarica in privato",
    step4Body: "Il ritratto resta nella sessione — condividilo solo se vuoi.",
    finaleH2: "Pronto per un ricordo magico?",
    finaleLede: "Crea un ritratto di Natale privato che la famiglia tesorerà — con il consenso del tutore.",
    finaleCta: "Apri il consenso",
    modalKicker: "Controllo privacy",
    modalH2: "Conferma genitore o tutore",
    heroAlt: "Baita natalizia innevata con luce calda del camino",
  },
  pt: {
    kicker: "Retratos de Natal para crianças",
    h1: "Gerador IA de Natal para Crianças",
    lede: "Um fluxo de retrato de Natal centrado na privacidade para uma criança ou irmãos. Confirme que é pai/mãe/tutor ou que tem autorização para usar a fotografia.",
    badge1: "Portão pai / tutor",
    badge2: "Sem galeria pública",
    badge3: "Privado por predefinição",
    cta: "Começar retrato",
    consent: "Sou pai/mãe/tutor ou tenho autorização para carregar e transformar esta fotografia da criança.",
    privateTitle: "Criado para utilização familiar segura",
    p1: "Sem galeria pública — fotografias e resultados são privados por predefinição.",
    p2: "Não pedimos escola, morada, telefone ou perfil social da criança.",
    p3: "Use apenas uma fotografia que tenha autorização para utilizar. Rostos nítidos funcionam melhor.",
    continue: "Continuar para o Retrato de Natal",
    close: "Fechar",
    examplesKicker: "Ambiente",
    examplesH2: "Magia suave, cenas seguras",
    examplesLede: "Luz de cabana, retratos clássicos e momentos de Natal — pensados para crianças.",
    exSanta: "Visita do Pai Natal",
    exPortrait: "Retrato infantil",
    exCabin: "Cabana",
    exCard: "Cartão",
    exWishlist: "Lista de desejos",
    stepsKicker: "Como funciona",
    stepsH2: "Quatro passos suaves",
    stepsLede: "Confirme a autorização, carregue uma foto nítida, escolha um estilo e mantenha o resultado privado.",
    step1Title: "Confirmar autorização",
    step1Body: "A caixa de pai/tutor abre o fluxo privado.",
    step2Title: "Carregar uma foto nítida",
    step2Body: "Uma criança ou irmãos — rostos visíveis, luz suave.",
    step3Title: "Escolher um estilo",
    step3Body: "Apenas cenas seguras para famílias. Sem galeria pública.",
    step4Title: "Descarregar em privado",
    step4Body: "O retrato fica na sessão — partilhe só se quiser.",
    finaleH2: "Pronto para uma lembrança mágica?",
    finaleLede: "Crie um retrato de Natal privado que a família vai valorizar — com consentimento do tutor.",
    finaleCta: "Abrir consentimento",
    modalKicker: "Portão de privacidade",
    modalH2: "Confirmação de pai ou tutor",
    heroAlt: "Cabana de Natal nevada com luz quente da lareira",
  },
  nl: {
    kicker: "Kerstportretten voor kinderen",
    h1: "AI-kerstgenerator voor Kinderen",
    lede: "Een privacy-first kerstportretflow voor een kind of broers/zussen. Bevestig dat je ouder/voogd bent of toestemming hebt om de foto te gebruiken.",
    badge1: "Ouder- / voogdpoort",
    badge2: "Geen openbare galerij",
    badge3: "Standaard privé",
    cta: "Start kinderportret",
    consent: "Ik ben ouder/voogd of ik heb toestemming om deze kinderfoto te uploaden en te transformeren.",
    privateTitle: "Ontworpen voor veilig gezinsgebruik",
    p1: "Geen openbare galerij — uploads en resultaten zijn standaard privé.",
    p2: "We vragen niet naar school, adres, telefoonnummer of sociale profielen van het kind.",
    p3: "Gebruik alleen een foto die je mag gebruiken. Duidelijke gezichten werken het best.",
    continue: "Doorgaan naar Kerstportret",
    close: "Sluiten",
    examplesKicker: "Sfeer",
    examplesH2: "Zachte magie, veilige scènes",
    examplesLede: "Warm kabinelicht, klassieke portretten en speelse kerstmomenten — voor kinderen.",
    exSanta: "Bezoek van de Kerstman",
    exPortrait: "Kinderportret",
    exCabin: "Cabin",
    exCard: "Kerstkaart",
    exWishlist: "Wensenlijst",
    stepsKicker: "Hoe het werkt",
    stepsH2: "Vier zachte stappen",
    stepsLede: "Bevestig toestemming, upload een duidelijke foto, kies een stijl en houd het resultaat privé.",
    step1Title: "Toestemming bevestigen",
    step1Body: "Het ouder-/voogdvinkje opent de privéflow.",
    step2Title: "Duidelijke foto uploaden",
    step2Body: "Eén kind of broers/zussen — zichtbare gezichten, zacht licht.",
    step3Title: "Kerststijl kiezen",
    step3Body: "Alleen gezinsvriendelijke scènes. Nooit een openbare galerij.",
    step4Title: "Privé downloaden",
    step4Body: "Het portret blijft in je sessie — deel alleen als je wilt.",
    finaleH2: "Klaar voor een magische herinnering?",
    finaleLede: "Maak een privé kerstportret dat je gezin koestert — eerst met toestemming van de voogd.",
    finaleCta: "Open toestemming",
    modalKicker: "Privacypoort",
    modalH2: "Bevestiging door ouder of voogd",
    heroAlt: "Besneeuwde kerstcabin met warm haardvuurlicht",
  },
  pl: {
    kicker: "Portrety świąteczne dla dzieci",
    h1: "Generator AI Świąt dla Dzieci",
    lede: "Nastawiony na prywatność proces tworzenia portretu dla dziecka lub rodzeństwa. Potwierdź, że jesteś rodzicem/opiekunem lub masz zgodę na użycie zdjęcia.",
    badge1: "Brama rodzic / opiekun",
    badge2: "Brak publicznej galerii",
    badge3: "Domyślnie prywatne",
    cta: "Rozpocznij portret",
    consent: "Jestem rodzicem/opiekunem lub mam zgodę na przesłanie i przekształcenie tego zdjęcia dziecka.",
    privateTitle: "Zaprojektowane z myślą o bezpiecznym użyciu rodzinnym",
    p1: "Brak publicznej galerii — zdjęcia i wyniki są domyślnie prywatne.",
    p2: "Nie pytamy o szkołę, adres, telefon ani profil społecznościowy dziecka.",
    p3: "Używaj tylko zdjęcia, do którego masz prawo. Wyraźne twarze dają najlepsze rezultaty.",
    continue: "Przejdź do Portretu Świątecznego",
    close: "Zamknij",
    examplesKicker: "Klimat",
    examplesH2: "Delikatna magia, bezpieczne sceny",
    examplesLede: "Ciepłe światło chaty, klasyczne portrety i świąteczne chwile — dla dzieci.",
    exSanta: "Wizyta Mikołaja",
    exPortrait: "Portret dzieci",
    exCabin: "Chata",
    exCard: "Kartka",
    exWishlist: "Lista życzeń",
    stepsKicker: "Jak to działa",
    stepsH2: "Cztery proste kroki",
    stepsLede: "Potwierdź zgodę, wgraj wyraźne zdjęcie, wybierz styl i zachowaj wynik prywatnie.",
    step1Title: "Potwierdź zgodę",
    step1Body: "Pole rodzica/opiekuna otwiera prywatny przepływ.",
    step2Title: "Wgraj wyraźne zdjęcie",
    step2Body: "Jedno dziecko lub rodzeństwo — widoczne twarze, miękkie światło.",
    step3Title: "Wybierz styl",
    step3Body: "Tylko sceny bezpieczne dla rodzin. Bez publicznej galerii.",
    step4Title: "Pobierz prywatnie",
    step4Body: "Portret zostaje w sesji — udostępniaj tylko jeśli chcesz.",
    finaleH2: "Gotowy na magiczną pamiątkę?",
    finaleLede: "Stwórz prywatny portret świąteczny, który rodzina zachowa — najpierw ze zgodą opiekuna.",
    finaleCta: "Otwórz zgodę",
    modalKicker: "Brama prywatności",
    modalH2: "Potwierdzenie rodzica lub opiekuna",
    heroAlt: "Ośnieżona świąteczna chata z ciepłym światłem kominka",
  },
};

const EXAMPLES = [
  { src: "/assets/christmas/santa-idle.webp", labelKey: "exSanta" as const },
  { src: "/christmas/prints/portraits-480.webp", labelKey: "exPortrait" as const },
  { src: "/christmas/cabin-hero-1280.webp", labelKey: "exCabin" as const },
  { src: "/christmas/prints/cards-480.webp", labelKey: "exCard" as const },
  { src: "/assets/christmas/wishlist_letter.webp", labelKey: "exWishlist" as const },
];

function ensureFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

export default function ChristmasKidsPage() {
  const { pathname } = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(pathname).locale,
  ) as Locale;
  const copy = COPY[locale] || COPY.en;
  const [accepted, setAccepted] = useState(() => {
    try {
      return sessionStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [checked, setChecked] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    if (accepted) return;
    void trackChristmasEvent("christmas_page_view", {
      productKey: "christmas_kids",
      pathname: "/christmas/kids",
      locale,
      metadata: { gate: "guardian_consent" },
    });
  }, [accepted, locale]);

  if (accepted) return <ChristmasPortraitFunnelPage />;

  function continueToGenerator() {
    if (!checked) return;
    try {
      sessionStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // Session storage is a convenience only; consent still applies to this view.
    }
    void trackChristmasEvent("personalization_completed", {
      productKey: "christmas_kids",
      pathname: "/christmas/kids",
      locale,
      metadata: { gate: "guardian_consent", accepted: true },
    });
    setAccepted(true);
  }

  const steps = [
    { title: copy.step1Title, body: copy.step1Body },
    { title: copy.step2Title, body: copy.step2Body },
    { title: copy.step3Title, body: copy.step3Body },
    { title: copy.step4Title, body: copy.step4Body },
  ];

  return (
    <main className="xmas-landing xco-page" lang={locale}>
      <ChristmasPageHead path="/christmas/kids" />
      <AmbientSnow />

      <section className="xco-hero" aria-labelledby="kids-hero-title">
        <div className="xco-hero__stage" aria-hidden="true">
          <CabinHeroScene alt={copy.heroAlt} />
          <div className="xco-hero__veil" />
          <div className="xco-hero__glow" />
        </div>
        <div className="xco-hero__content">
          <p className="xmas-kicker">{copy.kicker}</p>
          <h1 id="kids-hero-title">{copy.h1}</h1>
          <p className="xmas-lede">{copy.lede}</p>
          <div className="xco-badges" aria-label="Highlights">
            <span className="xco-badge">{copy.badge1}</span>
            <span className="xco-badge">{copy.badge2}</span>
            <span className="xco-badge">{copy.badge3}</span>
          </div>
          <div className="xco-actions">
            <button
              type="button"
              className="xmas-btn xmas-btn--crimson"
              onClick={() => setConsentOpen(true)}
            >
              {copy.cta}
            </button>
          </div>
        </div>
      </section>

      <section className="xco-band xco-band--cream" aria-labelledby="kids-examples-title">
        <div className="xco-band__inner">
          <p className="xmas-kicker" style={{ color: "#7a1520" }}>{copy.examplesKicker}</p>
          <h2 id="kids-examples-title">{copy.examplesH2}</h2>
          <p className="xco-band__lede">{copy.examplesLede}</p>
          <div className="xco-grid xco-grid--examples">
            {EXAMPLES.map((item) => (
              <figure key={item.src} className="xco-example">
                <img
                  className="xco-example__img"
                  src={item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="xco-example__veil" />
                <figcaption className="xco-example__label">{copy[item.labelKey]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="xco-band xco-band--ink" aria-labelledby="kids-steps-title">
        <div className="xco-band__inner">
          <p className="xmas-kicker">{copy.stepsKicker}</p>
          <h2 id="kids-steps-title">{copy.stepsH2}</h2>
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

      <section className="xco-band xco-band--ink" aria-labelledby="kids-finale-title">
        <div className="xco-band__inner">
          <div className="xco-finale">
            <img
              className="xco-finale__bg"
              src="/assets/christmas/portrait_family.webp"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="xco-finale__veil" />
            <div className="xco-finale__content">
              <h2 id="kids-finale-title">{copy.finaleH2}</h2>
              <p>{copy.finaleLede}</p>
              <div className="xco-actions">
                <button
                  type="button"
                  className="xmas-btn xmas-btn--crimson"
                  onClick={() => setConsentOpen(true)}
                >
                  {copy.finaleCta}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {consentOpen ? (
        <div
          className="xco-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kids-consent-title"
        >
          <div className="xco-modal__panel">
            <p className="xmas-kicker">{copy.modalKicker}</p>
            <h2 id="kids-consent-title">{copy.modalH2}</h2>
            <div className="xco-privacy">
              <strong>{copy.privateTitle}</strong>
              <ul>
                <li>{copy.p1}</li>
                <li>{copy.p2}</li>
                <li>{copy.p3}</li>
              </ul>
            </div>
            <label className="xco-consent">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>{copy.consent}</span>
            </label>
            <div className="xco-actions">
              <button
                type="button"
                className="xmas-btn xmas-btn--crimson"
                disabled={!checked}
                onClick={continueToGenerator}
              >
                {copy.continue}
              </button>
              <button
                type="button"
                className="xmas-btn xmas-btn--ghost"
                onClick={() => setConsentOpen(false)}
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
