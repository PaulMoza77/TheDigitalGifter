/**
 * Romanian P3A pilot SEO content for complete Christmas routes only.
 * Genuine RO copy — not machine-filler. Incomplete routes stay out of this map.
 */

/** @typedef {{
 *   title: string,
 *   description: string,
 *   h1: string,
 *   lede: string,
 *   h2?: string,
 *   h2Body?: string,
 *   links?: Array<{ href: string, label: string }>,
 *   breadcrumbs?: Array<{ href: string, label: string }>,
 *   geo?: { h2: string, body: string },
 *   sections?: Array<{ h2: string, body: string, linkHref?: string, linkLabel?: string, list?: string[] }>,
 *   faqs?: Array<{ q: string, a: string }>,
 * }} LocalizedSeoPage */

/** @type {Record<string, LocalizedSeoPage>} */
export const CHRISTMAS_SEO_CONTENT_RO = {
  "/christmas": {
    title: "Crăciun la TheDigitalGifter | Cadouri, Foto, Moș Crăciun și altele",
    description:
      "Creează cadouri de Crăciun, portrete AI, video-uri de la Moș Crăciun, liste de dorințe, felicitări și surprize de Advent — experiențe digitale personalizate de Crăciun de la TheDigitalGifter.",
    h1: "Creează ceva de care își vor aminti",
    lede:
      "Explorează cadouri de Crăciun, portrete foto, video-uri de la Moș Crăciun, brazi digitali, calendare de Advent, felicitări și mesaje — toate într-un singur loc la TheDigitalGifter.",
    h2: "Experiențe de Crăciun",
    h2Body: "Alege un produs de Crăciun de mai jos și creează ceva personal în câteva minute.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
    ],
    links: [
      { href: "/ro/christmas/gift-finder", label: "Găsește un cadou de Crăciun" },
      { href: "/ro/christmas/wishlist", label: "Creează o listă de dorințe" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun" },
      { href: "/ro/christmas/santa-video", label: "Video personalizat de la Moș Crăciun" },
      { href: "/ro/christmas/cards", label: "Creează o felicitare de Crăciun" },
      { href: "/ro/christmas/messages", label: "Găsește un mesaj de Crăciun" },
    ],
    geo: {
      h2: "Ce poți crea cu TheDigitalGifter de Crăciun?",
      body:
        "TheDigitalGifter este un hub de creație de Crăciun. Poți găsi idei de cadouri cu Gift Finder, transforma o fotografie într-un portret de Crăciun pentru familie, cuplu sau animale, crea un video personalizat de la Moș Crăciun cu numele destinatarului, construi o listă de dorințe care se poate partaja, proiecta o felicitare cu foto și mesaj, scrie urări, decoră un brad digital și deschide surprize de Advent.",
    },
    sections: [
      {
        h2: "Găsește cadoul perfect de Crăciun",
        body:
          "Nu știi ce să cumperi? Gift Finder-ul de Crăciun întreabă pentru cine cumperi, ce îi place și ce buget ai. Primești idei de cadouri cu un motiv scurt pentru fiecare — inclusiv pentru cineva care pare să aibă deja totul.",
        linkHref: "/ro/christmas/gift-finder",
        linkLabel: "Găsește un cadou pe care chiar îl vor iubi",
      },
      {
        h2: "Creează fotografii magice de Crăciun",
        body:
          "Încarcă o fotografie clară și transform-o într-un portret festiv de Crăciun pentru familii, cupluri sau animale — inclusiv câini și pisici.",
        linkHref: "/ro/christmas/photo-generator",
        linkLabel: "Transformă fotografia în magie de Crăciun",
      },
      {
        h2: "Primește un mesaj personalizat de la Moș Crăciun",
        body:
          "Creează un video de Crăciun de la Moș Crăciun. Spune-i numele destinatarului și detalii opționale precum vârsta, ceva ce a făcut bine sau o dorință de Crăciun. Revizuiește mesajul, apoi creează videoul.",
        linkHref: "/ro/christmas/santa-video",
        linkLabel: "Creează un video personalizat de la Moș Crăciun",
      },
      {
        h2: "Creează o felicitare personalizată de Crăciun",
        body:
          "Combină o fotografie, un design festiv și un mesaj personal într-o felicitare pe care o poți descărca sau trimite digital.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Creează o felicitare pe care vor vrea să o păstreze",
      },
    ],
    faqs: [
      {
        q: "Ce pot crea de Crăciun cu TheDigitalGifter?",
        a: "Idei de cadouri, portrete de Crăciun pentru familii, cupluri și animale, un video personalizat de la Moș Crăciun, o listă de dorințe care se poate partaja, felicitări, mesaje, un brad digital și un calendar de Advent.",
      },
      {
        q: "Poate Moș Crăciun să spună numele copilului meu?",
        a: "Da. Începe cu prenumele pe pagina de Crăciun sau în experiența Santa Video, apoi adaugă detalii opționale înainte de a crea videoul.",
      },
      {
        q: "Am nevoie de cunoștințe de design?",
        a: "Nu. Fiecare experiență de Crăciun este ghidată — încarcă o fotografie, răspunde la câteva întrebări sau începe cu un nume.",
      },
      {
        q: "Funcționează pe telefon?",
        a: "Da. Hub-ul de Crăciun și experiențele de produs sunt create să funcționeze pe telefoane și pe desktop.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Video personalizat de la Moș Crăciun | Moș Crăciun spune numele",
    description:
      "Creează un video de Crăciun personalizat de la Moș Crăciun care poate include numele destinatarului și alte detalii pe care le oferi.",
    h1: "Creează un video personalizat de la Moș Crăciun",
    lede:
      "Creează un video de la Moș Crăciun cu numele lor, dorințe de Crăciun și momente speciale din an.",
    h2: "Mai multă magie de Crăciun",
    h2Body: "După video, multe familii creează și un portret sau o felicitare.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/santa-video", label: "Video Moș Crăciun" },
    ],
    links: [
      { href: "/ro/christmas", label: "Înapoi la Crăciun" },
      { href: "/ro/christmas/cards", label: "Felicitări de Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Portret de Crăciun" },
    ],
    geo: {
      h2: "Ce este un video personalizat de la Moș Crăciun?",
      body:
        "Un video personalizat de la Moș Crăciun este un mesaj video de Crăciun în care Moș Crăciun poate include numele destinatarului și alte detalii pe care le oferi. Pe TheDigitalGifter completezi un formular scurt, revizuiești mesajul, apoi creezi un video pe care îl poți descărca și partaja.",
    },
    sections: [
      {
        h2: "Un mesaj personalizat de la Moș Crăciun",
        body:
          "Creează un video de Crăciun de la Moș Crăciun pentru un copil, frați, familie sau pe cineva special. Moș Crăciun poate spune numele și poate include detalii opționale pe care le împărtășești.",
      },
      {
        h2: "Ce poate menționa Moș Crăciun?",
        body:
          "Poți personaliza cu numele destinatarului, vârsta opțională, ceva ce a făcut bine, o dorință de Crăciun, un detaliu în plus și limba. Limbile suportate azi sunt engleza și româna.",
        list: [
          "Numele destinatarului",
          "Vârsta (opțional)",
          "Ceva ce a făcut bine",
          "Dorința de Crăciun",
          "Detaliu personal în plus",
          "Limba: engleză sau română",
        ],
      },
      {
        h2: "Cum funcționează",
        body: "Spune-i Moșului despre ei, revizuiește mesajul, creează videoul, apoi descarcă sau partajează.",
        list: [
          "Spune-i Moșului despre ei",
          "Revizuiește mesajul",
          "Creează videoul",
          "Descarcă sau partajează",
        ],
      },
    ],
    faqs: [
      {
        q: "Poate Moș Crăciun să spună numele copilului meu?",
        a: "Da. Numele destinatarului este un câmp principal de personalizare și Moș Crăciun îl spune în video.",
      },
      {
        q: "Ce pot personaliza?",
        a: "Numele, vârsta opțională, ceva ce a făcut bine, dorința de Crăciun, un detaliu în plus și limba (engleză sau română).",
      },
      {
        q: "Ce limbi sunt suportate?",
        a: "Engleza și româna sunt suportate azi.",
      },
      {
        q: "Pot previzualiza mesajul înainte?",
        a: "Da. Poți revizui mesajul înainte de a crea videoul.",
      },
      {
        q: "Pot descărca sau partaja videoul?",
        a: "Da. Când videoul este gata, poți descărca MP4-ul și îl poți partaja.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Creator de felicitări de Crăciun | Felicitări personalizate",
    description:
      "Creează o felicitare de Crăciun personalizată pe care vor vrea să o păstreze — alege un design, adaugă mesajul și descarcă sau partajează.",
    h1: "Creează o felicitare de Crăciun pe care vor vrea să o păstreze",
    lede: "Adaugă fotografia, alege un stil de Crăciun și scrie ceva personal.",
    h2: "Cum faci o felicitare de Crăciun online",
    h2Body: "Alege un stil, adaugă o fotografie sau un portret, scrie mesajul, apoi descarcă PNG-ul.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/cards", label: "Felicitări" },
    ],
    links: [
      { href: "/ro/christmas/photo-generator", label: "Creează mai întâi un portret" },
      { href: "/ro/christmas/messages", label: "Găsește un mesaj de Crăciun" },
      { href: "/ro/christmas", label: "Hub de Crăciun" },
    ],
    geo: {
      h2: "Ce este un creator online de felicitări de Crăciun?",
      body:
        "Un creator online de felicitări de Crăciun te lasă să faci o felicitare personalizată cu o fotografie, un design festiv și mesajul tău. Pe TheDigitalGifter poți încărca o fotografie sau un portret de Crăciun, alege un stil, scrie sau cere ajutor pentru mesaj, apoi descarci un PNG sau trimiți felicitarea digital.",
    },
    sections: [
      {
        h2: "Creează o felicitare personalizată de Crăciun",
        body:
          "Alege un stil de felicitare, adaugă fotografia, scrie un mesaj și creează o felicitare digitală pe care o poți descărca sau partaja.",
      },
      {
        h2: "Folosește portretul tău de Crăciun",
        body:
          "Dacă ai creat deja un portret de Crăciun, îl poți aduce în creatorul de felicitări și îl poți completa cu un mesaj.",
        linkHref: "/ro/christmas/photo-generator",
        linkLabel: "Creează mai întâi un portret de Crăciun",
      },
      {
        h2: "Mesaje pentru felicitări de Crăciun",
        body:
          "Scrie cuvintele tale sau folosește ajutorul pentru mesaje. Pentru urări mai ghidate, generatorul de mesaje poate ajuta.",
        linkHref: "/ro/christmas/messages",
        linkLabel: "Găsește un mesaj de Crăciun",
      },
    ],
    faqs: [
      {
        q: "Pot încărca propria fotografie?",
        a: "Da. Încarcă o fotografie ca element central al felicitării de Crăciun.",
      },
      {
        q: "Pot folosi un portret de Crăciun?",
        a: "Da. Dacă ai creat un portret în generatorul foto, îl poți transfera în creatorul de felicitări.",
      },
      {
        q: "Mă puteți ajuta să scriu mesajul?",
        a: "Da. Folosește ajutorul pentru mesaje din maker sau vizitează generatorul de mesaje de Crăciun.",
      },
      {
        q: "Pot descărca felicitarea?",
        a: "Da. Descarcă un PNG de înaltă rezoluție pentru uz personal.",
      },
      {
        q: "Pot să o trimit digital?",
        a: "Da. Folosește opțiunile de partajare ale dispozitivului, WhatsApp, email sau copiază un link unde este disponibil.",
      },
    ],
  },
};

/** @returns {LocalizedSeoPage | null} */
export function getChristmasSeoContentRo(basePath) {
  return CHRISTMAS_SEO_CONTENT_RO[basePath] || null;
}
