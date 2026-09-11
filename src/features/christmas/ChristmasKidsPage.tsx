import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChristmasPageHead } from "./seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "./seo/localeRouting";
import { normalizeWave1GenerationLocale } from "./i18n/wave1Locale";
import { trackChristmasEvent } from "./analytics";
import { AmbientSnow } from "./landing/AmbientSnow";
import ChristmasPortraitFunnelPage from "./ChristmasPortraitFunnelPage";
import "./landing/ChristmasLanding.css";

const CONSENT_KEY = "tdg.christmas.kids.guardian-consent.v1";

type Locale = "en" | "ro" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "pl";
type Copy = {
  kicker: string;
  h1: string;
  lede: string;
  consent: string;
  privateTitle: string;
  p1: string;
  p2: string;
  p3: string;
  continue: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    kicker: "Kids Christmas portraits",
    h1: "Create a Magical Christmas Portrait for Your Kids",
    lede: "A privacy-first Christmas portrait flow for a child or siblings. Before uploading, confirm that you are the parent or guardian, or that you have permission to use the photo.",
    consent: "I am the parent/guardian or I have permission to upload and transform this child’s photo.",
    privateTitle: "Built for family-safe use",
    p1: "No public gallery — uploads and results are private by default.",
    p2: "We do not ask for a child’s school, address, phone number, or social profile.",
    p3: "Use a photo you are allowed to use. Clear, visible faces work best.",
    continue: "Continue to Kids Christmas Portrait",
  },
  ro: {
    kicker: "Portrete de Crăciun pentru copii",
    h1: "Creează un Portret Magic de Crăciun pentru Copilul Tău",
    lede: "Un flow de Crăciun gândit privacy-first pentru un copil sau frați. Înainte să încarci poza, confirmă că ești părinte/tutore sau că ai permisiunea să o folosești.",
    consent: "Sunt părinte/tutore sau am permisiunea de a încărca și transforma fotografia copilului.",
    privateTitle: "Creat pentru utilizare sigură în familie",
    p1: "Fără galerie publică — pozele și rezultatele sunt private implicit.",
    p2: "Nu cerem școala, adresa, telefonul sau profilul social al copilului.",
    p3: "Folosește doar o fotografie pe care ai dreptul să o folosești. Fețele clare dau rezultate mai bune.",
    continue: "Continuă la Portretul de Crăciun",
  },
  de: {
    kicker: "Weihnachtsporträts für Kinder",
    h1: "Erstelle ein Magisches Weihnachtsporträt für Dein Kind",
    lede: "Ein datenschutzorientierter Weihnachts-Porträtflow für Kinder oder Geschwister. Bestätige vor dem Upload, dass du Elternteil/Erziehungsberechtigte(r) bist oder die Erlaubnis zur Nutzung des Fotos hast.",
    consent: "Ich bin Elternteil/Erziehungsberechtigte(r) oder habe die Erlaubnis, dieses Kinderfoto hochzuladen und zu bearbeiten.",
    privateTitle: "Für familiengerechte Nutzung entwickelt",
    p1: "Keine öffentliche Galerie — Uploads und Ergebnisse sind standardmäßig privat.",
    p2: "Wir fragen nicht nach Schule, Adresse, Telefonnummer oder Social-Media-Profil des Kindes.",
    p3: "Nutze nur ein Foto, das du verwenden darfst. Klare Gesichter funktionieren am besten.",
    continue: "Zum Kinder-Weihnachtsporträt",
  },
  fr: {
    kicker: "Portraits de Noël pour enfants",
    h1: "Créez un Portrait de Noël Magique pour Votre Enfant",
    lede: "Un parcours de portrait de Noël axé sur la confidentialité pour un enfant ou des frères et sœurs. Confirmez que vous êtes parent/tuteur ou que vous avez l’autorisation d’utiliser la photo.",
    consent: "Je suis le parent/tuteur ou j’ai l’autorisation de téléverser et transformer cette photo d’enfant.",
    privateTitle: "Conçu pour un usage familial sûr",
    p1: "Aucune galerie publique — les photos et résultats sont privés par défaut.",
    p2: "Nous ne demandons ni école, ni adresse, ni téléphone, ni profil social de l’enfant.",
    p3: "Utilisez uniquement une photo que vous êtes autorisé à utiliser. Les visages nets donnent de meilleurs résultats.",
    continue: "Continuer vers le Portrait de Noël",
  },
  es: {
    kicker: "Retratos de Navidad para niños",
    h1: "Crea un Retrato Navideño Mágico para Tu Hijo",
    lede: "Un flujo de retrato navideño centrado en la privacidad para un niño o hermanos. Confirma que eres padre/madre/tutor o que tienes permiso para usar la foto.",
    consent: "Soy padre/madre/tutor o tengo permiso para subir y transformar la foto de este menor.",
    privateTitle: "Diseñado para uso familiar seguro",
    p1: "Sin galería pública — fotos y resultados son privados por defecto.",
    p2: "No pedimos escuela, dirección, teléfono ni perfil social del menor.",
    p3: "Usa solo una foto que tengas permiso para utilizar. Los rostros claros funcionan mejor.",
    continue: "Continuar al Retrato Navideño",
  },
  it: {
    kicker: "Ritratti di Natale per bambini",
    h1: "Crea un Ritratto di Natale Magico per Tuo Figlio",
    lede: "Un flusso di ritratto natalizio privacy-first per un bambino o fratelli. Conferma di essere genitore/tutore o di avere il permesso di usare la foto.",
    consent: "Sono genitore/tutore o ho il permesso di caricare e trasformare questa foto del minore.",
    privateTitle: "Pensato per un uso familiare sicuro",
    p1: "Nessuna galleria pubblica — caricamenti e risultati sono privati per impostazione predefinita.",
    p2: "Non chiediamo scuola, indirizzo, telefono o profilo social del minore.",
    p3: "Usa solo una foto che hai il permesso di utilizzare. I volti nitidi funzionano meglio.",
    continue: "Continua al Ritratto di Natale",
  },
  pt: {
    kicker: "Retratos de Natal para crianças",
    h1: "Crie um Retrato de Natal Mágico para a Sua Criança",
    lede: "Um fluxo de retrato de Natal centrado na privacidade para uma criança ou irmãos. Confirme que é pai/mãe/tutor ou que tem autorização para usar a fotografia.",
    consent: "Sou pai/mãe/tutor ou tenho autorização para carregar e transformar esta fotografia da criança.",
    privateTitle: "Criado para utilização familiar segura",
    p1: "Sem galeria pública — fotografias e resultados são privados por predefinição.",
    p2: "Não pedimos escola, morada, telefone ou perfil social da criança.",
    p3: "Use apenas uma fotografia que tenha autorização para utilizar. Rostos nítidos funcionam melhor.",
    continue: "Continuar para o Retrato de Natal",
  },
  nl: {
    kicker: "Kerstportretten voor kinderen",
    h1: "Maak een Magisch Kerstportret voor Je Kind",
    lede: "Een privacy-first kerstportretflow voor een kind of broers/zussen. Bevestig dat je ouder/voogd bent of toestemming hebt om de foto te gebruiken.",
    consent: "Ik ben ouder/voogd of ik heb toestemming om deze kinderfoto te uploaden en te transformeren.",
    privateTitle: "Ontworpen voor veilig gezinsgebruik",
    p1: "Geen openbare galerij — uploads en resultaten zijn standaard privé.",
    p2: "We vragen niet naar school, adres, telefoonnummer of sociale profielen van het kind.",
    p3: "Gebruik alleen een foto die je mag gebruiken. Duidelijke gezichten werken het best.",
    continue: "Doorgaan naar Kerstportret",
  },
  pl: {
    kicker: "Portrety świąteczne dla dzieci",
    h1: "Stwórz Magiczny Portret Świąteczny dla Swojego Dziecka",
    lede: "Nastawiony na prywatność proces tworzenia portretu dla dziecka lub rodzeństwa. Potwierdź, że jesteś rodzicem/opiekunem lub masz zgodę na użycie zdjęcia.",
    consent: "Jestem rodzicem/opiekunem lub mam zgodę na przesłanie i przekształcenie tego zdjęcia dziecka.",
    privateTitle: "Zaprojektowane z myślą o bezpiecznym użyciu rodzinnym",
    p1: "Brak publicznej galerii — zdjęcia i wyniki są domyślnie prywatne.",
    p2: "Nie pytamy o szkołę, adres, telefon ani profil społecznościowy dziecka.",
    p3: "Używaj tylko zdjęcia, do którego masz prawo. Wyraźne twarze dają najlepsze rezultaty.",
    continue: "Przejdź do Portretu Świątecznego",
  },
};

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

  return (
    <main className="xmas-landing" lang={locale}>
      <ChristmasPageHead path="/christmas/kids" />
      <AmbientSnow />
      <section className="xmas-section" style={{ minHeight: "74vh", display: "grid", placeItems: "center", paddingTop: "4rem", paddingBottom: "5rem" }}>
        <div className="xmas-card" style={{ width: "100%", maxWidth: 760, padding: "clamp(1.35rem, 4vw, 2.7rem)" }}>
          <p className="xmas-kicker">{copy.kicker}</p>
          <h1 style={{ color: "#fffaf1", fontSize: "clamp(2.2rem, 7vw, 4.5rem)", lineHeight: 0.98, margin: "0.75rem 0 1rem" }}>{copy.h1}</h1>
          <p className="xmas-lede">{copy.lede}</p>

          <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, background: "rgba(0,0,0,.22)" }}>
            <strong style={{ color: "#fffaf1" }}>{copy.privateTitle}</strong>
            <ul className="xmas-lede" style={{ marginTop: "0.65rem", paddingLeft: "1.2rem", display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
              <li>{copy.p1}</li>
              <li>{copy.p2}</li>
              <li>{copy.p3}</li>
            </ul>
          </div>

          <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginTop: "1.25rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              style={{ marginTop: 4, width: 18, height: 18 }}
            />
            <span className="xmas-lede" style={{ fontSize: "0.9rem" }}>{copy.consent}</span>
          </label>

          <button
            type="button"
            className="xmas-btn xmas-btn--gold"
            style={{ width: "100%", marginTop: "1.25rem" }}
            disabled={!checked}
            onClick={continueToGenerator}
          >
            {copy.continue}
          </button>
        </div>
      </section>
    </main>
  );
}
