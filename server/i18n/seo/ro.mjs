/**
 * Romanian Christmas SEO content — full 14-route pack.
 * Genuine RO copy written for production quality (not machine-translated filler).
 * Terminology is kept consistent across the whole pack: "Crăciun" and "Moș Crăciun".
 *
 * Product truth constraints reflected in this copy:
 * - Digital Christmas Tree: gift boxes hold personal written messages only (no photos/videos yet).
 * - Advent calendar: doors follow December 1–24, Europe/Bucharest time, with no catch-up for missed days.
 * - Gift Finder: curated gift ideas with typical price ranges — no live retailer inventory or stock.
 * - Santa Video: Romanian is a genuinely supported spoken language — Moș Crăciun can say the name in română.
 * - Christmas Messages: the generator genuinely supports Romanian wording.
 */

export const LOCALE = "ro";

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
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Crăciun la TheDigitalGifter | Cadouri, Foto, Moș Crăciun și Multe Altele",
    description:
      "Creează cadouri de Crăciun, portrete festive, videoclipuri de la Moș Crăciun, liste de dorințe, felicitări și surprize de Advent — experiențe digitale personalizate, toate la TheDigitalGifter.",
    h1: "Creează Ceva de Neuitat în Acest Crăciun",
    lede:
      "Descoperă cadouri de Crăciun, portrete foto, videoclipuri de la Moș Crăciun, brazi digitali, calendare de Advent, felicitări și mesaje — totul într-un singur loc, la TheDigitalGifter.",
    h2: "Experiențe de Crăciun",
    h2Body: "Alege un produs de Crăciun de mai jos și creează ceva personal în doar câteva minute.",
    breadcrumbs: [{ href: "/ro/christmas", label: "Crăciun" }],
    links: [
      { href: "/ro/christmas/gift-finder", label: "Găsește un cadou de Crăciun" },
      { href: "/ro/christmas/wishlist", label: "Creează o listă de dorințe" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun" },
      { href: "/ro/christmas/santa-video", label: "Video personalizat de la Moș Crăciun" },
      { href: "/ro/christmas/tree", label: "Construiește un brad digital" },
      { href: "/ro/christmas/advent", label: "Deschide calendarul de Advent" },
      { href: "/ro/christmas/cards", label: "Creează o felicitare de Crăciun" },
      { href: "/ro/christmas/messages", label: "Găsește un mesaj de Crăciun" },
    ],
    geo: {
      h2: "Ce poți crea de Crăciun cu TheDigitalGifter?",
      body:
        "TheDigitalGifter este un hub de creație pentru Crăciun. Poți găsi idei de cadouri cu Găsitorul de cadouri, transforma o fotografie într-un portret festiv pentru familie, cuplu sau animale de companie, crea un video personalizat de la Moș Crăciun care poate include numele destinatarului, construi o listă de dorințe pe care o poți partaja, proiecta o felicitare cu fotografie și mesaj propriu, scrie urări de Crăciun, decora un brad digital și deschide surprize zilnice de Advent. Pornește dintr-un singur loc și treci direct la experiența potrivită pentru persoana pe care o sărbătorești.",
    },
    sections: [
      {
        h2: "Găsește Cadoul Perfect de Crăciun",
        body:
          "Nu știi ce să cumperi? Găsitorul de cadouri de Crăciun te întreabă pentru cine cumperi, ce îi place, cum este ca persoană și cât vrei să cheltui. Primești idei de cadouri cu un motiv scurt pentru fiecare — inclusiv pentru cineva care pare să aibă deja de toate. Salvează ideile care îți plac într-o listă de dorințe când ești gata.",
        linkHref: "/ro/christmas/gift-finder",
        linkLabel: "Găsește un cadou pe care chiar îl vor iubi",
      },
      {
        h2: "Creează Fotografii Magice de Crăciun",
        body:
          "Încarcă o fotografie clară și transform-o într-un portret festiv de Crăciun. Poți crea look-uri pentru familii, cupluri și animale de companie — inclusiv rute dedicate pentru câini și pisici — apoi descarci privat sau continui direct într-o felicitare de Crăciun.",
        linkHref: "/ro/christmas/photo-generator",
        linkLabel: "Transformă fotografia în magie de Crăciun",
      },
      {
        h2: "Primește un Mesaj Personalizat de la Moș Crăciun",
        body:
          "Creează un video de Crăciun de la Moș Crăciun. Spune-i numele destinatarului și adaugă detalii opționale, precum vârsta, ceva ce a făcut bine anul acesta, un hobby sau o dorință de Crăciun. Revizuiește mesajul, apoi creează un video pe care îl poți descărca și partaja.",
        linkHref: "/ro/christmas/santa-video",
        linkLabel: "Creează un video personalizat de la Moș Crăciun",
      },
      {
        h2: "Creează și Partajează o Listă de Dorințe",
        body:
          "Construiește o listă de dorințe de Crăciun cu linkuri către produse sau urări scrise liber. Partajează un singur link simplu cu familia și prietenii. Cei care văd lista pot rezerva un cadou, ca să nu cumpere doi oameni același lucru, fără să strice surpriza pentru proprietarul listei.",
        linkHref: "/ro/christmas/wishlist",
        linkLabel: "Creează o listă de dorințe de Crăciun",
      },
      {
        h2: "Creează o Felicitare Personalizată de Crăciun",
        body:
          "Combină o fotografie, un design festiv de Crăciun și un mesaj personal într-o felicitare pe care o poți descărca sau trimite digital. Folosește propria fotografie sau un portret de Crăciun creat deja.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Creează o felicitare pe care vor vrea să o păstreze",
      },
      {
        h2: "Mai Multe Experiențe de Crăciun",
        body:
          "Poți construi și un brad digital de Crăciun cu surprize, deschide ușițele calendarului de Advent pe parcursul lunii decembrie și găsi cuvintele potrivite cu generatorul de mesaje.",
        list: [
          "Brad digital de Crăciun → /ro/christmas/tree",
          "Calendar de Advent → /ro/christmas/advent",
          "Mesaje de Crăciun → /ro/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "Ce pot crea de Crăciun cu TheDigitalGifter?",
        a: "Poți găsi idei de cadouri, transforma poze în portrete de Crăciun pentru familii, cupluri și animale, crea un video personalizat de la Moș Crăciun, construi o listă de dorințe de partajat, crea o felicitare, scrie mesaje, decora un brad digital și deschide surprize de Advent. Alege o experiență de pe această pagină și termină în câteva minute.",
      },
      {
        q: "Poate Moș Crăciun să spună numele copilului meu?",
        a: "Introdu prenumele pe această pagină de Crăciun sau deschide Video cu Moș Crăciun, adaugă detalii opționale precum vârsta, ceva ce au făcut bine, un hobby sau o dorință, apoi creează videoul. Moș Crăciun vorbește personalizat în română și engleză.",
      },
      {
        q: "Am nevoie de cunoștințe de design?",
        a: "Nu ai nevoie de design. Fiecare experiență de Crăciun te ghidează pas cu pas — încarci o fotografie, răspunzi la câteva întrebări sau începi cu un nume — iar pagina face restul.",
      },
      {
        q: "Este pentru cadouri digitale, fizice sau ambele?",
        a: "Ambele. Folosește Găsitorul de cadouri și lista de dorințe pentru cumpărături din orice magazin, apoi creează portrete digitale, felicitări și videoclipuri de la Moș Crăciun pe care le poți descărca sau partaja imediat.",
      },
      {
        q: "Funcționează pe telefon?",
        a: "Da — hub-ul de Crăciun și experiențele de produs sunt făcute întâi pentru telefon și funcționează la fel de bine pe desktop.",
      },
      {
        q: "Poza familiei mele este privată?",
        a: "Încărcările sunt folosite ca să creezi portretul sau felicitarea. Experiențele pentru copii sunt privacy-first și presupun un părinte sau tutore. Când rezultatul e gata, îl descarci privat — nu publicăm pozele tale.",
      },
      {
        q: "Cât durează să creez ceva?",
        a: "Majoritatea experiențelor durează câteva minute. Găsitorul de cadouri și mesajele sunt aproape instant. Portretele, felicitările și video-urile cu Moș te ghidează pas cu pas; creațiile plătite continuă după checkout.",
      },
      {
        q: "Am nevoie de un cont ca să încep?",
        a: "Poți explora și începe să creezi imediat. Unele experiențe cer email la înscriere sau checkout ca să salvezi progresul, să primești rezultatul sau să te alături Christmas Club.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Găsitorul de Cadouri de Crăciun | Găsește Cadoul Perfect",
    description:
      "Găsește idei de cadouri de Crăciun pline de sens, potrivite pentru cine cumperi, interesele lor și bugetul tău.",
    h1: "Găsește un Cadou de Crăciun Pe Care Chiar Îl Vor Iubi",
    lede:
      "Răspunde la câteva întrebări despre persoana pentru care cumperi și primești idei de cadouri de Crăciun potrivite intereselor, personalității și bugetului ei.",
    h2: "Alte instrumente de Crăciun",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/gift-finder", label: "Găsitor de cadouri" },
    ],
    links: [
      { href: "/ro/christmas/wishlist", label: "Creează o listă de dorințe" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun" },
      { href: "/ro/christmas/tree", label: "Brad digital de Crăciun" },
      { href: "/ro/christmas", label: "Toate experiențele de Crăciun" },
    ],
    geo: {
      h2: "Ce este un Găsitor de cadouri de Crăciun?",
      body:
        "Un Găsitor de cadouri de Crăciun este un instrument ghidat care recomandă idei de cadouri pe baza persoanei pentru care cumperi, a intereselor și personalității ei, plus bugetul tău. Pe TheDigitalGifter răspunzi la un set scurt de întrebări și primești idei alese cu grijă, cu motive clare pentru care s-ar potrivi — apoi poți rafina răspunsurile sau salva ideile într-o listă de dorințe.",
    },
    sections: [
      {
        h2: "Cum Funcționează Găsitorul de Cadouri de Crăciun",
        body:
          "Alegi destinatarul, îi descrii interesele și personalitatea, stabilești un buget și, opțional, adaugi un detaliu personal. Găsitorul îți întoarce idei de cadouri ordonate, cu explicații scurte. Poți rafina răspunsurile, poți relua totul de la capăt sau poți salva idei direct în lista ta de dorințe de Crăciun.",
        list: [
          "Pentru cine cumperi",
          "Interese și personalitate",
          "Interval de buget",
          "Idei de cadouri personalizate, cu motive",
        ],
      },
      {
        h2: "Găsește Cadouri După Destinatar",
        body:
          "Găsitorul acoperă cele mai frecvente relații din cumpărăturile de Crăciun, astfel încât recomandările rămân potrivite. Folosește instrumentul pentru mamă, tată, soție, soț, iubită, iubit, copii, adolescenți, bunici, prieteni, colegi și mulți alții. Paginile dedicate fiecărui destinatar nu sunt încă live — pornește Găsitorul și alege destinatarul direct acolo.",
        list: [
          "Mamă",
          "Tată",
          "Soție",
          "Soț",
          "Iubită",
          "Iubit",
          "Copii",
          "Adolescenți",
          "Bunici",
          "Prieteni",
          "Colegi",
        ],
      },
      {
        h2: "Găsește Cadouri de Crăciun După Buget",
        body:
          "Alege un interval de cheltuială, de exemplu sub 100 lei, 100–250 lei, 250–500 lei, 500–1000 lei, peste 1000 lei sau fără un buget strict. Recomandările sunt idei de cadouri cu intervale de preț tipice — nu stoc live de la retaileri și nu o garanție de disponibilitate.",
      },
      {
        h2: "Cadouri Pentru Cineva Care Are Deja de Toate",
        body:
          "Când cineva pare să aibă deja „tot ce trebuie”, cadourile de Crăciun cu adevărat utile țin de obicei de experiențe, obiecte personalizate cu suflet, upgrade-uri pentru un hobby, momente sentimentale sau lucruri practice, dar premium. Alegerea personalității „Are deja de toate” îndreaptă Găsitorul spre astfel de direcții, în loc de idei generice.",
      },
      {
        h2: "Salvează Ideile în Lista de Dorințe",
        body:
          "Ți-a plăcut o idee? Salveaz-o în lista ta de dorințe de Crăciun și partajeaz-o cu familia, ca toată lumea să rămână coordonată la cumpărături.",
        linkHref: "/ro/christmas/wishlist",
        linkLabel: "Deschide creatorul de liste de dorințe",
      },
    ],
    faqs: [
      {
        q: "Cum funcționează Găsitorul de cadouri de Crăciun?",
        a: "Răspunzi la câteva întrebări scurte despre persoana pentru care cumperi, interesele, personalitatea și bugetul ei. Apoi vezi idei de cadouri alese cu grijă, fiecare cu un motiv clar pentru care s-ar potrivi.",
      },
      {
        q: "Pot căuta după buget?",
        a: "Da. Intervalul de buget este un pas important în Găsitor.",
      },
      {
        q: "Pot găsi cadouri pentru cineva care are deja de toate?",
        a: "Da. Printre opțiunile de personalitate se numără „Are deja de toate”, care îndreaptă ideile spre experiențe, personalizare și obiecte cu semnificație.",
      },
      {
        q: "Îl pot folosi pentru copii sau adolescenți?",
        a: "Da. Alege Copil sau Adolescent (sau Fiică/Fiu cu un interval de vârstă), astfel încât ideile să rămână potrivite vârstei.",
      },
      {
        q: "Pot salva idei în lista mea de dorințe?",
        a: "Da. Folosește opțiunea Salvează în listă lângă o idee, pentru a o adăuga în /ro/christmas/wishlist.",
      },
      {
        q: "Recomandările sunt cu adevărat personalizate?",
        a: "Da. Recomandările folosesc destinatarul, vârsta, interesele, personalitatea, bugetul și un detaliu personal opțional.",
      },
      {
        q: "Afișează produse reale, din magazine?",
        a: "În acest moment Găsitorul arată idei de cadouri alese cu grijă, cu intervale de preț tipice. Prețurile live de la retaileri, stocul și fluxurile de la magazine nu sunt încă conectate — nu inventăm prețuri exacte sau stoc real.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Creator de Liste de Dorințe de Crăciun | Creează și Partajează",
    description:
      "Creează o listă de dorințe de Crăciun, adaugă cadouri de oriunde și partajează un singur link simplu cu familia și prietenii.",
    h1: "Creează o Listă de Dorințe și Partajează un Singur Link Simplu",
    lede:
      "Construiește o listă de dorințe de Crăciun în câteva minute. Adaugă cadouri din orice magazin sau scrie-ți propriile urări, apoi trimite un singur link familiei și prietenilor.",
    h2: "Cum funcționează",
    h2Body: "Creezi lista, adaugi urări, partajezi un singur link și lași oamenii să se coordoneze fără să strice surpriza.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/wishlist", label: "Listă de dorințe" },
    ],
    links: [
      { href: "/ro/christmas/gift-finder", label: "Încearcă Găsitorul de cadouri" },
      { href: "/ro/christmas/tree", label: "Pune cadouri sub un brad digital" },
      { href: "/ro/christmas/photo-generator", label: "Adaugă un portret de Crăciun" },
      { href: "/ro/christmas", label: "Înapoi la Crăciun" },
    ],
    geo: {
      h2: "Ce este o listă de dorințe online de Crăciun?",
      body:
        "O listă de dorințe online de Crăciun este o listă de cadouri sau experiențe pe care cineva și-ar dori să le primească, ușor de partajat. Pe TheDigitalGifter creezi o listă, adaugi urări din linkuri către produse sau text liber, partajezi un singur link cu familia și prietenii și îi lași pe alții să rezerve un cadou, ca lucrurile să rămână coordonate, fără să strice surpriza.",
    },
    sections: [
      {
        h2: "Creează o Listă de Dorințe de Crăciun Online",
        body:
          "Dă un nume listei tale, adaugă urări și păstrează fiecare idee de Crăciun într-un singur loc, în loc să răspândești linkuri prin conversații. Poți începe rapid și poți continua să editezi oricând.",
      },
      {
        h2: "Adaugă Orice Îți Dorești",
        body:
          "Lipește un link către un produs, aproape din orice magazin, scrie o urare manuală, adaugă notițe sau include experiențe și idei făcute manual. Dacă un link nu poate fi citit automat, poți salva urarea și fără el, scriind-o direct.",
      },
      {
        h2: "Partajează un Singur Link Simplu",
        body:
          "Activează partajarea și trimite un singur link către listă prin copiere, WhatsApp, email sau meniul de partajare al telefonului. Listele partajate sunt accesibile celor care au linkul și nu sunt gândite pentru motoarele de căutare.",
      },
      {
        h2: "Evită Cadourile Duplicate de Crăciun",
        body:
          "Cei care văd lista pot apăsa „Eu cumpăr asta” pentru a rezerva un cadou. Rezervările rămân anonime pentru proprietarul listei, astfel încât surpriza rămâne intactă, iar familia evită să cumpere același lucru de două ori.",
      },
      {
        h2: "Liste de Dorințe de Crăciun Pentru Copii și Familii",
        body:
          "Creează o listă pentru tine, pentru copilul tău sau pentru altcineva, apoi partajeaz-o cu bunicii și prietenii. Combin-o cu Găsitorul de cadouri atunci când nu ești sigur ce să ceri.",
        linkHref: "/ro/christmas/gift-finder",
        linkLabel: "Încearcă Găsitorul de cadouri de Crăciun",
      },
    ],
    faqs: [
      {
        q: "Cum creez o listă de dorințe de Crăciun?",
        a: "Deschide pagina Listă de dorințe de Crăciun, alege un titlu și creează lista. Poți adăuga urări imediat după aceea.",
      },
      {
        q: "Pot adăuga cadouri din orice magazin?",
        a: "Da. Lipește un link obișnuit către un produs sau adaugă cadoul manual, dacă pagina nu poate fi citită automat.",
      },
      {
        q: "Pot adăuga urări fără un link?",
        a: "Da. Scrie orice urare — experiențe, idei făcute manual sau un simplu „Surprinde-mă”.",
      },
      {
        q: "Pot partaja un singur link pentru toată lista?",
        a: "Da. Activează partajarea și trimite linkul familiei și prietenilor.",
      },
      {
        q: "Pot oamenii să rezerve cadouri?",
        a: "Da. Cei care văd lista pot rezerva un cadou, ca ceilalți să știe că este deja acoperit.",
      },
      {
        q: "Voi ști cine a cumpărat un anumit cadou?",
        a: "Nu. Rezervările rămân anonime, ca surpriza să rămână intactă.",
      },
      {
        q: "Pot crea o listă pentru copilul meu?",
        a: "Da. Alege pentru cine este lista atunci când o creezi, apoi partajează linkul cu rudele.",
      },
      {
        q: "Pot edita lista după ce am partajat-o?",
        a: "Da. Adaugi, editezi, reordonezi sau elimini urări oricând. Cei care au linkul văd modificările imediat.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "Generator Foto de Crăciun cu AI | Familie, Cupluri și Animale",
    description:
      "Transformă fotografia ta preferată într-un portret magic de Crăciun. Creează fotografii festive pentru familie, cupluri și animale de companie în câteva minute.",
    h1: "Transformă Fotografia Ta în Magie de Crăciun",
    lede:
      "Încarcă o fotografie, alege o scenă festivă de Crăciun și creează un portret personalizat pe care îl poți descărca și partaja privat.",
    h2: "Stiluri foto de Crăciun",
    h2Body: "Creează portrete pentru familie, cupluri, animale de companie, câini și pisici, într-o singură experiență foto de Crăciun.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
    ],
    links: [
      { href: "/ro/christmas/family", label: "Portrete de Crăciun pentru familie" },
      { href: "/ro/christmas/couples", label: "Portrete de Crăciun pentru cuplu" },
      { href: "/ro/christmas/pets", label: "Portrete de Crăciun pentru animale" },
      { href: "/ro/christmas/dogs", label: "Portrete de Crăciun pentru câini" },
      { href: "/ro/christmas/cats", label: "Portrete de Crăciun pentru pisici" },
      { href: "/ro/christmas/cards", label: "Transformă un portret în felicitare" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun cu AI?",
      body:
        "Un generator foto de Crăciun cu AI transformă o fotografie reală, încărcată de tine, într-un portret festiv de Crăciun. Pe TheDigitalGifter alegi cine apare în fotografie, alegi un stil de Crăciun și creezi un portret descărcabil pentru familie, cuplu, o persoană sau un animal de companie — privat, în mod implicit.",
    },
    sections: [
      {
        h2: "Transformă Fotografia Într-un Portret de Crăciun",
        body:
          "Încarcă o fotografie preferată, alege tipul de subiect, alege un look de Crăciun și creează un portret festiv pe care îl poți descărca. Scopul este o imagine de sărbătoare care încă seamănă cu oamenii sau animalele pe care le iubești.",
      },
      {
        h2: "Exemple de Fotografii de Crăciun",
        body:
          "Exemplele demonstrative arată direcții obișnuite pentru portrete de Crăciun. Sunt mostre de inspirație, nu fotografii ale clienților.",
        list: [
          "Fotografie de familie de Crăciun — un portret de grup într-o scenă caldă și festivă",
          "Portret de cuplu de Crăciun — un portret romantic pentru două persoane",
          "Portret de Crăciun pentru câine — un portret festiv centrat pe câine",
          "Portret de Crăciun pentru pisică — un portret festiv centrat pe pisică",
          "Familie plus animal — oameni și un animal de companie în același cadru de Crăciun",
        ],
      },
      {
        h2: "Stiluri Foto de Crăciun",
        body:
          "Stilurile de Crăciun disponibile includ Crăciun Cald, Țară a Minunilor de Iarnă, Crăciun de Lux, Dimineață de Crăciun, Cabană Înzăpezită, Crăciun Clasic, Crăciun Alb Elegant și Târg de Crăciun. Alege look-ul care se potrivește amintirii pe care vrei să o creezi.",
      },
      {
        h2: "Ce Fotografii Funcționează Cel Mai Bine?",
        body:
          "Folosește o fotografie clară, cu fețe vizibile (sau un animal clar vizibil), lumină bună și suficientă claritate, astfel încât toți cei pe care vrei să îi incluzi să rămână de recunoscut. Evită blur puternic, cadre tăiate agresiv sau fotografii în care persoanele importante sunt ascunse.",
      },
      {
        h2: "Fotografii de Crăciun Pentru Familii, Cupluri și Animale",
        body:
          "Ai nevoie de un punct de plecare mai specific? Folosește rutele dedicate pentru familie, cupluri, animale, câini și pisici — sau continuă aici, în generatorul complet.",
        list: [
          "Portrete de Crăciun pentru familie → /ro/christmas/family",
          "Portrete de Crăciun pentru cuplu → /ro/christmas/couples",
          "Portrete de Crăciun pentru animale → /ro/christmas/pets",
          "Portrete de Crăciun pentru câini → /ro/christmas/dogs",
          "Portrete de Crăciun pentru pisici → /ro/christmas/cats",
          "Transformă un portret în felicitare de Crăciun → /ro/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "Cum funcționează generatorul foto de Crăciun?",
        a: "Încarci o fotografie, alegi cine apare în ea, alegi un stil de Crăciun, apoi creezi portretul, după finalizarea comenzii, dacă fluxul produsului o cere.",
      },
      {
        q: "Ce fotografie ar trebui să încarc?",
        a: "O fotografie clară, cu fețe vizibile sau un animal clar vizibil, funcționează cel mai bine. Lumina bună ajută. Evită blur-ul puternic.",
      },
      {
        q: "Pot crea o fotografie de familie de Crăciun?",
        a: "Da. Alege familie ca tip de subiect sau pornește direct din ruta dedicată familiei.",
      },
      {
        q: "Pot crea un portret de Crăciun al câinelui sau pisicii mele?",
        a: "Da. Subiectele de tip animal sunt disponibile, cu rute dedicate pentru câini și pisici, pentru un start mai clar.",
      },
      {
        q: "Pot include mai multe persoane?",
        a: "Da, pentru fluxurile de familie și cuplu. Încarcă o fotografie care include pe toată lumea care trebuie să apară.",
      },
      {
        q: "Pot încerca stiluri diferite?",
        a: "Da. Alege dintre stilurile de Crăciun disponibile pe pagină, înainte de a crea portretul.",
      },
      {
        q: "Pot descărca rezultatul?",
        a: "Da. Când portretul este gata, îl descarci din ecranul de rezultat.",
      },
      {
        q: "Ce se întâmplă cu fotografia mea încărcată?",
        a: "Fotografiile încărcate și rezultatele sunt private, în mod implicit. Nu există o galerie publică. Accesul se face prin fluxul comenzii tale.",
      },
    ],
  },

  "/christmas/family": {
    title: "Generator Foto de Crăciun pentru Familie | Portrete de Familie",
    description:
      "Creează un portret de familie personalizat de Crăciun din fotografia ta preferată. Alege o scenă festivă și transformă fotografia într-o amintire de sărbătoare.",
    h1: "Transformă Fotografia de Familie într-un Portret Magic de Crăciun",
    lede:
      "Creează un portret de familie personalizat de Crăciun din fotografia ta preferată. Alege o scenă festivă și transformă fotografia într-o amintire de sărbătoare.",
    h2: "Mai multe portrete de Crăciun",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
      { href: "/ro/christmas/family", label: "Familie" },
    ],
    links: [
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun cu AI" },
      { href: "/ro/christmas/couples", label: "Portrete de Crăciun pentru cuplu" },
      { href: "/ro/christmas/pets", label: "Portrete de Crăciun pentru animale" },
      { href: "/ro/christmas/cards", label: "Creator de felicitări de Crăciun" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun pentru familie?",
      body:
        "Un generator foto de Crăciun pentru familie transformă o singură fotografie de familie încărcată într-un portret festiv de grup. Pe TheDigitalGifter încarci o fotografie clară a familiei tale, alegi un stil de Crăciun gândit pentru mai multe persoane și creezi un portret descărcabil — privat, în mod implicit, cu posibilitatea de a continua direct într-o felicitare.",
    },
    sections: [
      {
        h2: "Creează un Portret de Familie de Crăciun",
        body:
          "Această experiență este construită special pentru familii, nu un look generic pentru o singură persoană. Încarci o fotografie de grup, alegi o atmosferă de Crăciun și creezi un portret care are grijă să păstreze pe toată lumea în cadru.",
      },
      {
        h2: "Exemple de Fotografii de Familie de Crăciun",
        body:
          "Exemplele demonstrative arată direcții pentru portrete de familie de Crăciun. Sunt mostre de inspirație, nu fotografii ale clienților.",
        list: [
          "Părinți cu copii într-un living cald, decorat de Crăciun",
          "Familie de trei sau patru persoane, lângă un brad decorat",
          "Reuniune de familie mai numeroasă, într-o scenă festivă",
          "Portrete multi-generaționale, cu bunici incluși",
          "Familie plus un animal de companie clar vizibil, în același cadru",
        ],
      },
      {
        h2: "Stiluri de Crăciun Pentru Familii",
        body:
          "Stilurile disponibile pentru familie includ Crăciun Clasic de Familie, Șemineu Cald, Țară a Minunilor de Iarnă, Crăciun Elegant, Dimineață de Crăciun, Crăciun de Lux, Film de Crăciun și Crăciun Vintage de Familie.",
      },
      {
        h2: "Ce Fotografii de Familie Funcționează Cel Mai Bine?",
        body:
          "Folosește o fotografie de grup clară, cu fețe vizibile, lumină bună și toți cei pe care vrei să îi incluzi ușor de recunoscut. Evită blur puternic, cadre tăiate agresiv sau fotografii în care persoane importante sunt ascunse.",
      },
      {
        h2: "Felicitări de Crăciun cu Portretul de Familie",
        body:
          "Când portretul de familie este gata, poți continua direct în Creatorul de felicitări de Crăciun și îl poți completa cu un mesaj.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Transformă portretul de familie într-o felicitare",
      },
      {
        h2: "Mai Multe Portrete de Crăciun",
        body:
          "Cauți un alt subiect? Pornește din generatorul foto complet sau treci direct la cupluri și animale.",
        list: [
          "Generator foto de Crăciun cu AI → /ro/christmas/photo-generator",
          "Portrete de Crăciun pentru cuplu → /ro/christmas/couples",
          "Portrete de Crăciun pentru animale → /ro/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Pot crea un portret de Crăciun dintr-o singură fotografie de familie?",
        a: "Da. Încarcă o fotografie clară a familiei, alege un stil de Crăciun și creează portretul.",
      },
      {
        q: "Pot include mai multe persoane?",
        a: "Da. Această rută este gândită pentru grupuri. Păstrează pe toată lumea clar vizibilă în fotografia originală.",
      },
      {
        q: "Pot include bunicii?",
        a: "Da. Fotografiile multi-generaționale — inclusiv bunici și bebeluși — sunt binevenite, atât timp cât fețele sunt vizibile.",
      },
      {
        q: "Pot include un animal de companie din familie?",
        a: "Da, dacă animalul este clar vizibil în fotografia de familie. Pentru portrete dedicate exclusiv animalelor, folosește experiențele pentru Animale, Câini sau Pisici.",
      },
      {
        q: "Ce fotografii funcționează cel mai bine?",
        a: "Fotografii clare, cu fețe vizibile, lumină bună și toți cei pe care vrei să îi incluzi. Evită blur-ul puternic.",
      },
      {
        q: "Pot încerca mai multe stiluri de Crăciun?",
        a: "Da. Alege dintre stilurile de Crăciun pentru familie de pe pagină, iar după crearea unui portret poți încerca și un alt stil.",
      },
      {
        q: "Pot descărca portretul finalizat?",
        a: "Da. Când portretul este gata, îl descarci din ecranul de rezultat.",
      },
      {
        q: "Îl pot folosi într-o felicitare de Crăciun?",
        a: "Da. Transferul portretului în Creatorul de felicitări de Crăciun este disponibil.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Generator Foto de Crăciun pentru Cuplu | Portrete Romantice",
    description:
      "Creează un portret romantic de cuplu de Crăciun din fotografia voastră. Perfect pentru primul Crăciun împreună sau ca cadou personalizat pentru cuplu.",
    h1: "Creează un Portret Magic de Crăciun Împreună",
    lede:
      "Încarcă o singură fotografie cu voi doi și creează un portret romantic de cuplu de Crăciun — privat, în mod implicit.",
    h2: "Mai multe portrete de Crăciun",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
      { href: "/ro/christmas/couples", label: "Cupluri" },
    ],
    links: [
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun cu AI" },
      { href: "/ro/christmas/family", label: "Portrete de Crăciun pentru familie" },
      { href: "/ro/christmas/pets", label: "Portrete de Crăciun pentru animale" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun pentru cuplu?",
      body:
        "Un generator foto de Crăciun pentru cuplu transformă o fotografie cu două persoane într-un portret romantic sau cald, în spirit de Crăciun. Pe TheDigitalGifter încarci o singură fotografie cu voi doi, alegi un stil de Crăciun pentru cuplu și creezi un portret descărcabil, pe care îl poți partaja privat sau folosi într-o felicitare.",
    },
    sections: [
      {
        h2: "Creează un Portret de Crăciun Împreună",
        body:
          "Această experiență este pentru două persoane — parteneri, cupluri logodite, soț și soție sau iubit și iubită. Încarcă o singură fotografie cu voi doi clar vizibili, alege un look de Crăciun și creează un portret gândit exact pentru voi doi.",
      },
      {
        h2: "Idei de Fotografii de Cuplu de Crăciun",
        body:
          "Situații în care acest portret se potrivește de obicei — ca sursă de inspirație, nu ca moduri separate ale produsului:",
        list: [
          "Primul Crăciun împreună",
          "Portret de Crăciun pentru un cuplu logodit",
          "Portret de sărbători pentru soț și soție",
          "Fotografie de Crăciun pentru iubit și iubită",
          "Surpriză de Crăciun pentru o relație la distanță, de partajat digital",
          "Fotografie de cuplu pentru felicitarea de Crăciun",
        ],
      },
      {
        h2: "Stiluri Romantice de Crăciun",
        body:
          "Stilurile disponibile pentru cuplu includ Ninsoare Romantică, Șemineu Cald, Film de Crăciun, Crăciun Elegant, Oraș de Iarnă, Târg de Crăciun, Portret Clasic și Crăciun Vintage.",
      },
      {
        h2: "Ce Fotografii de Cuplu Funcționează Cel Mai Bine?",
        body:
          "Folosește o singură fotografie clară, în care ambele fețe sunt vizibile și niciuna dintre persoane nu este tăiată drastic din cadru. Lumina bună ajută. Un selfie poate funcționa atât timp cât ambele persoane rămân ușor de recunoscut.",
      },
      {
        h2: "Transformă-l într-o Felicitare de Crăciun",
        body:
          "După ce ai creat un portret de cuplu, îl poți aduce în Creatorul de felicitări de Crăciun.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Transformă portretul de cuplu într-o felicitare",
      },
      {
        h2: "Portrete de Crăciun Legate",
        body:
          "Ai nevoie de un portret de familie sau de animal în loc?",
        list: [
          "Portrete de Crăciun pentru familie → /ro/christmas/family",
          "Generator foto de Crăciun cu AI → /ro/christmas/photo-generator",
          "Portrete de Crăciun pentru animale → /ro/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Pot folosi un selfie?",
        a: "Da, atât timp cât ambele persoane sunt clar vizibile și ușor de recunoscut în aceeași fotografie.",
      },
      {
        q: "Rămân ambele persoane recunoscute?",
        a: "Acesta este scopul. Pornește de la o fotografie clară cu ambele fețe — evită blur-ul puternic sau situația în care una dintre persoane iese aproape din cadru.",
      },
      {
        q: "Pot crea un portret romantic de Crăciun?",
        a: "Da. Alege stiluri romantice sau calde pentru cuplu, precum Ninsoare Romantică, Șemineu Cald sau Crăciun Elegant.",
      },
      {
        q: "Pot încerca stiluri diferite?",
        a: "Da. Alege dintre stilurile de cuplu de Crăciun de pe pagină, înainte de a crea portretul.",
      },
      {
        q: "Pot folosi rezultatul într-o felicitare de Crăciun?",
        a: "Da. Transferul portretului în Creatorul de felicitări de Crăciun este disponibil.",
      },
      {
        q: "Pot să îl descarc?",
        a: "Da. Descarci portretul de cuplu finalizat din ecranul de rezultat, când este gata.",
      },
      {
        q: "Ce fel de fotografie ar trebui să încarc?",
        a: "O singură fotografie clară, cu voi doi în ea. Fețele ar trebui să fie vizibile; funcționează JPEG, PNG sau WebP.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Generator Foto de Crăciun pentru Animale | Portrete Festive",
    description:
      "Transformă fotografia animalului tău de companie într-un portret festiv de Crăciun. Câini și pisici sunt binevenite — privat, în mod implicit.",
    h1: "Transformă Animalul Tău în Magie de Crăciun",
    lede:
      "Încarcă o fotografie clară a animalului tău de companie și creează un portret festiv de Crăciun pentru câini sau pisici.",
    h2: "Portrete de Crăciun pe specii",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
      { href: "/ro/christmas/pets", label: "Animale" },
    ],
    links: [
      { href: "/ro/christmas/dogs", label: "Portrete de Crăciun pentru câini" },
      { href: "/ro/christmas/cats", label: "Portrete de Crăciun pentru pisici" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun cu AI" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun pentru animale?",
      body:
        "Un generator foto de Crăciun pentru animale transformă fotografia unui câine, unei pisici sau a altui animal de companie într-un portret festiv de Crăciun. Pe TheDigitalGifter, pagina Animale este hub-ul pentru portretele festive ale animalelor, cu rute specializate pentru câini și pisici, rezultate descărcabile și posibilitatea de a continua într-o felicitare de Crăciun.",
    },
    sections: [
      {
        h2: "Transformă Animalul Tău în Magie de Crăciun",
        body:
          "Încarcă o fotografie clară a animalului, alege un stil de Crăciun pentru animale și creează un portret festiv al prietenului tău blănos. Acesta este hub-ul general pentru animale, nu un pachet tematic separat.",
      },
      {
        h2: "Portrete de Crăciun Pentru Câini și Pisici",
        body:
          "Ai nevoie de un start mai clar pentru o singură specie? Folosește rutele specializate pentru câini sau pisici — te ajută să validezi fotografia și păstrează experiența centrată pe câine sau pe pisică.",
        list: [
          "Generator foto de Crăciun pentru câini → /ro/christmas/dogs",
          "Generator foto de Crăciun pentru pisici → /ro/christmas/cats",
        ],
      },
      {
        h2: "Exemple de Fotografii de Crăciun cu Animale",
        body:
          "Direcții demonstrative pentru portrete de Crăciun cu animale. Mostrele sunt de inspirație, nu fotografii ale clienților.",
        list: [
          "Portret de Crăciun pentru câine, într-o scenă festivă",
          "Portret de Crăciun pentru pisică, lângă brad sau șemineu",
          "Stiluri cu pulover cald sau inspirate de Moș Crăciun pentru animale",
        ],
      },
      {
        h2: "Stiluri de Crăciun Pentru Animale",
        body:
          "Stilurile disponibile pentru animale includ Animal Moș Crăciun, Crăciun Cald, Polul Nord, Pulover de Crăciun, Portret pe Zăpadă, Felicitare de Crăciun, Crăciun Regal și Crăciun Vintage.",
      },
      {
        h2: "Ce Fotografii de Animale Funcționează Cel Mai Bine?",
        body:
          "Alege o fotografie clară, cu fața și ochii animalului vizibili, lumină bună și fără blur puternic. Dacă vrei mai mult de un animal în cadru, asigură-te că fiecare este vizibil în fotografia încărcată.",
      },
      {
        h2: "Felicitări de Crăciun cu Animale",
        body:
          "Poți aduce un portret de animal finalizat în Creatorul de felicitări de Crăciun.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Transformă portretul animalului într-o felicitare",
      },
    ],
    faqs: [
      {
        q: "Pot crea un portret de Crăciun al câinelui meu?",
        a: "Da. Începe aici sau accesează pagina dedicată portretelor de Crăciun pentru câini, pentru o rută centrată pe câine.",
      },
      {
        q: "Pot crea unul pentru pisica mea?",
        a: "Da. Folosește acest hub pentru animale sau pagina dedicată portretelor de Crăciun pentru pisici.",
      },
      {
        q: "Pot include mai mult de un animal?",
        a: "Dacă mai multe animale sunt clar vizibile într-o singură fotografie, poți încerca acea încărcare. Rezultatele sunt mai bune când fața fiecărui animal este ușor de văzut.",
      },
      {
        q: "Mă pot include și pe mine, alături de animal?",
        a: "Această rută este optimizată pentru animal ca personaj principal. Pentru cadre de familie cu oameni și animal, experiența Familie de Crăciun este adesea un punct de plecare mai potrivit.",
      },
      {
        q: "Ce fotografii funcționează cel mai bine?",
        a: "Fotografii clare de animale, cu ochi și față vizibile, lumină bună și blur redus.",
      },
      {
        q: "Pot descărca imaginea?",
        a: "Da. Descarci din ecranul de rezultat, când portretul animalului este gata.",
      },
      {
        q: "Îl pot folosi pe o felicitare de Crăciun?",
        a: "Da. Transferul portretului în Creatorul de felicitări de Crăciun este disponibil.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Generator Foto de Crăciun pentru Câini | Portrete Festive",
    description:
      "Creează un portret magic de Crăciun al câinelui tău dintr-o fotografie clară. Verificat pe specie și privat, în mod implicit.",
    h1: "Creează un Portret Magic de Crăciun al Câinelui Tău",
    lede:
      "Încarcă o fotografie clară a câinelui, alege un stil festiv și creează un portret festiv de Crăciun pentru câini.",
    h2: "Portrete de animale legate",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
      { href: "/ro/christmas/pets", label: "Animale" },
      { href: "/ro/christmas/dogs", label: "Câini" },
    ],
    links: [
      { href: "/ro/christmas/cats", label: "Portrete de Crăciun pentru pisici" },
      { href: "/ro/christmas/pets", label: "Toate portretele de Crăciun pentru animale" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun cu AI" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun pentru câini?",
      body:
        "Un generator foto de Crăciun pentru câini creează un portret festiv de sărbătoare dintr-o fotografie a câinelui tău. Pe TheDigitalGifter încarci o fotografie clară, alegi un stil de Crăciun pentru animale și descarci un portret centrat pe câine — cu posibilitatea de a continua într-o felicitare de Crăciun.",
    },
    sections: [
      {
        h2: "Creează un Portret de Crăciun al Câinelui Tău",
        body:
          "Această pagină este dedicată exclusiv câinilor. Încarci o fotografie a câinelui tău, alegi un stil de Crăciun și creezi un portret festiv care păstrează câinele ca subiect principal, clar vizibil. Dacă fotografia pare a fi o pisică, vei fi îndrumat spre experiența dedicată pisicilor.",
      },
      {
        h2: "Exemple de Portrete de Crăciun cu Câini",
        body:
          "Direcții demonstrative pentru portrete de Crăciun cu câini — mostre de inspirație, nu fotografii ale clienților.",
        list: [
          "Câine lângă un brad de Crăciun decorat",
          "Portret cald, lângă șemineu, cu câinele de Crăciun",
          "Portret de Crăciun cu câinele, în zăpadă",
          "Portret în stil Moș Crăciun sau cu pulover festiv pentru câine",
        ],
      },
      {
        h2: "Stiluri de Crăciun Pentru Câini",
        body:
          "Portretele pentru câini folosesc setul de stiluri de Crăciun pentru animale: Animal Moș Crăciun, Crăciun Cald, Polul Nord, Pulover de Crăciun, Portret pe Zăpadă, Felicitare de Crăciun, Crăciun Regal și Crăciun Vintage.",
      },
      {
        h2: "Cum Alegi o Fotografie Bună cu Câinele Tău",
        body:
          "Alege o fotografie în care ochii și fața câinelui sunt vizibili, capul nu este tăiat agresiv, iar blur-ul este minim. Pentru mai mulți câini, asigură-te că fiecare câine pe care vrei să îl incluzi este clar vizibil în cadru.",
      },
      {
        h2: "Felicitări de Crăciun cu Câinele Tău",
        body:
          "Portretele finalizate de câini pot continua direct în Creatorul de felicitări de Crăciun.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Fă o felicitare de Crăciun cu portretul câinelui tău",
      },
      {
        h2: "Portrete de Crăciun Legate",
        body:
          "Explorezi alte animale sau hub-ul general pentru animale?",
        list: [
          "Portrete de Crăciun pentru animale → /ro/christmas/pets",
          "Generator foto de Crăciun pentru pisici → /ro/christmas/cats",
          "Generator foto de Crăciun cu AI → /ro/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Pot crea un portret de Crăciun al câinelui meu?",
        a: "Da. Încarcă o fotografie clară a câinelui tău pe această pagină, alege un stil de Crăciun și creează portretul.",
      },
      {
        q: "Ce se întâmplă dacă încarc din greșeală o fotografie cu o pisică?",
        a: "Vei primi un mesaj care te îndrumă către experiența dedicată portretelor de Crăciun pentru pisici.",
      },
      {
        q: "Pot include mai mulți câini?",
        a: "Da, dacă fiecare câine este clar vizibil în aceeași fotografie. Fețele și ochii ar trebui să fie ușor de văzut.",
      },
      {
        q: "Ce fotografii cu câini funcționează cel mai bine?",
        a: "Față și ochi clari, blur redus, evită să tai urechile sau capul din cadru.",
      },
      {
        q: "Pot încerca stiluri de Crăciun diferite pentru câinele meu?",
        a: "Da. Alege dintre stilurile de Crăciun pentru animale disponibile pe pagină.",
      },
      {
        q: "Pot descărca portretul câinelui?",
        a: "Da. Îl descarci din ecranul de rezultat, când este gata.",
      },
      {
        q: "Pot pune câinele meu pe o felicitare de Crăciun?",
        a: "Da. Folosește transferul către Creatorul de felicitări de Crăciun, după ce portretul este gata.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Generator Foto de Crăciun pentru Pisici | Portrete Festive",
    description:
      "Creează un portret magic de Crăciun al pisicii tale dintr-o fotografie clară. Verificat pe specie și privat, în mod implicit.",
    h1: "Creează un Portret Magic de Crăciun al Pisicii Tale",
    lede:
      "Încarcă o fotografie clară a pisicii, alege un stil festiv și creează un portret festiv de Crăciun pentru pisici.",
    h2: "Portrete de animale legate",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto" },
      { href: "/ro/christmas/pets", label: "Animale" },
      { href: "/ro/christmas/cats", label: "Pisici" },
    ],
    links: [
      { href: "/ro/christmas/dogs", label: "Portrete de Crăciun pentru câini" },
      { href: "/ro/christmas/pets", label: "Toate portretele de Crăciun pentru animale" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun cu AI" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator foto de Crăciun pentru pisici?",
      body:
        "Un generator foto de Crăciun pentru pisici creează un portret festiv de sărbătoare dintr-o fotografie a pisicii tale. Pe TheDigitalGifter încarci o fotografie clară, alegi un stil de Crăciun pentru animale și descarci un portret centrat pe pisică, pe care îl poți folosi și într-o felicitare de Crăciun.",
    },
    sections: [
      {
        h2: "Creează un Portret Magic de Crăciun al Pisicii Tale",
        body:
          "Această pagină este dedicată exclusiv pisicilor. Încarci o fotografie a pisicii tale, alegi un look de Crăciun și creezi un portret festiv cu pisica drept vedeta principală. Fotografiile cu câini sunt redirecționate spre experiența dedicată câinilor.",
      },
      {
        h2: "Exemple de Portrete de Crăciun cu Pisici",
        body:
          "Direcții demonstrative cu pisici — mostre de inspirație, nu fotografii ale clienților.",
        list: [
          "Pisică lângă un brad de Crăciun",
          "Portret cald, lângă șemineu, cu pisica de Crăciun",
          "Portret de Crăciun elegant sau pe zăpadă, cu pisica",
          "Stiluri de portret regal sau vintage de Crăciun pentru pisică",
        ],
      },
      {
        h2: "Stiluri de Crăciun Pentru Pisici",
        body:
          "Portretele pentru pisici folosesc setul de stiluri de Crăciun pentru animale: Animal Moș Crăciun, Crăciun Cald, Polul Nord, Pulover de Crăciun, Portret pe Zăpadă, Felicitare de Crăciun, Crăciun Regal și Crăciun Vintage.",
      },
      {
        h2: "Cum Alegi o Fotografie Bună cu Pisica Ta",
        body:
          "Alege o fotografie în care ochii și fața pisicii sunt clare și vizibile. Evită blur puternic, umbre grele pe față sau cadre tăiate agresiv care ascund urechile și mustățile.",
      },
      {
        h2: "Transformă Portretul Pisicii Tale într-o Felicitare de Crăciun",
        body:
          "După ce ai creat un portret de Crăciun al pisicii, poți continua direct în Creatorul de felicitări de Crăciun.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Fă o felicitare de Crăciun cu portretul pisicii tale",
      },
      {
        h2: "Portrete de Crăciun Legate",
        body:
          "Ai nevoie de câini sau de hub-ul general pentru animale?",
        list: [
          "Portrete de Crăciun pentru animale → /ro/christmas/pets",
          "Generator foto de Crăciun pentru câini → /ro/christmas/dogs",
          "Generator foto de Crăciun cu AI → /ro/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Pot crea un portret de Crăciun al pisicii mele?",
        a: "Da. Încarcă o fotografie clară a pisicii tale aici, alege un stil de Crăciun și creează portretul.",
      },
      {
        q: "Ce se întâmplă dacă încarc o fotografie cu un câine?",
        a: "Vei fi îndrumat să treci la pagina dedicată portretelor de Crăciun pentru câini.",
      },
      {
        q: "Contează detaliile mustăților și ale feței?",
        a: "Da. Un detaliu clar al feței și al ochilor produce, de obicei, un portret de Crăciun mai reușit pentru pisică.",
      },
      {
        q: "Pot încerca look-uri elegante sau calde pentru pisica mea?",
        a: "Da. Stilurile includ Crăciun Cald, Crăciun Regal, Crăciun Vintage, Portret pe Zăpadă și altele.",
      },
      {
        q: "Pot descărca portretul pisicii?",
        a: "Da. Îl descarci din ecranul de rezultat, când este gata.",
      },
      {
        q: "Pot folosi portretul pisicii mele pe o felicitare de Crăciun?",
        a: "Da. Transferul către Creatorul de felicitări este disponibil, după ce portretul este creat.",
      },
      {
        q: "Este diferit de pagina Animale?",
        a: "Da. Animale este hub-ul general pentru animale de companie; această pagină este dedicată exclusiv pisicilor.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Video Personalizat de la Moș Crăciun | Îți Spune Numele Copilului",
    description:
      "Creează un video personalizat de Crăciun de la Moș Crăciun care poate include numele destinatarului și alte detalii personale susținute, în engleză sau română.",
    h1: "Creează un Video Personalizat de la Moș Crăciun",
    lede:
      "Creează un video personalizat de Crăciun de la Moș Crăciun care poate include numele destinatarului și alte detalii personale susținute — în engleză sau în română.",
    h2: "Cum funcționează videoclipurile de la Moș Crăciun",
    h2Body: "Spune-i Moșului pentru cine este, adaugă câteva detalii, apoi creează un videoclip cu mesaj personalizat de Crăciun.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/santa-video", label: "Video Moș Crăciun" },
    ],
    links: [
      { href: "/ro/christmas/family", label: "Portrete de Crăciun pentru familie" },
      { href: "/ro/christmas/cards", label: "Creator de felicitări de Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Portret de Crăciun" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un video personalizat de la Moș Crăciun?",
      body:
        "Un video personalizat de la Moș Crăciun este un mesaj video de Crăciun în care Moș Crăciun poate include numele destinatarului și alte detalii oferite de tine. Pe TheDigitalGifter completezi un formular scurt și ghidat, revizuiești mesajul, apoi creezi un video pe care îl poți descărca și partaja — inclusiv cu Moș Crăciun vorbind în limba română.",
    },
    sections: [
      {
        h2: "Un Mesaj Personalizat de la Moș Crăciun, în Română",
        body:
          "Creează un video de Crăciun de la Moș Crăciun pentru un copil, frați, familie sau pentru cineva drag. Moș Crăciun poate spune numele lor și poate include detaliile opționale pe care le adaugi — iar mesajul poate fi vorbit în limba română, nu doar în engleză.",
      },
      {
        h2: "Ce Poate Menționa Moș Crăciun?",
        body:
          "Poți personaliza cu numele destinatarului, vârsta opțională, ceva ce a făcut bine anul acesta, o dorință de Crăciun, un detaliu personal în plus (de exemplu un hobby sau un animal de companie) și limba în care vorbește Moș Crăciun. Limbile suportate astăzi sunt engleza și română.",
        list: [
          "Numele destinatarului",
          "Vârsta (opțional)",
          "Ceva ce a făcut bine anul acesta",
          "Dorința de Crăciun",
          "Un detaliu personal în plus",
          "Limba: engleză sau română",
        ],
      },
      {
        h2: "Exemple de Videoclipuri Personalizate de la Moș Crăciun",
        body:
          "Exemplele demonstrative arată cum poate suna un mesaj personalizat de la Moș Crăciun. Sunt demonstrații ale produsului, gândite ca inspirație, nu testimoniale reale ale clienților.",
      },
      {
        h2: "Cum Funcționează",
        body: "Spune-i Moșului despre persoana respectivă, revizuiește mesajul, creează videoul, apoi descarcă sau partajează-l.",
        list: [
          "Spune-i Moșului despre ei",
          "Revizuiește mesajul",
          "Creează videoul",
          "Descarcă sau partajează",
        ],
      },
      {
        h2: "Mai Multă Magie de Crăciun",
        body: "După video, multe familii creează și un portret sau o felicitare de Crăciun pentru aceeași persoană.",
        linkHref: "/ro/christmas",
        linkLabel: "Înapoi la Crăciun la TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "Poate Moș Crăciun să spună numele copilului meu, în română?",
        a: "Da. Numele destinatarului este un câmp principal de personalizare, iar Moș Crăciun îl spune în video — inclusiv atunci când alegi limba română pentru mesaj.",
      },
      {
        q: "Ce pot personaliza?",
        a: "Numele, vârsta opțională, ceva ce a făcut bine anul acesta, dorința de Crăciun, un detaliu personal în plus și limba (engleză sau română).",
      },
      {
        q: "Ce limbi sunt suportate?",
        a: "Engleza și română sunt suportate astăzi. Poți alege limba română, iar Moș Crăciun vorbește în română pe tot parcursul mesajului.",
      },
      {
        q: "Poate Moș Crăciun să menționeze un cadou de Crăciun?",
        a: "Da — poți include o dorință de Crăciun, iar Moș Crăciun o poate menționa atunci când o adaugi.",
      },
      {
        q: "Pot face un video pentru frați?",
        a: "Da. Alege opțiunea pentru frați și include numele lor la pasul de personalizare. Un flux dedicat pentru mai mulți copii se poate extinde în viitor.",
      },
      {
        q: "Pot previzualiza mesajul înainte?",
        a: "Da. Poți revizui mesajul înainte de a crea videoul.",
      },
      {
        q: "Pot descărca sau partaja videoul?",
        a: "Da. Când videoul este gata, poți descărca fișierul MP4 și îl poți partaja.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Brad Digital de Crăciun | Cadouri, Mesaje și Amintiri",
    description:
      "Construiește un brad digital de Crăciun plin de mesaje și amintiri, pe care îl poți decora și partaja în siguranță.",
    h1: "Construiește un Brad de Crăciun Plin de Surprize",
    lede:
      "Creează, decorează și partajează un brad digital de Crăciun personalizat, cu mesaje ascunse dedesubt.",
    h2: "Combină cu alte cadouri de Crăciun",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/tree", label: "Brad digital" },
    ],
    links: [
      { href: "/ro/christmas/wishlist", label: "Creator de liste de dorințe" },
      { href: "/ro/christmas/gift-finder", label: "Găsitor de cadouri de Crăciun" },
      { href: "/ro/christmas/messages", label: "Generator de mesaje de Crăciun" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un brad digital de Crăciun?",
      body:
        "Un brad digital de Crăciun este un brad interactiv, online, pe care îl poți personaliza și partaja. Pe TheDigitalGifter alegi un look pentru brad, adaugi decorațiuni, așezi cutii cadou cu mesaje personale sub el și partajezi un link privat, astfel încât cineva drag să poată deschide cadourile pe ecranul propriu — fără ca pagina partajată să ajungă în rezultatele motoarelor de căutare.",
    },
    sections: [
      {
        h2: "Construiește un Brad Digital de Crăciun",
        body:
          "Creează gratuit un brad de Crăciun interactiv, direct în browser. Personalizează stilul (Clasic, Înzăpezit, Auriu, Cald, Minimalist sau Magic), luminițele, zăpada, vârful bradului și globurile, apoi așază cutii cadou dedesubt.",
      },
      {
        h2: "Ce Poți Pune Sub Bradul Tău?",
        body:
          "Astăzi poți adăuga cutii cadou care conțin mesaje personale de Crăciun. Fiecare cadou poate folosi un stil de cutie festiv, precum roșu, auriu, verde, albastru sau alb ca zăpada. Alte tipuri de cadou se pot adăuga în viitor — creatorul actual se concentrează pe cadouri cu mesaj.",
        list: [
          "Mesaje personale de Crăciun, în cutii cadou",
          "Stiluri festive de cutii (roșu, auriu, verde, albastru, alb ca zăpada)",
        ],
      },
      {
        h2: "Partajează Bradul Tău de Crăciun",
        body:
          "Când ești gata, activează partajarea și trimite un singur link. Destinatarii deschid bradul, văd decorațiunile și despachetează cadourile. Linkurile de brad partajate sunt gândite pentru oamenii în care ai încredere și nu sunt indexate pentru motoarele de căutare.",
      },
      {
        h2: "Un Cadou de Crăciun Gândit să Fie Deschis",
        body:
          "Destinatarii pot atinge cadourile de sub brad pentru a descoperi mesajele pe care le-ai lăsat — un moment digital gândit să semene cu deschiderea unui cadou lăsat special pentru ei.",
      },
      {
        h2: "Cum Funcționează",
        body:
          "Un drum simplu, de la un brad gol până la o surpriză de Crăciun gata de partajat.",
        list: [
          "Creează și personalizează bradul digital de Crăciun",
          "Adaugă cutii cadou cu mesaje",
          "Activează partajarea și trimite linkul",
          "Ei deschid cadourile de sub brad",
        ],
      },
      {
        h2: "Mai Multă Magie de Crăciun",
        body:
          "Combină bradul tău cu alte creații de Crăciun, atunci când vrei ceva în plus pentru atmosfera de sărbătoare.",
        list: [
          "Hub de Crăciun → /ro/christmas",
          "Video personalizat de la Moș Crăciun → /ro/christmas/santa-video",
          "Calendar de Advent online → /ro/christmas/advent",
        ],
      },
    ],
    faqs: [
      {
        q: "Ce este un brad digital de Crăciun?",
        a: "Un brad de Crăciun interactiv, online, pe care îl personalizezi, îl umpli cu cadouri cu mesaj și îl partajezi, astfel încât cineva să le poată deschide pe propriul dispozitiv.",
      },
      {
        q: "Ce pot adăuga pe el?",
        a: "Astăzi poți adăuga cutii cadou cu mesaje personale de Crăciun și poți alege stiluri festive de cutii.",
      },
      {
        q: "Pot să îl partajez cu cineva?",
        a: "Da. Activează partajarea și trimite linkul. Tratează-l ca pe un link de cadou personal.",
      },
      {
        q: "Pot destinatarii să deschidă cadourile?",
        a: "Da. Destinatarii pot atinge cadourile de sub brad pentru a descoperi mesajele pe care le-ai adăugat.",
      },
      {
        q: "Pot adăuga un video de la Moș Crăciun sau o fotografie de Crăciun sub brad?",
        a: "Nu, ca tip de cadou dedicat, în creatorul actual de brad. Poți crea acele experiențe separat și le poți menționa într-un cadou cu mesaj.",
      },
      {
        q: "Am nevoie de un cont?",
        a: "Poți începe să creezi un brad fără o configurare complicată — proprietatea este gestionată la nivelul sesiunii de creare, ca să poți continua să editezi.",
      },
      {
        q: "Bradul partajat este public?",
        a: "Bradurile partajate sunt accesibile celor care au linkul, dar paginile de partajare sunt marcate noindex și nu sunt gândite pentru motoarele de căutare.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Calendar de Advent Online de Crăciun | O Surpriză În Fiecare Zi",
    description:
      "Deschide o nouă surpriză digitală de Crăciun în fiecare zi, de la 1 la 24 decembrie, după ora României.",
    h1: "Puțină Magie de Crăciun, În Fiecare Zi",
    lede:
      "Deschide o nouă surpriză digitală de Crăciun în fiecare zi, de la 1 la 24 decembrie, după ora României (Europe/Bucharest).",
    h2: "Mai multă magie de Crăciun",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/advent", label: "Calendar de Advent" },
    ],
    links: [
      { href: "/ro/christmas/santa-video", label: "Video personalizat de la Moș Crăciun" },
      { href: "/ro/christmas/cards", label: "Creator de felicitări de Crăciun" },
      { href: "/ro/christmas/wishlist", label: "Listă de dorințe de Crăciun" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un calendar de Advent online?",
      body:
        "Un calendar de Advent online este versiunea digitală a calendarului tradițional de Advent: o nouă ușiță se deschide în fiecare zi din decembrie, până la Crăciun. Pe TheDigitalGifter deschizi ușița zilei curente, dintr-un calendar cu numerele 1–24 (ora Europe/Bucharest). Ușițele trecute rămân închise după ce ziua respectivă a trecut, iar unele recompense pot cere autentificare, atunci când revendicările sunt active.",
    },
    sections: [
      {
        h2: "Puțină Magie de Crăciun, În Fiecare Zi",
        body:
          "Calendarul de Advent este o experiență de numărătoare inversă, cu douăzeci și patru de ușițe. Fiecare zi din decembrie are propria ușiță — un mic ritual de a deschide ceva nou, pe măsură ce Crăciunul se apropie.",
      },
      {
        h2: "Deschide o Nouă Ușiță În Fiecare Zi",
        body:
          "Ușițele urmează ziua calendaristică, în fusul orar Europe/Bucharest. Doar ușița zilei curente poate fi deschisă. Ușițele viitoare rămân blocate. Zilele pierdute nu se redeschid pentru recuperare.",
      },
      {
        h2: "Ce Poate Fi În Spatele Ușițelor?",
        body:
          "Recompensele din spatele ușițelor sunt momente de Crăciun configurate pentru sezon, cum ar fi o surpriză de revendicat, atunci când revendicările de producție sunt active. Disponibilitatea poate depinde de setările sezonului și de faptul că ești autentificat sau nu.",
      },
      {
        h2: "Înainte de 1 Decembrie",
        body:
          "Înainte de a începe fereastra de Advent, ușițele apar ca „în curând”. Revino când începe decembrie pentru a deschide prima zi.",
      },
      {
        h2: "Cum Funcționează Calendarul de Advent",
        body:
          "Pași simpli pentru experiența digitală de Advent.",
        list: [
          "Deschide pagina calendarului de Advent",
          "Găsește ușița zilei curente (1–24 în decembrie)",
          "Deschide-o, atunci când este disponibilă",
          "Autentifică-te, dacă o revendicare cere cont",
        ],
      },
      {
        h2: "Mai Multă Magie de Crăciun",
        body:
          "Continuă sezonul cu un brad digital sau întoarce-te la hub-ul de Crăciun.",
        list: [
          "Brad digital de Crăciun → /ro/christmas/tree",
          "Hub de Crăciun → /ro/christmas",
        ],
      },
    ],
    faqs: [
      {
        q: "Când începe calendarul de Advent?",
        a: "Ușițele corespund zilelor din decembrie, 1–24. Înainte de 1 decembrie, ușițele apar ca „în curând”.",
      },
      {
        q: "Când se deblochează fiecare ușiță?",
        a: "Fiecare ușiță se deblochează în ziua ei calendaristică, în fusul orar Europe/Bucharest.",
      },
      {
        q: "Pot deschide ușițe mai vechi, pe care le-am ratat?",
        a: "Nu. Zilele ratate rămân închise — doar ușița zilei curente este disponibilă.",
      },
      {
        q: "Calendarul este gratuit?",
        a: "Navigarea în calendar este gratuită. Unele revendicări de recompense pot cere un cont, atunci când sunt active pentru sezon.",
      },
      {
        q: "Ce pot găsi în spatele unei ușițe?",
        a: "Surprize de sezon, configurate pentru ziua respectivă, atunci când revendicările sunt active — nu o garanție de premii în bani sau credite de magazin în fiecare zi.",
      },
      {
        q: "Am nevoie de un cont?",
        a: "Poți vizualiza calendarul fără cont. Revendicarea anumitor recompense poate cere autentificare.",
      },
      {
        q: "Pot să îl folosesc de pe telefon?",
        a: "Da. Calendarul de Advent este gândit să funcționeze la fel de bine pe telefon și pe desktop.",
      },
      {
        q: "Pot să îl partajez?",
        a: "Poți partaja linkul paginii calendarului de Advent, astfel încât și alții să își poată deschide propriile ușițe zilnice.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Creator de Felicitări de Crăciun | Felicitări Personalizate",
    description:
      "Creează o felicitare de Crăciun personalizată pe care vor vrea să o păstreze — alege un design, adaugă mesajul tău și descarcă sau partajează.",
    h1: "Creează o Felicitare de Crăciun pe Care Vor Vrea Să o Păstreze",
    lede:
      "Proiectează o felicitare personalizată de Crăciun, cu layout-uri festive și mesajul tău. Unele gânduri merită mai mult decât un simplu SMS.",
    h2: "Combină cu mesaje de Crăciun",
    h2Body: "Alege un stil, adaugă o fotografie sau un portret, scrie mesajul, apoi descarcă imaginea în format PNG.",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/cards", label: "Felicitări" },
    ],
    links: [
      { href: "/ro/christmas/messages", label: "Generator de mesaje de Crăciun" },
      { href: "/ro/christmas/photo-generator", label: "Generator foto de Crăciun" },
      { href: "/ro/christmas/family", label: "Portrete de Crăciun pentru familie" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un creator online de felicitări de Crăciun?",
      body:
        "Un creator online de felicitări de Crăciun te lasă să faci o felicitare personalizată, cu o fotografie, un design festiv și mesajul tău propriu. Pe TheDigitalGifter poți încărca o fotografie sau folosi un portret de Crăciun deja creat, alegi un stil, scrii sau ceri ajutor pentru mesaj, apoi descarci un fișier PNG sau trimiți felicitarea digital.",
    },
    sections: [
      {
        h2: "Creează o Felicitare Personalizată de Crăciun",
        body:
          "Alege un stil de felicitare, adaugă fotografia, scrie un mesaj și creează o felicitare digitală pe care o poți descărca sau partaja. Unele gânduri merită mai mult decât un simplu mesaj text — asta e menit pentru ele.",
      },
      {
        h2: "Exemple de Felicitări de Crăciun",
        body:
          "Explorează direcții precum felicitări de familie, de cuplu, cu animale, elegante, amuzante și clasice de Crăciun. Exemplele sunt inspirație de design pentru stilurile disponibile în creator.",
        list: ["Familie", "Cuplu", "Animal de companie", "Elegant", "Amuzant", "Clasic"],
      },
      {
        h2: "Folosește Portretul Tău de Crăciun",
        body:
          "Dacă ai creat deja un portret de Crăciun, îl poți aduce în creatorul de felicitări și îl poți completa cu un mesaj. Transferul portretului este disponibil direct din fluxul generatorului foto de Crăciun.",
        linkHref: "/ro/christmas/photo-generator",
        linkLabel: "Creează mai întâi un portret de Crăciun",
      },
      {
        h2: "Mesaje Pentru Felicitări de Crăciun, în Română",
        body:
          "Scrie propriile cuvinte sau folosește ajutorul integrat pentru mesaje, disponibil și în limba română. Pentru urări mai ghidate, Generatorul de mesaje de Crăciun te poate ajuta să găsești tonul potrivit.",
        linkHref: "/ro/christmas/messages",
        linkLabel: "Găsește un mesaj de Crăciun",
      },
      {
        h2: "Cum Faci o Felicitare de Crăciun Online",
        body:
          "Un drum simplu, de la o pagină goală până la o felicitare de Crăciun gata de partajat.",
        list: [
          "Alege un stil de felicitare de Crăciun",
          "Încarcă o fotografie sau folosește un portret de Crăciun",
          "Scrie mesajul tău (sau cere ajutor)",
          "Descarcă PNG-ul sau partajează digital",
        ],
      },
    ],
    faqs: [
      {
        q: "Pot încărca propria fotografie?",
        a: "Da. Încarcă o fotografie ca element central al felicitării de Crăciun.",
      },
      {
        q: "Pot folosi un portret de Crăciun?",
        a: "Da. Dacă ai creat un portret în generatorul foto, îl poți transfera direct în creatorul de felicitări.",
      },
      {
        q: "Mă puteți ajuta să scriu mesajul, în română?",
        a: "Da. Folosește ajutorul pentru mesaje din creator sau vizitează Generatorul de mesaje de Crăciun, care funcționează și în limba română.",
      },
      {
        q: "Pot face o felicitare de familie?",
        a: "Da. Stilurile potrivite pentru familie și layout-urile foto fac parte din creator.",
      },
      {
        q: "Pot face o felicitare cu animalul meu de companie?",
        a: "Da. Fotografiile cu animale funcționează bine în mai multe stiluri de felicitări de Crăciun.",
      },
      {
        q: "Pot descărca felicitarea?",
        a: "Da. Descarci un fișier PNG de înaltă rezoluție, pentru uz personal.",
      },
      {
        q: "Pot să o trimit digital?",
        a: "Da. Folosește opțiunile de partajare ale telefonului, WhatsApp, email sau copiază un link, acolo unde este disponibil.",
      },
      {
        q: "Ce stiluri de felicitări sunt disponibile?",
        a: "Stilurile includ look-uri clasice, aurii și elegante, calde, țară a minunilor de iarnă, minimaliste, vintage, jucăușe și romantice de Crăciun.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Generator de Mesaje de Crăciun | Urări Pentru Familie și Prieteni",
    description:
      "Găsește mesajul perfect de Crăciun pentru familie, prieteni și colegi — apoi folosește-l într-o felicitare personalizată de Crăciun.",
    h1: "Găsește Mesajul Perfect de Crăciun",
    lede:
      "Generează urări de Crăciun calde, amuzante, romantice sau profesionale, în limba română, apoi adaugă-ți preferata pe o felicitare de Crăciun.",
    h2: "Transformă cuvintele într-o felicitare",
    breadcrumbs: [
      { href: "/ro/christmas", label: "Crăciun" },
      { href: "/ro/christmas/messages", label: "Mesaje" },
    ],
    links: [
      { href: "/ro/christmas/cards", label: "Creator de felicitări de Crăciun" },
      { href: "/ro/christmas/wishlist", label: "Listă de dorințe de Crăciun" },
      { href: "/ro/christmas/tree", label: "Brad digital de Crăciun" },
      { href: "/ro/christmas", label: "Acasă la Crăciun" },
    ],
    geo: {
      h2: "Ce este un generator de mesaje de Crăciun?",
      body:
        "Un generator de mesaje de Crăciun te ajută să scrii urări alegând pentru cine este mesajul și tonul dorit, apoi generând variante editabile. Pe TheDigitalGifter poți crea mesaje de Crăciun calde, amuzante, romantice, sincere, scurte, profesionale sau religioase, în limba română, apoi le copiezi sau continui direct într-o felicitare de Crăciun.",
    },
    sections: [
      {
        h2: "Găsește Mesajul Perfect de Crăciun, în Română",
        body:
          "Alege un destinatar, un ton, o lungime (scurt, mediu sau lung), adaugă opțional un detaliu personal și generează variante de mesaj de Crăciun în română, pe care le poți edita și folosi.",
      },
      {
        h2: "Mesaje de Crăciun După Destinatar",
        body:
          "Generatorul acoperă cele mai frecvente relații de Crăciun. Pornește instrumentul și alege pentru cine scrii — paginile dedicate fiecărui destinatar nu sunt încă live.",
        list: [
          "Mamă",
          "Tată",
          "Soție",
          "Soț",
          "Iubită",
          "Iubit",
          "Familie",
          "Prieten",
          "Coleg",
        ],
      },
      {
        h2: "Mesaje de Crăciun După Ton",
        body:
          "Tonurile disponibile astăzi includ cald, amuzant, romantic, sincer, scurt și dulce, profesional și religios.",
      },
      {
        h2: "Exemple de Mesaje de Crăciun",
        body:
          "Direcții demonstrative pentru tipul de urări pe care instrumentul te poate ajuta să le scrii — editează orice, ca să sune ca tine.",
        list: [
          "Notă sinceră către mamă, mulțumindu-i pentru încă un an de bunătate discretă",
          "Urare scurtă și caldă pentru un prieten pe care nu îl vezi suficient de des",
          "Rând romantic de Crăciun pentru primul Crăciun al unui cuplu",
          "Mesaj ușor amuzant pentru un coleg, care rămâne potrivit la birou",
        ],
      },
      {
        h2: "Cum Scrii un Mesaj de Crăciun Cu Adevărat Sincer",
        body:
          "Adresează-te persoanei pe nume sau prin relația voastră, menționează o amintire sau o calitate comună atunci când se potrivește, exprimă un sentiment clar, păstrează formularea naturală și încheie personal. Generatorul este un punct de plecare — editarea ta îl face autentic.",
      },
      {
        h2: "Folosește Mesajul Tău Într-o Felicitare de Crăciun",
        body:
          "Când găsești cuvintele potrivite, continuă în Creatorul de felicitări de Crăciun și combină mesajul cu o fotografie și un design.",
        linkHref: "/ro/christmas/cards",
        linkLabel: "Pune acest mesaj de Crăciun pe o felicitare",
      },
    ],
    faqs: [
      {
        q: "Cum funcționează generatorul de mesaje de Crăciun?",
        a: "Alegi destinatarul, tonul și lungimea, adaugi opțional un detaliu, apoi generezi variante de mesaj pe care le poți copia sau edita — inclusiv în limba română.",
      },
      {
        q: "Pot scrie un mesaj pentru partenerul meu?",
        a: "Da. Alege iubită, iubit, parteneră, parteneri, soție sau soț și un ton romantic sau cald.",
      },
      {
        q: "Poate crea mesaje amuzante de Crăciun?",
        a: "Da. Selectează tonul amuzant — păstrează mesajele pentru colegi într-un registru profesional.",
      },
      {
        q: "Pot edita mesajele generate?",
        a: "Da. Tratează textul generat ca pe o schiță și rescrie-l liber, înainte de a-l trimite sau folosi pe o felicitare.",
      },
      {
        q: "Poate crea urări scurte de Crăciun?",
        a: "Da. Alege lungimea scurtă sau tonul scurt și dulce.",
      },
      {
        q: "Pot folosi un mesaj într-o felicitare de Crăciun?",
        a: "Da. Continuă în Creatorul de felicitări de Crăciun, cu transfer direct al mesajului.",
      },
      {
        q: "Ce limbi sunt suportate?",
        a: "Engleza și română sunt suportate astăzi — generatorul creează mesaje autentice în limba română, nu doar traduceri.",
      },
    ],
  },
};

/** @returns {LocalizedSeoPage | null} */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
