/**
 * Polish (pl) SEO content for the Christmas routes.
 * Native vocabulary with full Polish diacritics — Święty Mikołaj,
 * lista życzeń, kalendarz adwentowy, portrety świąteczne, kartki świąteczne.
 * Santa video and message generation remain EN/RO only; this content never
 * claims a Polish-spoken Święty Mikołaj or Polish message generation.
 */

export const LOCALE = "pl";

/** @type {Record<string, object>} */
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Boże Narodzenie w TheDigitalGifter | Prezenty, Zdjęcia, Święty Mikołaj i Więcej",
    description:
      "Twórz świąteczne prezenty, portrety AI, filmy od Świętego Mikołaja, listy życzeń, kartki świąteczne i adwentowe niespodzianki — spersonalizowane cyfrowe doświadczenia świąteczne od TheDigitalGifter.",
    h1: "Stwórz Coś, Co Zapamiętają Na Długo",
    lede:
      "Odkryj świąteczne prezenty, portrety fotograficzne, filmy od Świętego Mikołaja, cyfrowe choinki, kalendarze adwentowe, kartki świąteczne i życzenia — wszystko w jednym miejscu w TheDigitalGifter.",
    h2: "Świąteczne doświadczenia",
    h2Body: "Wybierz świąteczny produkt poniżej i stwórz coś osobistego w kilka minut.",
    breadcrumbs: [{ href: "/pl/christmas", label: "Boże Narodzenie" }],
    links: [
      { href: "/pl/christmas/gift-finder", label: "Znajdź Świąteczny Prezent, Który Pokochają" },
      { href: "/pl/christmas/wishlist", label: "Stwórz Świąteczną Listę Życzeń" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas/santa-video", label: "Stwórz Spersonalizowany Film od Świętego Mikołaja" },
      { href: "/pl/christmas/tree", label: "Zbuduj Cyfrową Choinkę" },
      { href: "/pl/christmas/advent", label: "Otwórz Kalendarz Adwentowy" },
      { href: "/pl/christmas/cards", label: "Stwórz Kartkę Świąteczną" },
      { href: "/pl/christmas/messages", label: "Znajdź Świąteczne Życzenia" },
    ],
    geo: {
      h2: "Co można stworzyć z TheDigitalGifter na Boże Narodzenie?",
      body:
        "TheDigitalGifter to centrum świątecznej kreatywności. Znajdziesz pomysły na prezenty za pomocą Gift Finder, zmienisz zdjęcie w świąteczny portret dla rodziny, par lub zwierząt, stworzysz spersonalizowany film od Świętego Mikołaja z imieniem odbiorcy, zbudujesz świąteczną listę życzeń do udostępnienia, zaprojektujesz kartkę świąteczną ze zdjęciem i wiadomością, napiszesz życzenia świąteczne, udekorujesz cyfrową choinkę i otworzysz codzienne niespodzianki adwentowe. Zacznij od jednego miejsca i przejdź do doświadczenia dopasowanego do osoby, którą świętujesz.",
    },
    sections: [
      {
        h2: "Znajdź Idealny Świąteczny Prezent",
        body:
          "Nie wiesz, co kupić? Świąteczny Gift Finder pyta, dla kogo kupujesz, co ta osoba lubi, jak wygląda jej codzienność i jaki masz budżet. Otrzymujesz przemyślane pomysły na prezenty z krótkim wyjaśnieniem, dlaczego każdy z nich się sprawdzi — również dla kogoś, kto zdaje się mieć już wszystko. Zapisz ulubione w liście życzeń, gdy będziesz gotowy.",
        linkHref: "/pl/christmas/gift-finder",
        linkLabel: "Znajdź świąteczny prezent, który naprawdę pokochają",
      },
      {
        h2: "Twórz Magiczne Świąteczne Zdjęcia",
        body:
          "Wgraj wyraźne zdjęcie i przekształć je w świąteczny portret. Twórz stylizacje dla rodzin, par i zwierząt — z dedykowanymi ścieżkami dla psów i kotów — a potem pobierz prywatnie lub przenieś portret na kartkę świąteczną.",
        linkHref: "/pl/christmas/photo-generator",
        linkLabel: "Zmień swoje zdjęcie w świąteczną magię",
      },
      {
        h2: "Otrzymaj Spersonalizowaną Wiadomość od Świętego Mikołaja",
        body:
          "Stwórz spersonalizowany świąteczny film od Świętego Mikołaja. Podaj imię odbiorcy i opcjonalne szczegóły, takie jak wiek, coś, co zrobił dobrze, hobby lub świąteczne życzenie. Sprawdź wiadomość, a potem stwórz film, który możesz pobrać i udostępnić. Film jest tworzony w języku angielskim lub rumuńskim.",
        linkHref: "/pl/christmas/santa-video",
        linkLabel: "Stwórz spersonalizowany film od Świętego Mikołaja",
      },
      {
        h2: "Stwórz i Udostępnij Świąteczną Listę Życzeń",
        body:
          "Zbuduj świąteczną listę życzeń z linkami do produktów lub swobodnie zapisanymi życzeniami. Udostępnij jeden prosty link rodzinie i przyjaciołom. Osoby przeglądające listę mogą zarezerwować prezent, aby inni nie kupili tego samego — bez zdradzania właścicielowi listy, kto co kupił.",
        linkHref: "/pl/christmas/wishlist",
        linkLabel: "Stwórz świąteczną listę życzeń",
      },
      {
        h2: "Stwórz Spersonalizowaną Kartkę Świąteczną",
        body:
          "Połącz zdjęcie, świąteczny projekt i osobistą wiadomość w kartkę świąteczną, którą możesz pobrać lub udostępnić cyfrowo. Użyj własnego zdjęcia lub portretu świątecznego, który już stworzyłeś.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Stwórz kartkę świąteczną, którą będą chcieli zachować",
      },
      {
        h2: "Więcej Świątecznych Doświadczeń",
        body:
          "Możesz też zbudować cyfrową choinkę pełną niespodzianek, otwierać okienka adwentowe przez cały grudzień, i znaleźć właściwe słowa dzięki generatorowi wiadomości świątecznych.",
        list: [
          "Cyfrowa Choinka → /pl/christmas/tree",
          "Kalendarz Adwentowy → /pl/christmas/advent",
          "Wiadomości Świąteczne → /pl/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "Co mogę stworzyć na święta z TheDigitalGifter?",
        a: "Możesz znaleźć pomysły na prezenty, zamienić zdjęcia w portrety świąteczne dla rodzin, par i zwierząt, rozpocząć doświadczenie ze Świętym Mikołajem, stworzyć udostępnialną listę życzeń, zaprojektować kartkę, napisać wiadomości, udekorować cyfrową choinkę i otwierać niespodzianki Adwentu. Wybierz jedno doświadczenie na tej stronie i skończ w kilka minut.",
      },
      {
        q: "Czy Święty Mikołaj może powiedzieć imię mojego dziecka?",
        a: "Możesz zacząć od imienia na stronie świątecznej lub w doświadczeniu ze Świętym Mikołajem i dodać opcjonalne szczegóły. Mówione filmy są dziś dostępne po angielsku i rumuńsku — inne języki wkrótce.",
      },
      {
        q: "Czy potrzebuję umiejętności projektowych?",
        a: "Nie. Każde doświadczenie świąteczne prowadzi Cię krok po kroku — prześlij zdjęcie, odpowiedz na kilka pytań lub zacznij od imienia — a strona robi resztę.",
      },
      {
        q: "Czy to dla prezentów cyfrowych, fizycznych, czy obu?",
        a: "Obu. Użyj Wyszukiwarki i listy życzeń do zakupów gdziekolwiek oraz twórz cyfrowe portrety i kartki do natychmiastowego pobrania lub udostępnienia.",
      },
      {
        q: "Czy to działa na telefonie?",
        a: "Tak — hub świąteczny i doświadczenia produktowe są zaprojektowane najpierw na telefon i działają też na komputerze.",
      },
      {
        q: "Czy zdjęcie mojej rodziny jest prywatne?",
        a: "Przesłane pliki służą do stworzenia portretu lub kartki. Doświadczenia dla dzieci są privacy-first i zakładają rodzica lub opiekuna. Gdy wynik jest gotowy, pobierasz go prywatnie — nie publikujemy Twoich zdjęć.",
      },
      {
        q: "Ile trwa stworzenie czegoś?",
        a: "Większość doświadczeń zajmuje kilka minut. Wyszukiwarka i wiadomości są niemal natychmiastowe. Portrety, kartki i Święty Mikołaj prowadzą Cię krok po kroku; płatne kreacje kontynuują po checkout.",
      },
      {
        q: "Czy potrzebuję konta, żeby zacząć?",
        a: "Możesz od razu przeglądać i zaczynać. Niektóre doświadczenia proszą o e-mail przy dołączeniu lub płatności, aby zapisać postęp, otrzymać wynik lub dołączyć do Christmas Club.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Wyszukiwarka Świątecznych Prezentów | Znajdź Idealny Prezent | TheDigitalGifter",
    description: "Znajdź przemyślane pomysły na świąteczne prezenty na podstawie tego, dla kogo kupujesz, jego zainteresowań, osobowości i Twojego budżetu.",
    h1: "Znajdź Świąteczny Prezent, Który Naprawdę Pokochają",
    lede:
      "Odpowiedz na kilka pytań o osobę, dla której kupujesz prezent, i otrzymaj spersonalizowane pomysły na świąteczne prezenty dopasowane do zainteresowań, osobowości i budżetu.",
    h2: "Powiązane narzędzia świąteczne",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/gift-finder", label: "Wyszukiwarka Prezentów" },
    ],
    links: [
      { href: "/pl/christmas/wishlist", label: "Stwórz Świąteczną Listę Życzeń" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć" },
      { href: "/pl/christmas/tree", label: "Cyfrowa Choinka" },
      { href: "/pl/christmas", label: "Wszystkie świąteczne doświadczenia" },
    ],
    geo: {
      h2: "Czym jest Wyszukiwarka Świątecznych Prezentów?",
      body:
        "Wyszukiwarka Świątecznych Prezentów to narzędzie prowadzące krok po kroku, które poleca pomysły na świąteczne prezenty na podstawie tego, dla kogo kupujesz, jego zainteresowań i osobowości oraz Twojego budżetu. W TheDigitalGifter odpowiadasz na krótki zestaw pytań i otrzymujesz wyselekcjonowane pomysły z jasnymi powodami, dlaczego mogą się sprawdzić — a potem możesz doprecyzować odpowiedzi lub zapisać pomysły w liście życzeń.",
    },
    sections: [
      {
        h2: "Jak Działa Wyszukiwarka Świątecznych Prezentów",
        body:
          "Wybierz odbiorcę, podaj jego zainteresowania i osobowość, ustaw budżet i opcjonalnie dodaj jeden osobisty szczegół. Wyszukiwarka zwraca ranking pomysłów na prezenty z krótkimi wyjaśnieniami. Możesz doprecyzować odpowiedzi, zacząć od nowa lub zapisać pomysły w swojej Świątecznej Liście Życzeń.",
        list: ["Dla kogo kupujesz", "Zainteresowania i osobowość", "Zakres budżetu", "Spersonalizowane pomysły na prezenty z powodami"],
      },
      {
        h2: "Znajdź Prezenty Według Odbiorcy",
        body:
          "Wyszukiwarka Prezentów obsługuje najczęstsze relacje świątecznych zakupów, aby rekomendacje pozostały odpowiednie. Skorzystaj z narzędzia dla mamy, taty, żony, męża, dziewczyny, chłopaka, dzieci, nastolatków, dziadków, przyjaciół, współpracowników i innych. Dedykowane strony dla poszczególnych odbiorców nie są jeszcze dostępne — zacznij wyszukiwarkę i wybierz odbiorcę tam.",
        list: ["Mama", "Tata", "Żona", "Mąż", "Dziewczyna", "Chłopak", "Dzieci", "Nastolatki", "Dziadkowie", "Przyjaciele", "Współpracownicy"],
      },
      {
        h2: "Znajdź Świąteczne Prezenty Według Budżetu",
        body:
          "Wybierz zakres wydatków, na przykład do 100 zł, 100–200 zł, 200–400 zł, 400–800 zł, 800 zł+, albo bez ustalonego budżetu. Rekomendacje to pomysły na prezenty z typowymi zakresami cenowymi — nie są to dane o dostępności w czasie rzeczywistym u sprzedawców ani gwarancja stanu magazynowego.",
      },
      {
        h2: "Prezenty Dla Kogoś, Kto Ma Już Wszystko",
        body:
          "Kiedy ktoś zdaje się mieć już „wszystko”, przydatne świąteczne prezenty zwykle kierują się w stronę doświadczeń, spersonalizowanych pamiątek, ulepszeń hobby, sentymentalnych chwil lub praktycznych, premium przedmiotów. Wybór osobowości „Ma już wszystko” kieruje wyszukiwarkę w te strony, a nie w generyczne dodatki.",
      },
      {
        h2: "Zapisz Pomysły w Swojej Liście Życzeń",
        body: "Podobał Ci się pomysł? Zapisz go w swojej Świątecznej Liście Życzeń i udostępnij jedną listę rodzinie, żeby zakupy były skoordynowane.",
        linkHref: "/pl/christmas/wishlist",
        linkLabel: "Otwórz Kreator Świątecznych List Życzeń",
      },
    ],
    faqs: [
      {
        q: "Jak działa Wyszukiwarka Świątecznych Prezentów?",
        a: "Odpowiadasz na kilka szybkich pytań o osobę, dla której kupujesz, jej zainteresowania, osobowość i budżet. Następnie widzisz wyselekcjonowane pomysły na prezenty z jasnym powodem, dlaczego każdy się sprawdzi.",
      },
      {
        q: "Czy mogę szukać według budżetu?",
        a: "Tak. Zakresy budżetu są głównym krokiem w wyszukiwarce.",
      },
      {
        q: "Czy mogę znaleźć prezenty dla kogoś, kto ma już wszystko?",
        a: "Tak. Opcje osobowości obejmują „Ma już wszystko”, co kieruje pomysły w stronę doświadczeń, personalizacji i znaczących pamiątek.",
      },
      {
        q: "Czy mogę użyć jej dla dzieci lub nastolatków?",
        a: "Tak. Wybierz Dziecko lub Nastolatek (albo Córka/Syn z zakresem wieku), aby pomysły były odpowiednie do wieku.",
      },
      {
        q: "Czy mogę zapisać pomysły w swojej liście życzeń?",
        a: "Tak. Użyj opcji „Zapisz w liście życzeń” przy pomyśle, aby dodać go do /pl/christmas/wishlist.",
      },
      {
        q: "Czy rekomendacje są spersonalizowane?",
        a: "Tak. Rekomendacje wykorzystują odbiorcę, wiek, zainteresowania, osobowość, budżet i opcjonalny osobisty szczegół.",
      },
      {
        q: "Czy wyświetla realne produkty?",
        a: "Obecnie wyszukiwarka pokazuje wyselekcjonowane pomysły na prezenty z typowymi zakresami cenowymi. Ceny i dostępność u sprzedawców w czasie rzeczywistym nie są jeszcze podłączone — nie wymyślamy dokładnego stanu magazynowego czy cen sprzedawców.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Kreator Świątecznych List Życzeń | Stwórz i Udostępnij Swoją Listę",
    description: "Stwórz świąteczną listę życzeń, dodaj prezenty z każdego sklepu i udostępnij jeden prosty link rodzinie i przyjaciołom.",
    h1: "Stwórz Świąteczną Listę Życzeń i Udostępnij Jeden Prosty Link",
    lede:
      "Zbuduj świąteczną listę życzeń do udostępnienia w kilka minut. Dodaj prezenty z każdego sklepu lub napisz własne życzenia, a potem wyślij jeden link rodzinie i przyjaciołom.",
    h2: "Jak to działa",
    h2Body: "Stwórz listę, dodaj życzenia, udostępnij jeden link i pozwól ludziom koordynować prezenty bez zdradzania niespodzianki.",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/wishlist", label: "Lista Życzeń" },
    ],
    links: [
      { href: "/pl/christmas/gift-finder", label: "Wypróbuj Wyszukiwarkę Świątecznych Prezentów" },
      { href: "/pl/christmas/tree", label: "Umieść prezenty pod Cyfrową Choinką" },
      { href: "/pl/christmas/photo-generator", label: "Dodaj Świąteczny Portret" },
      { href: "/pl/christmas", label: "Powrót do Bożego Narodzenia" },
    ],
    geo: {
      h2: "Czym jest internetowa świąteczna lista życzeń?",
      body:
        "Internetowa świąteczna lista życzeń to lista prezentów lub doświadczeń, którą można udostępnić i którą ktoś chciałby otrzymać. W TheDigitalGifter tworzysz listę, dodajesz życzenia z linków do produktów lub swobodnego tekstu, udostępniasz jeden link rodzinie i przyjaciołom, i pozwalasz im rezerwować prezenty, dzięki czemu zakupy są skoordynowane bez zdradzania niespodzianki.",
    },
    sections: [
      {
        h2: "Stwórz Świąteczną Listę Życzeń Online",
        body:
          "Nazwij swoją listę, dodaj życzenia i przechowuj wszystkie świąteczne pomysły w jednym miejscu, zamiast rozpraszać linki w rozmowach. Możesz zacząć szybko i edytować w każdej chwili.",
      },
      {
        h2: "Dodaj Wszystko, Czego Sobie Życzysz",
        body:
          "Wklej link do produktu z prawie każdego sklepu, napisz życzenie ręcznie, dodaj notatki i uwzględnij doświadczenia lub rękodzieło. Jeśli link nie może zostać odczytany automatycznie, wciąż możesz zapisać życzenie ręcznie.",
      },
      {
        h2: "Udostępnij Jeden Prosty Link",
        body:
          "Włącz udostępnianie i wyślij jeden link do listy życzeń przez kopiowanie, WhatsApp, e-mail lub menu udostępniania Twojego urządzenia. Udostępnione listy są dostępne dla osób z linkiem i nie są przeznaczone dla wyszukiwarek internetowych.",
      },
      {
        h2: "Unikaj Powielonych Świątecznych Prezentów",
        body:
          "Osoby przeglądające listę mogą kliknąć „Kupuję to”, aby zarezerwować prezent. Rezerwacje pozostają anonimowe dla właściciela listy życzeń, więc niespodzianka pozostaje nienaruszona, a rodzina unika kupowania tej samej rzeczy dwa razy.",
      },
      {
        h2: "Świąteczne Listy Życzeń dla Dzieci i Rodzin",
        body:
          "Stwórz listę dla siebie, swojego dziecka lub kogoś innego, a potem udostępnij ją dziadkom i przyjaciołom. Połącz ją z Wyszukiwarką Prezentów, gdy nie jesteś pewien, o co poprosić.",
        linkHref: "/pl/christmas/gift-finder",
        linkLabel: "Wypróbuj Wyszukiwarkę Świątecznych Prezentów",
      },
    ],
    faqs: [
      {
        q: "Jak stworzyć świąteczną listę życzeń?",
        a: "Otwórz stronę Świątecznej Listy Życzeń, wybierz tytuł i stwórz swoją listę. Następnie dodaj życzenia od razu.",
      },
      {
        q: "Czy mogę dodać prezenty z każdego sklepu?",
        a: "Tak. Wklej zwykły link do produktu lub dodaj prezent ręcznie, jeśli strona nie może zostać odczytana automatycznie.",
      },
      {
        q: "Czy mogę dodać życzenia bez linku?",
        a: "Tak. Napisz dowolne życzenie — doświadczenia, rękodzieło, albo proste „Zaskocz mnie”.",
      },
      {
        q: "Czy mogę udostępnić jeden link do listy?",
        a: "Tak. Włącz udostępnianie i wyślij link rodzinie i przyjaciołom.",
      },
      {
        q: "Czy inni mogą rezerwować prezenty?",
        a: "Tak. Osoby przeglądające listę mogą zarezerwować prezent, aby inni wiedzieli, że jest już zapewniony.",
      },
      {
        q: "Czy będę wiedział, kto co kupił?",
        a: "Nie. Rezerwacje pozostają anonimowe, aby niespodzianka pozostała nienaruszona.",
      },
      {
        q: "Czy mogę stworzyć listę dla swojego dziecka?",
        a: "Tak. Wybierz, dla kogo jest lista podczas jej tworzenia, a potem udostępnij link rodzinie.",
      },
      {
        q: "Czy mogę ją edytować po udostępnieniu?",
        a: "Tak. Dodawaj, edytuj, zmieniaj kolejność lub usuwaj życzenia w każdej chwili. Osoby z linkiem widzą zmiany.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "Generator Świątecznych Zdjęć z AI | Rodzina, Pary i Zwierzęta",
    description: "Zmień swoje ulubione zdjęcie w magiczny portret świąteczny. Twórz świąteczne zdjęcia dla rodziny, par i zwierząt w kilka minut.",
    h1: "Zmień Swoje Zdjęcie w Świąteczną Magię",
    lede: "Wgraj zdjęcie, wybierz świąteczną scenerię i stwórz spersonalizowany portret świąteczny, który możesz pobrać i udostępnić prywatnie.",
    h2: "Style świątecznych zdjęć",
    h2Body: "Twórz portrety dla rodziny, par, zwierząt, psów i kotów w jednym generatorze świątecznych zdjęć.",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
    ],
    links: [
      { href: "/pl/christmas/family", label: "Świąteczne Portrety Rodzinne" },
      { href: "/pl/christmas/couples", label: "Świąteczne Portrety Par" },
      { href: "/pl/christmas/pets", label: "Świąteczne Portrety Zwierząt" },
      { href: "/pl/christmas/dogs", label: "Świąteczne Portrety Psów" },
      { href: "/pl/christmas/cats", label: "Świąteczne Portrety Kotów" },
      { href: "/pl/christmas/cards", label: "Zmień portret w Kartkę Świąteczną" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator świątecznych zdjęć z AI?",
      body:
        "Generator świątecznych zdjęć z AI zmienia rzeczywiste zdjęcie, które wgrywasz, w świąteczny portret. W TheDigitalGifter wybierasz, kto jest na zdjęciu, wybierasz świąteczny styl i tworzysz portret do pobrania dla rodziny, par, osób lub zwierząt — domyślnie prywatny.",
    },
    sections: [
      {
        h2: "Zmień Swoje Zdjęcie w Świąteczny Portret",
        body:
          "Wgraj ulubione zdjęcie, wybierz typ motywu, wybierz świąteczny wygląd i stwórz świąteczny portret, który możesz pobrać. Celem jest świąteczne zdjęcie, które wciąż wygląda jak osoby lub zwierzęta, które kochasz.",
      },
      {
        h2: "Przykłady Świątecznych Zdjęć",
        body: "Przykłady demonstracyjne pokazują popularne kierunki świątecznych portretów. To próbki inspiracyjne, nie zdjęcia klientów.",
        list: [
          "Świąteczne Zdjęcie Rodzinne — portret grupowy w przytulnej świątecznej scenerii",
          "Świąteczny Portret Pary — romantyczny portret dwóch osób",
          "Świąteczny Portret Psa — portret skupiony na psie",
          "Świąteczny Portret Kota — portret skupiony na kocie",
          "Rodzina + Zwierzę — ludzie i zwierzę we wspólnym świątecznym kadrze",
        ],
      },
      {
        h2: "Style Świątecznych Zdjęć",
        body:
          "Dostępne style świąteczne to między innymi Przytulne Święta, Zimowa Kraina Czarów, Luksusowe Święta, Świąteczny Poranek, Zaśnieżona Chata, Klasyczne Święta, Elegancka Biała Choinka i Jarmark Świąteczny. Wybierz wygląd odpowiadający wspomnieniu, które chcesz stworzyć.",
      },
      {
        h2: "Jakie Zdjęcia Działają Najlepiej?",
        body:
          "Użyj wyraźnego zdjęcia z widocznymi twarzami (lub dobrze widocznym zwierzęciem), dobrym oświetleniem i wystarczającą ostrością, aby wszystkie osoby, które chcesz uwzględnić, były rozpoznawalne. Unikaj mocnego rozmycia, agresywnego przycinania lub zdjęć, na których ważne osoby są zasłonięte.",
      },
      {
        h2: "Świąteczne Zdjęcia dla Rodzin, Par i Zwierząt",
        body:
          "Potrzebujesz bardziej konkretnego punktu startowego? Skorzystaj z dedykowanych ścieżek świątecznych portretów dla rodziny, par, zwierząt, psów i kotów — lub kontynuuj tutaj z pełnym generatorem zdjęć.",
        list: [
          "Świąteczne Portrety Rodzinne → /pl/christmas/family",
          "Świąteczne Portrety Par → /pl/christmas/couples",
          "Świąteczne Portrety Zwierząt → /pl/christmas/pets",
          "Świąteczne Portrety Psów → /pl/christmas/dogs",
          "Świąteczne Portrety Kotów → /pl/christmas/cats",
          "Zmień portret w Kartkę Świąteczną → /pl/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "Jak działa generator świątecznych zdjęć?",
        a: "Wgraj zdjęcie, wybierz, kto na nim jest, wybierz świąteczny styl, a potem stwórz swój portret po finalizacji, gdy jest to wymagane przez przepływ produktu.",
      },
      {
        q: "Jakie zdjęcie powinienem wgrać?",
        a: "Najlepiej działa wyraźne zdjęcie z widocznymi twarzami lub dobrze widocznym zwierzęciem. Dobre oświetlenie pomaga. Unikaj mocnego rozmycia.",
      },
      {
        q: "Czy mogę stworzyć rodzinne zdjęcie świąteczne?",
        a: "Tak. Wybierz rodzinę jako motyw lub zacznij od ścieżki Świąteczna Rodzina.",
      },
      {
        q: "Czy mogę stworzyć świąteczny portret mojego psa lub kota?",
        a: "Tak. Zwierzęta są obsługiwane, z dedykowanymi ścieżkami dla psów i kotów dla jasnego startu.",
      },
      {
        q: "Czy mogę uwzględnić wiele osób?",
        a: "Tak, w przepływach rodzinnych i dla par. Wgraj zdjęcie, na którym są wszystkie osoby, które powinny się pojawić.",
      },
      {
        q: "Czy mogę wypróbować różne style?",
        a: "Tak. Wybierz z dostępnych świątecznych stylów na stronie przed stworzeniem.",
      },
      {
        q: "Czy mogę pobrać wynik?",
        a: "Tak. Gdy Twój portret będzie gotowy, pobierz go z ekranu wyniku.",
      },
      {
        q: "Co się dzieje z moim wgranym zdjęciem?",
        a: "Wgrane zdjęcia i wyniki są domyślnie prywatne. Nie ma publicznej galerii. Dostęp odbywa się przez Twój przepływ zamówienia/wyniku.",
      },
    ],
  },

  "/christmas/family": {
    title: "Generator Rodzinnych Zdjęć Świątecznych | Świąteczne Portrety Rodzinne",
    description:
      "Stwórz spersonalizowany rodzinny portret świąteczny z ulubionego zdjęcia rodzinnego. Wybierz świąteczną scenerię i zmień swoje zdjęcie we wspomnienie świąteczne.",
    h1: "Zmień Swoje Rodzinne Zdjęcie w Magiczny Portret Świąteczny",
    lede:
      "Stwórz spersonalizowany rodzinny portret świąteczny z ulubionego zdjęcia rodzinnego. Wybierz świąteczną scenerię i zmień swoje zdjęcie we wspomnienie świąteczne.",
    h2: "Więcej świątecznych portretów",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
      { href: "/pl/christmas/family", label: "Rodzina" },
    ],
    links: [
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas/couples", label: "Świąteczne Portrety Par" },
      { href: "/pl/christmas/pets", label: "Świąteczne Portrety Zwierząt" },
      { href: "/pl/christmas/cards", label: "Kreator Kartek Świątecznych" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator rodzinnych zdjęć świątecznych?",
      body:
        "Generator rodzinnych zdjęć świątecznych zmienia wgrane zdjęcie rodzinne w świąteczny portret grupowy. W TheDigitalGifter wgrywasz wyraźne zdjęcie swojej rodziny, wybierasz świąteczny styl przeznaczony dla wielu osób i tworzysz portret do pobrania — domyślnie prywatny, z opcją przejścia dalej do kartki świątecznej.",
    },
    sections: [
      {
        h2: "Stwórz Rodzinny Portret Świąteczny",
        body:
          "To doświadczenie zostało zbudowane specjalnie dla rodzin — nie jest to generyczny wygląd dla jednej osoby. Wgraj zdjęcie grupowe, wybierz świąteczną atmosferę i stwórz portret, który ma za cel uchwycić wszystkich w kadrze.",
      },
      {
        h2: "Przykłady Rodzinnych Zdjęć Świątecznych",
        body: "Przykłady demonstracyjne pokazują kierunki rodzinnych portretów świątecznych. To próbki inspiracyjne, nie zdjęcia klientów.",
        list: [
          "Rodzice z dzieci w przytulnym świątecznym salonie",
          "Rodzina trzy- lub czteroosobowa przy ozdobionej choince",
          "Większy zjazd rodzinny w świątecznej scenerii",
          "Portrety wielogeneracyjne z dziadkami",
          "Rodzina plus dobrze widoczne zwierzę w tym samym kadrze",
        ],
      },
      {
        h2: "Świąteczne Style dla Rodzin",
        body:
          "Dostępne obecnie style rodzinne to Klasyczne Rodzinne Święta, Przytulny Kominek, Zimowa Kraina Czarów, Elegancka Choinka, Świąteczny Poranek, Luksusowe Święta, Filmowe Święta i Vintage Rodzinne Święta.",
      },
      {
        h2: "Jakie Zdjęcia Rodzinne Działają Najlepiej?",
        body:
          "Użyj wyraźnego zdjęcia grupowego, na którym widoczne są twarze, oświetlenie jest dobre, a wszystkie osoby, które chcesz uwzględnić, są rozpoznawalne. Unikaj mocnego rozmycia, agresywnego przycinania lub zdjęć, na których ważne osoby są zasłonięte.",
      },
      {
        h2: "Rodzinne Kartki Świąteczne",
        body: "Gdy Twój rodzinny portret będzie gotowy, możesz przejść do Kreatora Kartek Świątecznych i dokończyć go wiadomością.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Zmień swój rodzinny portret w kartkę świąteczną",
      },
      {
        h2: "Więcej Świątecznych Portretów",
        body: "Szukasz innego motywu? Zacznij od pełnego generatora zdjęć lub przejdź do par i zwierząt.",
        list: [
          "Generator Świątecznych Zdjęć z AI → /pl/christmas/photo-generator",
          "Świąteczne Portrety Par → /pl/christmas/couples",
          "Świąteczne Portrety Zwierząt → /pl/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Czy mogę stworzyć świąteczny portret z jednego zdjęcia rodzinnego?",
        a: "Tak. Wgraj jedno wyraźne zdjęcie rodzinne, wybierz świąteczny styl i stwórz swój rodzinny portret.",
      },
      {
        q: "Czy mogę uwzględnić wiele osób?",
        a: "Tak. Ta ścieżka jest przeznaczona dla grup. Zadbaj o to, aby wszyscy byli dobrze widoczni na oryginalnym zdjęciu.",
      },
      {
        q: "Czy mogę uwzględnić dziadków?",
        a: "Tak. Zdjęcia wielogeneracyjne — z dziadkami i niemowlętami — są mile widziane, jeśli twarze są widoczne.",
      },
      {
        q: "Czy mogę uwzględnić rodzinne zwierzę?",
        a: "Tak, jeśli zwierzę jest dobrze widoczne na zdjęciu rodzinnym. Dla portretów tylko ze zwierzętami skorzystaj z doświadczeń Zwierzęta, Psy lub Koty.",
      },
      {
        q: "Jakie zdjęcia działają najlepiej?",
        a: "Wyraźne zdjęcia z widocznymi twarzami, dobrym oświetleniem i wszystkimi osobami, które chcesz uwzględnić. Unikaj mocnego rozmycia.",
      },
      {
        q: "Czy mogę wypróbować kilka świątecznych stylów?",
        a: "Tak. Wybierz z rodzinnych świątecznych stylów wymienionych na stronie, a po stworzeniu portretu możesz wypróbować kolejny styl.",
      },
      {
        q: "Czy mogę pobrać gotowy portret?",
        a: "Tak. Gdy Twój portret będzie gotowy, pobierz go z ekranu wyniku.",
      },
      {
        q: "Czy mogę go użyć w kartce świątecznej?",
        a: "Tak. Przeniesienie portretu do Kreatora Kartek Świątecznych jest obsługiwane.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Generator Świątecznych Zdjęć dla Par | Romantyczne Portrety Świąteczne",
    description:
      "Stwórz romantyczny świąteczny portret pary ze swojego zdjęcia. Idealny na pierwsze wspólne Święta lub spersonalizowany prezent dla pary.",
    h1: "Stwórz Magiczny Świąteczny Portret Razem",
    lede: "Wgraj jedno zdjęcie z Wami obojgiem i stwórz romantyczny świąteczny portret pary — domyślnie prywatny.",
    h2: "Więcej świątecznych portretów",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
      { href: "/pl/christmas/couples", label: "Pary" },
    ],
    links: [
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas/family", label: "Świąteczne Portrety Rodzinne" },
      { href: "/pl/christmas/pets", label: "Świąteczne Portrety Zwierząt" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator świątecznych zdjęć dla par?",
      body:
        "Generator świątecznych zdjęć dla par zmienia zdjęcie dwóch osób w romantyczny lub przytulny świąteczny portret pary. W TheDigitalGifter wgrywasz jedno zdjęcie z Wami obojgiem, wybierasz świąteczny styl dla par i tworzysz portret do pobrania, który możesz udostępnić prywatnie lub użyć w kartce świątecznej.",
    },
    sections: [
      {
        h2: "Stwórz Świąteczny Portret Razem",
        body:
          "To doświadczenie jest dla dwóch osób — partnerów, zaręczonych par, męża i żony, albo chłopaka i dziewczyny. Wgraj jedno zdjęcie, na którym Wy oboje jesteście dobrze widoczni, wybierz świąteczny wygląd i stwórz portret stworzony dla Was dwojga.",
      },
      {
        h2: "Pomysły na Świąteczne Zdjęcia Par",
        body: "Zastosowania, do których ten portret często się sprawdza — jako inspiracja, nie jako oddzielne warianty produktu:",
        list: [
          "Pierwsze wspólne Święta",
          "Świąteczny portret zaręczonej pary",
          "Świąteczny portret męża i żony",
          "Świąteczne zdjęcie chłopaka i dziewczyny",
          "Świąteczna niespodzianka na odległość do udostępnienia cyfrowo",
          "Zdjęcie pary na kartkę świąteczną",
        ],
      },
      {
        h2: "Romantyczne Świąteczne Style",
        body:
          "Dostępne obecnie style dla par to Romantyczny Śnieżny Opad, Przytulny Kominek, Filmowe Święta, Elegancka Choinka, Zimowe Miasto, Jarmark Świąteczny, Klasyczny Portret i Vintage Święta.",
      },
      {
        h2: "Jakie Zdjęcia Par Działają Najlepiej?",
        body:
          "Użyj jednego wyraźnego zdjęcia, na którym widoczne są obie twarze i żadna osoba nie jest silnie przycięta. Dobre oświetlenie pomaga. Selfie mogą się sprawdzić, jeśli obie osoby są rozpoznawalne.",
      },
      {
        h2: "Zmień to w Kartkę Świąteczną",
        body: "Po stworzeniu portretu pary możesz przenieść go do Kreatora Kartek Świątecznych.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Zmień swój portret pary w kartkę świąteczną",
      },
      {
        h2: "Powiązane Świąteczne Portrety",
        body: "Potrzebujesz zamiast tego portretu rodzinnego lub zwierzęcego?",
        list: [
          "Świąteczne Portrety Rodzinne → /pl/christmas/family",
          "Generator Świątecznych Zdjęć z AI → /pl/christmas/photo-generator",
          "Świąteczne Portrety Zwierząt → /pl/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "Czy mogę użyć selfie?",
        a: "Tak, jeśli obie osoby są dobrze widoczne i rozpoznawalne na tym samym zdjęciu.",
      },
      {
        q: "Czy obie osoby zostaną rozpoznawalne?",
        a: "To jest cel. Zacznij od wyraźnego zdjęcia obu twarzy — unikaj mocnego rozmycia lub sytuacji, gdy jedna osoba jest w większości poza kadrem.",
      },
      {
        q: "Czy mogę stworzyć romantyczny świąteczny portret?",
        a: "Tak. Wybierz romantyczne lub przytulne style dla par, takie jak Romantyczny Śnieżny Opad, Przytulny Kominek lub Elegancka Choinka.",
      },
      {
        q: "Czy mogę wypróbować różne style?",
        a: "Tak. Wybierz ze świątecznych stylów dla par na stronie przed stworzeniem.",
      },
      {
        q: "Czy mogę użyć wyniku jako kartki świątecznej?",
        a: "Tak. Przeniesienie portretu do Kreatora Kartek Świątecznych jest obsługiwane.",
      },
      {
        q: "Czy mogę go pobrać?",
        a: "Tak. Pobierz gotowy portret pary z ekranu wyniku, gdy będzie gotowy.",
      },
      {
        q: "Jakie zdjęcie powinienem wgrać?",
        a: "Jedno wyraźne zdjęcie z Wami obojgiem. Twarze powinny być widoczne; działa JPEG, PNG lub WebP.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Generator Świątecznych Zdjęć Zwierząt | Świąteczne Portrety Zwierząt",
    description: "Zmień zdjęcie swojego zwierzęcia w świąteczny portret. Psy i koty są mile widziane — domyślnie prywatnie.",
    h1: "Zmień Swoje Zwierzę w Świąteczną Magię",
    lede: "Wgraj wyraźne zdjęcie zwierzęcia i stwórz świąteczny portret zwierzęcia dla psa lub kota.",
    h2: "Świąteczne portrety według gatunku",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
      { href: "/pl/christmas/pets", label: "Zwierzęta" },
    ],
    links: [
      { href: "/pl/christmas/dogs", label: "Świąteczne Portrety Psów" },
      { href: "/pl/christmas/cats", label: "Świąteczne Portrety Kotów" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator świątecznych zdjęć zwierząt?",
      body:
        "Generator świątecznych zdjęć zwierząt zmienia zdjęcie psa, kota lub innego zwierzęcia w świąteczny portret zwierzęcia. W TheDigitalGifter strona Zwierzęta jest centrum świątecznych portretów zwierząt, z dedykowanymi ścieżkami dla psów i kotów, wynikami do pobrania i opcjonalnym przejściem do kartki świątecznej.",
    },
    sections: [
      {
        h2: "Zmień Swoje Zwierzę w Świąteczną Magię",
        body:
          "Wgraj wyraźne zdjęcie zwierzęcia, wybierz świąteczny styl zwierzęcy i stwórz świąteczny portret zwierzęcia, które kochasz. To jest ogólne centrum zwierząt — nie zestaw z komiksem.",
      },
      {
        h2: "Świąteczne Portrety dla Psów i Kotów",
        body:
          "Chcesz jasnego startu dla jednego gatunku? Skorzystaj z dedykowanych ścieżek dla psa lub kota — pomagają zweryfikować zdjęcie i skupiają doświadczenie na psie lub kocie.",
        list: [
          "Generator Świątecznych Zdjęć Psów → /pl/christmas/dogs",
          "Generator Świątecznych Zdjęć Kotów → /pl/christmas/cats",
        ],
      },
      {
        h2: "Przykłady Świątecznych Zdjęć Zwierząt",
        body: "Kierunki demonstracyjne dla świątecznych portretów zwierząt. Próbki są inspiracją, nie zdjęciami klientów.",
        list: [
          "Świąteczny portret psa w świątecznej scenerii",
          "Świąteczny portret kota przy choince lub kominku",
          "Przytulne style portretu w sweterku lub inspirowane Świętym Mikołajem",
        ],
      },
      {
        h2: "Świąteczne Style dla Zwierząt",
        body:
          "Dostępne obecnie style zwierzęce to Zwierzęcy Święty Mikołaj, Przytulne Święta, Biegun Północny, Świąteczny Sweterek, Portret Śnieżny, Kartka Świąteczna, Królewskie Święta i Vintage Święta.",
      },
      {
        h2: "Jakie Zdjęcia Zwierząt Działają Najlepiej?",
        body:
          "Wybierz wyraźne zdjęcie z widocznymi pyskiem i oczami zwierzęcia, dobrym oświetleniem i bez mocnego rozmycia. Jeśli ma się pojawić więcej niż jedno zwierzę, upewnij się, że każde z nich jest widoczne na wgranym zdjęciu.",
      },
      {
        h2: "Kartki Świąteczne ze Zwierzętami",
        body: "Możesz przenieść gotowy portret zwierzęcia do Kreatora Kartek Świątecznych.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Zmień portret swojego zwierzęcia w kartkę świąteczną",
      },
    ],
    faqs: [
      {
        q: "Czy mogę stworzyć świąteczny portret mojego psa?",
        a: "Tak. Zacznij tutaj lub przejdź do dedykowanej strony świątecznych portretów psów dla ścieżki skupionej na psie.",
      },
      {
        q: "Czy mogę stworzyć taki dla mojego kota?",
        a: "Tak. Skorzystaj z tego centrum Zwierzęta lub dedykowanej strony świątecznych portretów kotów.",
      },
      {
        q: "Czy mogę uwzględnić więcej niż jedno zwierzę?",
        a: "Jeśli wiele zwierząt jest dobrze widocznych na jednym zdjęciu, możesz wypróbować takie wgranie. Wyniki są najlepsze, gdy pysk każdego zwierzęcia jest łatwo widoczny.",
      },
      {
        q: "Czy mogę pojawić się na zdjęciu razem ze swoim zwierzęciem?",
        a: "Ta ścieżka jest zoptymalizowana pod zwierzę jako główną postać. Dla kadrów z ludźmi i zwierzęciem lepszym startem jest zwykle doświadczenie Świąteczna Rodzina.",
      },
      {
        q: "Jakie zdjęcia działają najlepiej?",
        a: "Wyraźne zdjęcia zwierząt z widocznymi oczami i pyskiem, dobrym oświetleniem i ograniczonym rozmyciem.",
      },
      {
        q: "Czy mogę pobrać obrazek?",
        a: "Tak. Pobierz z ekranu wyniku, gdy portret Twojego zwierzęcia będzie gotowy.",
      },
      {
        q: "Czy mogę go użyć na kartce świątecznej?",
        a: "Tak. Przeniesienie portretu do Kreatora Kartek Świątecznych jest obsługiwane.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Generator Świątecznych Zdjęć Psów | Świąteczne Portrety Psów",
    description: "Stwórz magiczny świąteczny portret swojego psa z wyraźnego zdjęcia. Weryfikacja gatunku i domyślna prywatność.",
    h1: "Stwórz Magiczny Świąteczny Portret Swojego Psa",
    lede: "Wgraj wyraźne zdjęcie psa, wybierz świąteczny styl i stwórz świąteczny portret psa.",
    h2: "Powiązane portrety zwierząt",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
      { href: "/pl/christmas/pets", label: "Zwierzęta" },
      { href: "/pl/christmas/dogs", label: "Psy" },
    ],
    links: [
      { href: "/pl/christmas/cats", label: "Świąteczne Portrety Kotów" },
      { href: "/pl/christmas/pets", label: "Wszystkie Świąteczne Portrety Zwierząt" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator świątecznych zdjęć psów?",
      body:
        "Generator świątecznych zdjęć psów tworzy świąteczny portret ze zdjęcia Twojego psa. W TheDigitalGifter wgrywasz wyraźne zdjęcie psa, wybierasz świąteczny styl zwierzęcy i pobierasz świąteczny portret skupiony na psie — z opcjonalną ścieżką do kartki świątecznej.",
    },
    sections: [
      {
        h2: "Stwórz Świąteczny Portret Swojego Psa",
        body:
          "Ta strona jest specyficzna dla psów. Wgraj zdjęcie swojego psa, wybierz świąteczny styl i stwórz świąteczny portret, w którym pies pozostaje wyraźnym motywem. Jeśli zdjęcie wygląda jak kot, zostaniesz przekierowany do doświadczenia dla kotów.",
      },
      {
        h2: "Przykłady Świątecznych Portretów Psów",
        body: "Kierunki demonstracyjne dla świątecznych portretów psów — próbki inspiracyjne, nie zdjęcia klientów.",
        list: [
          "Pies przy ozdobionej choince",
          "Przytulny świąteczny portret psa przy kominku",
          "Zaśnieżony świąteczny portret psa",
          "Portret psa inspirowany Świętym Mikołajem lub w sweterku",
        ],
      },
      {
        h2: "Świąteczne Style dla Psów",
        body:
          "Portrety psów wykorzystują zestaw stylów zwierzęcych: Zwierzęcy Święty Mikołaj, Przytulne Święta, Biegun Północny, Świąteczny Sweterek, Portret Śnieżny, Kartka Świąteczna, Królewskie Święta i Vintage Święta.",
      },
      {
        h2: "Jak Wybrać Dobre Zdjęcie Psa",
        body:
          "Wybierz zdjęcie, na którym widoczne są oczy i pysk psa, głowa nie jest silnie przycięta, a rozmycie jest minimalne. Dla więcej niż jednego psa upewnij się, że każdy pies, który powinien być na portrecie, jest wyraźnie w kadrze.",
      },
      {
        h2: "Kartki Świąteczne z Twoim Psem",
        body: "Gotowe portrety psów mogą przejść dalej do Kreatora Kartek Świątecznych.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Zrób kartkę świąteczną z portretem swojego psa",
      },
      {
        h2: "Powiązane Świąteczne Portrety Zwierząt",
        body: "Eksplorujesz inne zwierzęta lub ogólne centrum zwierząt?",
        list: [
          "Świąteczne Portrety Zwierząt → /pl/christmas/pets",
          "Generator Świątecznych Zdjęć Kotów → /pl/christmas/cats",
          "Generator Świątecznych Zdjęć z AI → /pl/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Czy mogę stworzyć świąteczny portret mojego psa?",
        a: "Tak. Wgraj na tej stronie wyraźne zdjęcie psa, wybierz świąteczny styl i stwórz portret.",
      },
      {
        q: "Co, jeśli przez pomyłkę wgram zdjęcie kota?",
        a: "Otrzymasz podpowiedź, aby przełączyć się na doświadczenie świątecznych portretów kotów.",
      },
      {
        q: "Czy mogę uwzględnić więcej niż jednego psa?",
        a: "Tak, jeśli każdy pies jest dobrze widoczny na tym samym zdjęciu. Pyski i oczy powinny być łatwo widoczne.",
      },
      {
        q: "Jakie zdjęcia psów działają najlepiej?",
        a: "Wyraźny pysk i oczy, ograniczone rozmycie, i unikaj przycinania uszu lub głowy.",
      },
      {
        q: "Czy mogę wypróbować różne świąteczne style dla mojego psa?",
        a: "Tak. Wybierz z świątecznych stylów zwierzęcych przeznaczonych dla psów, wymienionych na stronie.",
      },
      {
        q: "Czy mogę pobrać portret psa?",
        a: "Tak. Pobierz go z ekranu wyniku, gdy będzie gotowy.",
      },
      {
        q: "Czy mogę umieścić mojego psa na kartce świątecznej?",
        a: "Tak. Skorzystaj z przeniesienia do Kreatora Kartek Świątecznych po tym, jak portret będzie gotowy.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Generator Świątecznych Zdjęć Kotów | Świąteczne Portrety Kotów",
    description: "Stwórz magiczny świąteczny portret swojego kota z wyraźnego zdjęcia. Weryfikacja gatunku i domyślna prywatność.",
    h1: "Stwórz Magiczny Świąteczny Portret Swojego Kota",
    lede: "Wgraj wyraźne zdjęcie kota, wybierz świąteczny styl i stwórz świąteczny portret kota.",
    h2: "Powiązane portrety zwierząt",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/photo-generator", label: "Generator Zdjęć" },
      { href: "/pl/christmas/pets", label: "Zwierzęta" },
      { href: "/pl/christmas/cats", label: "Koty" },
    ],
    links: [
      { href: "/pl/christmas/dogs", label: "Świąteczne Portrety Psów" },
      { href: "/pl/christmas/pets", label: "Wszystkie Świąteczne Portrety Zwierząt" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć z AI" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator świątecznych zdjęć kotów?",
      body:
        "Generator świątecznych zdjęć kotów tworzy świąteczny portret ze zdjęcia Twojego kota. W TheDigitalGifter wgrywasz wyraźne zdjęcie kota, wybierasz świąteczny styl zwierzęcy i pobierasz świąteczny portret skupiony na kocie, który możesz też wykorzystać w kartce świątecznej.",
    },
    sections: [
      {
        h2: "Stwórz Magiczny Świąteczny Portret Swojego Kota",
        body:
          "Ta strona jest specyficzna dla kotów. Wgraj zdjęcie swojego kota, wybierz świąteczny wygląd i stwórz świąteczny portret z kotem w roli głównej. Zdjęcia psów są przekierowywane do doświadczenia dla psów.",
      },
      {
        h2: "Przykłady Świątecznych Portretów Kotów",
        body: "Kierunki demonstracyjne z kotami — próbki inspiracyjne, nie zdjęcia klientów.",
        list: [
          "Kot przy choince",
          "Przytulny świąteczny portret kota przy kominku",
          "Zaśnieżony lub elegancki świąteczny portret kota",
          "Style portretu królewskiego lub vintage dla kotów w Święta",
        ],
      },
      {
        h2: "Świąteczne Style dla Kotów",
        body:
          "Portrety kotów wykorzystują zestaw stylów zwierzęcych: Zwierzęcy Święty Mikołaj, Przytulne Święta, Biegun Północny, Świąteczny Sweterek, Portret Śnieżny, Kartka Świąteczna, Królewskie Święta i Vintage Święta.",
      },
      {
        h2: "Jak Wybrać Dobre Zdjęcie Kota",
        body:
          "Wybierz zdjęcie, na którym oczy i pysk Twojego kota są ostre i widoczne. Unikaj mocnego rozmycia, ciężkiego cienia na pysku lub ciasnego przycięcia, które odcina uszy i wąsy.",
      },
      {
        h2: "Zmień Portret Swojego Kota w Kartkę Świąteczną",
        body: "Po stworzeniu świątecznego portretu kota możesz przejść do Kreatora Kartek Świątecznych.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Zrób kartkę świąteczną z portretem swojego kota",
      },
      {
        h2: "Powiązane Świąteczne Portrety Zwierząt",
        body: "Potrzebujesz psów lub ogólnego centrum zwierząt?",
        list: [
          "Świąteczne Portrety Zwierząt → /pl/christmas/pets",
          "Generator Świątecznych Zdjęć Psów → /pl/christmas/dogs",
          "Generator Świątecznych Zdjęć z AI → /pl/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "Czy mogę stworzyć świąteczny portret mojego kota?",
        a: "Tak. Wgraj tutaj wyraźne zdjęcie kota, wybierz świąteczny styl i stwórz portret.",
      },
      {
        q: "Co, jeśli wgram zdjęcie psa?",
        a: "Zostaniesz poprowadzony do przełączenia się na stronę świątecznych portretów psów.",
      },
      {
        q: "Czy wąsy i szczegóły pyska mają znaczenie?",
        a: "Tak. Wyraźny pysk i oczy zwykle dają silniejszy świąteczny portret kota.",
      },
      {
        q: "Czy mogę wypróbować elegancki lub przytulny wygląd dla mojego kota?",
        a: "Tak. Style obejmują Przytulne Święta, Królewskie Święta, Vintage Święta, Portret Śnieżny i więcej.",
      },
      {
        q: "Czy mogę pobrać portret kota?",
        a: "Tak. Pobierz go z ekranu wyniku, gdy będzie gotowy.",
      },
      {
        q: "Czy mogę użyć portretu mojego kota na kartce świątecznej?",
        a: "Tak. Przeniesienie do Kreatora Kartek jest obsługiwane po stworzeniu portretu.",
      },
      {
        q: "Czy to różni się od strony Zwierzęta?",
        a: "Tak. Zwierzęta to ogólne centrum zwierząt; ta strona jest przeznaczona specjalnie dla kotów.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Spersonalizowany Film od Świętego Mikołaja | Święty Mikołaj Mówi Imię Twojego Dziecka",
    description:
      "Stwórz spersonalizowany świąteczny film od Świętego Mikołaja, który może zawierać imię odbiorcy i inne obsługiwane szczegóły osobiste.",
    h1: "Stwórz Spersonalizowany Film od Świętego Mikołaja",
    lede:
      "Stwórz spersonalizowany świąteczny film od Świętego Mikołaja, który może zawierać imię odbiorcy i inne obsługiwane szczegóły osobiste.",
    h2: "Jak Działają Filmy od Świętego Mikołaja",
    h2Body: "Powiedz Świętemu Mikołajowi, dla kogo jest film, dodaj kilka szczegółów, a potem stwórz spersonalizowany świąteczny film.",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/santa-video", label: "Film od Świętego Mikołaja" },
    ],
    links: [
      { href: "/pl/christmas/family", label: "Świąteczne Portrety Rodzinne" },
      { href: "/pl/christmas/cards", label: "Kreator Kartek Świątecznych" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest spersonalizowany film od Świętego Mikołaja?",
      body:
        "Spersonalizowany film od Świętego Mikołaja to świąteczny film z wiadomością, który może zawierać imię odbiorcy i inne szczegóły, które podasz. W TheDigitalGifter wypełniasz krótki, prowadzony formularz, sprawdzasz wiadomość, a potem tworzysz film, który możesz pobrać i udostępnić. Wiadomości są tworzone w języku angielskim lub rumuńskim — Święty Mikołaj w tym narzędziu jeszcze nie przemawia po polsku.",
    },
    sections: [
      {
        h2: "Spersonalizowana Wiadomość od Świętego Mikołaja",
        body:
          "Stwórz świąteczny film od Świętego Mikołaja dla dziecka, rodzeństwa, rodziny lub kogoś specjalnego. Święty Mikołaj może powiedzieć imię i uwzględnić opcjonalne szczegóły, które podasz — a potem pobierz lub udostępnij gotowy film. Film jest nagrany w języku angielskim lub rumuńskim.",
      },
      {
        h2: "Co Może Wspomnieć Święty Mikołaj?",
        body:
          "Możesz spersonalizować film imieniem odbiorcy, opcjonalnym wiekiem, czymś, co dobrze zrobił w tym roku, świątecznym życzeniem, dodatkowym szczegółem (np. zwierzęciem lub hobby) i językiem Świętego Mikołaja. Obecnie obsługiwane języki to angielski i rumuński.",
        list: ["Imię odbiorcy", "Opcjonalny wiek", "Coś, co zrobił dobrze", "Świąteczne życzenie", "Dodatkowy osobisty szczegół", "Język: angielski lub rumuński"],
      },
      {
        h2: "Przykłady Spersonalizowanych Filmów od Świętego Mikołaja",
        body: "Przykłady demonstracyjne pokazują, jak może wyglądać spersonalizowana wiadomość od Świętego Mikołaja. To demonstracje produktu dla inspiracji, nie referencje klientów.",
      },
      {
        h2: "Jak To Działa",
        body: "Powiedz Świętemu Mikołajowi, dla kogo jest wiadomość, dodaj szczegóły, które chcesz uwzględnić, sprawdź podgląd wiadomości, stwórz film, a potem pobierz lub udostępnij go, gdy będzie gotowy.",
        list: ["Powiedz Świętemu Mikołajowi o tej osobie", "Sprawdź wiadomość", "Stwórz film", "Pobierz lub udostępnij"],
      },
      {
        h2: "Więcej Świątecznej Magii",
        body: "Po Świętym Mikołaju wiele rodzin tworzy również świąteczny portret lub kartkę dla tej samej osoby.",
        linkHref: "/pl/christmas",
        linkLabel: "Powrót do Bożego Narodzenia w TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "Czy Święty Mikołaj może powiedzieć imię mojego dziecka?",
        a: "Tak. Imię odbiorcy jest głównym polem personalizacji i Święty Mikołaj wypowiada je w filmie, nagranym w języku angielskim lub rumuńskim.",
      },
      {
        q: "Co mogę spersonalizować?",
        a: "Imię, opcjonalny wiek, coś, co zrobił dobrze, świąteczne życzenie, dodatkowy szczegół i język (angielski lub rumuński).",
      },
      {
        q: "Czy Święty Mikołaj może wspomnieć świąteczny prezent?",
        a: "Tak — możesz dodać świąteczne życzenie, a Święty Mikołaj może je wspomnieć, gdy je podasz.",
      },
      {
        q: "Czy mogę stworzyć film dla rodzeństwa?",
        a: "Tak. Wybierz opcję rodzeństwa i podaj ich imiona w kroku dotyczącym imienia. Dedykowany przepływ dla wielu dzieci może zostać rozszerzony w przyszłości.",
      },
      {
        q: "Czy Święty Mikołaj mówi po polsku?",
        a: "Jeszcze nie. Obecnie obsługiwane języki filmu od Świętego Mikołaja to angielski i rumuński.",
      },
      {
        q: "Czy mogę wcześniej zobaczyć podgląd wiadomości?",
        a: "Tak. Możesz sprawdzić wiadomość przed stworzeniem filmu.",
      },
      {
        q: "Czy mogę pobrać lub udostępnić film?",
        a: "Tak. Gdy film będzie gotowy, możesz pobrać plik MP4 i go udostępnić.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Cyfrowa Choinka | Prezenty, Wiadomości i Wspomnienia",
    description: "Zbuduj cyfrową choinkę pełną prezentów, wiadomości i wspomnień, którą możesz udekorować i bezpiecznie udostępnić.",
    h1: "Zbuduj Choinkę Pełną Niespodzianek",
    lede: "Stwórz, udekoruj i udostępnij spersonalizowaną cyfrową choinkę z prezentami i wiadomościami pod nią.",
    h2: "Połącz ze Świątecznymi Prezentami",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/tree", label: "Cyfrowa Choinka" },
    ],
    links: [
      { href: "/pl/christmas/wishlist", label: "Kreator Świątecznych List Życzeń" },
      { href: "/pl/christmas/gift-finder", label: "Wyszukiwarka Świątecznych Prezentów" },
      { href: "/pl/christmas/messages", label: "Generator Wiadomości Świątecznych" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest cyfrowa choinka?",
      body:
        "Cyfrowa choinka to interaktywna, internetowa choinka, którą można dostosować i udostępnić. W TheDigitalGifter wybierasz wygląd choinki, dodajesz ozdoby, umieszczasz pod nią pudełka z prezentami z osobistymi wiadomościami i udostępniasz prywatny link, aby ktoś specjalny mógł otworzyć prezenty na swoim ekranie — bez zmieniania strony udostępniania w publiczny wynik wyszukiwania.",
    },
    sections: [
      {
        h2: "Zbuduj Cyfrową Choinkę",
        body:
          "Stwórz bezpłatną, interaktywną choinkę w swoim przeglądarce. Dostosuj styl (Klasyczny, Zaśnieżony, Złoty, Przytulny, Minimalistyczny lub Magiczny), lampki, śnieg, szczyty i ozdoby, a potem umieść pod nią pudełka z prezentami.",
      },
      {
        h2: "Co Można Umieścić Pod Choinką?",
        body:
          "Obecnie możesz dodawać pudełka z prezentami, które zawierają osobiste świąteczne wiadomości. Każdy prezent może mieć świąteczny styl pudełka, taki jak czerwony, złoty, zielony, niebieski lub śnieżny. Dodatkowe typy prezentów mogą zostać dodane w przyszłości — obecny kreator skupia się na prezentach z wiadomością.",
        list: ["Osobiste świąteczne wiadomości w pudełkach z prezentami", "Świąteczne style pudełek (czerwony, złoty, zielony, niebieski, śnieżny)"],
      },
      {
        h2: "Udostępnij Swoją Choinkę",
        body:
          "Gdy będziesz gotowy, włącz udostępnianie i wyślij jeden link. Odbiorcy otwierają choinkę, aby zobaczyć ozdoby i rozpakować prezenty. Udostępnione linki do choinki są przeznaczone dla osób, którym ufasz, i nie są indeksowane przez wyszukiwarki internetowe.",
      },
      {
        h2: "Prezent Stworzony, Aby Być Otwarty",
        body:
          "Odbiorcy mogą stuknąć w prezenty pod choinką, aby odkryć wiadomości, które zostawiłeś — cyfrowa chwila, która ma wywoływać wrażenie czegoś umieszczonego specjalnie dla nich.",
      },
      {
        h2: "Jak To Działa",
        body: "Prosta droga od puste choinki do świątecznej niespodzianki do udostępnienia.",
        list: [
          "Stwórz i dostosuj swoją cyfrową choinkę",
          "Dodaj pudełka z prezentami z wiadomościami",
          "Włącz udostępnianie i wyślij link",
          "Odbiorca otwiera prezenty pod choinką",
        ],
      },
      {
        h2: "Więcej Świątecznej Magii",
        body: "Połącz swoją choinkę z innymi świątecznymi kreacjami, gdy chcesz czegoś dodatkowego w świątecznym nastroju.",
        list: ["Centrum świąt → /pl/christmas", "Spersonalizowany Film od Świętego Mikołaja → /pl/christmas/santa-video", "Internetowy Kalendarz Adwentowy → /pl/christmas/advent"],
      },
    ],
    faqs: [
      {
        q: "Czym jest cyfrowa choinka?",
        a: "Interaktywna, internetowa choinka, którą dostosowujesz, wypełniasz prezentami z wiadomością i udostępniasz, aby ktoś mógł je otworzyć na swoim urządzeniu.",
      },
      {
        q: "Co mogę do niej dodać?",
        a: "Obecnie możesz dodawać pudełka z prezentami z osobistymi świątecznymi wiadomościami i wybierać świąteczne style pudełek.",
      },
      {
        q: "Czy mogę ją udostępnić komuś?",
        a: "Tak. Włącz udostępnianie i wyślij link. Traktuj go jako osobisty link do prezentu.",
      },
      {
        q: "Czy odbiorcy mogą otworzyć prezenty?",
        a: "Tak. Odbiorcy mogą stuknąć w prezenty pod choinką, aby odkryć wiadomości, które dodałeś.",
      },
      {
        q: "Czy mogę dodać film od Świętego Mikołaja lub świąteczne zdjęcie pod choinką?",
        a: "Nie jako dedykowany typ prezentu w obecnym kreatorze choinki. Możesz nadal stworzyć te doświadczenia osobno i wspomnieć o nich w prezencie z wiadomością.",
      },
      {
        q: "Czy potrzebuję konta?",
        a: "Możesz zacząć tworzyć choinkę bez skomplikowanej konfiguracji — własność jest zarządzana przez sesję tworzenia, dzięki czemu możesz kontynuować edycję.",
      },
      {
        q: "Czy udostępniona choinka jest publiczna?",
        a: "Udostępnione choinki są dostępne dla osób z linkiem, ale strony udostępniania są oznaczone jako noindex i nie są przeznaczone dla wyszukiwarek internetowych.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Internetowy Świąteczny Kalendarz Adwentowy | Niespodzianka Każdego Dnia",
    description: "Otwieraj nową cyfrową świąteczną niespodziankę każdego dnia od 1 do 24 grudnia.",
    h1: "Odrobina Świątecznej Magii Każdego Dnia",
    lede: "Otwieraj nową cyfrową świąteczną niespodziankę każdego dnia od 1 do 24 grudnia.",
    h2: "Więcej Świątecznej Magii",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/advent", label: "Kalendarz Adwentowy" },
    ],
    links: [
      { href: "/pl/christmas/santa-video", label: "Spersonalizowany Film od Świętego Mikołaja" },
      { href: "/pl/christmas/cards", label: "Kreator Kartek Świątecznych" },
      { href: "/pl/christmas/wishlist", label: "Świąteczna Lista Życzeń" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest internetowy kalendarz adwentowy?",
      body:
        "Internetowy kalendarz adwentowy to cyfrowa wersja tradycyjnego kalendarza adwentowego: nowe okienko odblokowuje się każdego dnia grudnia, prowadząc do Świąt. W TheDigitalGifter otwierasz dzisiejsze okienko w kalendarzu od 1 do 24 (czas Europe/Bucharest). Poprzednie okienka pozostają zamknięte po zakończeniu danego dnia, a niektóre nagrody mogą wymagać zalogowania, gdy odbiory są aktywne.",
    },
    sections: [
      {
        h2: "Odrobina Świątecznej Magii Każdego Dnia",
        body:
          "Kalendarz adwentowy to doświadczenie odliczania z dwudziestoma czterema okienkami. Każdy dzień grudnia ma swoje własne okienko — mały rytuał otwierania czegoś nowego w miarę zbliżania się Świąt.",
      },
      {
        h2: "Otwieraj Nowe Okienko Każdego Dnia",
        body:
          "Okienka odpowiadają dniowi kalendarzowemu w strefie czasowej Europe/Bucharest. Tylko dzisiejsze okienko jest dostępne do otwarcia. Przyszłe okienka pozostają zablokowane. Pominięte dni nie otwierają się ponownie w celu nadrobienia.",
      },
      {
        h2: "Co Może Być za Okienkami?",
        body:
          "Nagrody za okienkami to świąteczne akcenty skonfigurowane na sezon — takie jak niespodziewany odbiór, gdy produkcyjne odbiory są aktywne. Dostępność może zależeć od ustawień sezonu i tego, czy jesteś zalogowany.",
      },
      {
        h2: "Przed 1 Grudnia",
        body: "Przed rozpoczęciem okna adwentowego okienka pokazują się jako „wkrótce”. Wróć, gdy zacznie się grudzień, aby otworzyć dzień pierwszy.",
      },
      {
        h2: "Jak Działa Kalendarz Adwentowy",
        body: "Proste kroki dla cyfrowego doświadczenia adwentowego.",
        list: [
          "Otwórz stronę Kalendarza Adwentowego",
          "Znajdź dzisiejsze okienko (1–24 w grudniu)",
          "Otwórz je, gdy będzie dostępne",
          "Zaloguj się, jeśli odbiór wymaga konta",
        ],
      },
      {
        h2: "Więcej Świątecznej Magii",
        body: "Kontynuuj sezon z cyfrową choinką lub centrum świąt.",
        list: ["Cyfrowa Choinka → /pl/christmas/tree", "Centrum świąt → /pl/christmas"],
      },
    ],
    faqs: [
      {
        q: "Kiedy zaczyna się kalendarz adwentowy?",
        a: "Okienka są przypisane do dni grudnia od 1 do 24. Przed 1 grudnia okienka pokazują się jako „wkrótce”.",
      },
      {
        q: "Kiedy odblokowuje się każde okienko?",
        a: "Każde okienko odblokowuje się w swoim dniu kalendarzowym, w strefie czasowej Europe/Bucharest.",
      },
      {
        q: "Czy mogę otworzyć wcześniejsze okienka?",
        a: "Nie. Pominięte dni pozostają zamknięte — tylko dzisiejsze okienko jest dostępne.",
      },
      {
        q: "Czy kalendarz jest bezpłatny?",
        a: "Przeglądanie doświadczenia kalendarza jest bezpłatne. Niektóre odbiory nagród mogą wymagać konta, gdy odbiory są aktywne na dany sezon.",
      },
      {
        q: "Co mogę znaleźć za okienkiem?",
        a: "Sezonowe świąteczne niespodzianki skonfigurowane na dany dzień, gdy odbiory są aktywne — nie jest to gwarancja nagród pieniężnych czy kredytów sklepowych każdego dnia.",
      },
      {
        q: "Czy potrzebuję konta?",
        a: "Możesz oglądać kalendarz bez konta. Odebranie niektórych nagród za okienka może wymagać zalogowania.",
      },
      {
        q: "Czy mogę go używać na telefonie?",
        a: "Tak. Kalendarz adwentowy jest zaprojektowany tak, by działać zarówno na telefonach, jak i na komputerach.",
      },
      {
        q: "Czy mogę go udostępnić?",
        a: "Możesz udostępnić link do strony Kalendarza Adwentowego, aby inni mogli otwierać swoje własne codzienne okienka.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Kreator Kartek Świątecznych | Spersonalizowane Kartki Świąteczne",
    description: "Stwórz spersonalizowaną kartkę świąteczną, którą będą chcieli zachować — wybierz projekt, dodaj swoją wiadomość i udostępnij lub pobierz.",
    h1: "Stwórz Kartkę Świąteczną, Którą Będą Chcieli Zachować",
    lede: "Zaprojektuj spersonalizowaną kartkę świąteczną z świątecznymi układami i własną wiadomością. Niektóre wiadomości zasługują na więcej niż tekst.",
    h2: "Połącz z Wiadomościami Świątecznymi",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/cards", label: "Kartki" },
    ],
    links: [
      { href: "/pl/christmas/messages", label: "Generator Wiadomości Świątecznych" },
      { href: "/pl/christmas/photo-generator", label: "Generator Świątecznych Zdjęć" },
      { href: "/pl/christmas/family", label: "Świąteczne Portrety Rodzinne" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest internetowy kreator kartek świątecznych?",
      body:
        "Internetowy kreator kartek świątecznych pozwala stworzyć spersonalizowaną kartkę świąteczną ze zdjęciem, świątecznym projektem i własną wiadomością. W TheDigitalGifter możesz wgrać zdjęcie lub użyć świątecznego portretu, wybrać styl, napisać wiadomość lub otrzymać pomoc, a potem pobrać plik PNG lub udostępnić kartkę cyfrowo.",
    },
    sections: [
      {
        h2: "Stwórz Spersonalizowaną Kartkę Świąteczną",
        body:
          "Wybierz styl kartki świątecznej, dodaj swoje zdjęcie, napisz wiadomość i stwórz cyfrową kartkę, którą możesz pobrać lub udostępnić. Niektóre wiadomości zasługują na więcej niż tekst — to jest właśnie dla takich sytuacji.",
      },
      {
        h2: "Przykłady Kartek Świątecznych",
        body: "Odkryj kierunki takie jak rodzinne, dla par, ze zwierzętami, elegantkie, zabawne i klasyczne kartki świąteczne. Przykłady są inspiracją projektową dla stylów dostępnych w kreatorze.",
        list: ["Rodzina", "Para", "Zwierzę", "Elegancka", "Zabawna", "Klasyczna"],
      },
      {
        h2: "Użyj Swojego Świątecznego Portretu",
        body:
          "Jeśli już stworzyłeś świąteczny portret, możesz przenieść go do kreatora kartek i dokończyć wiadomością. Przeniesienie portretu jest obsługiwane z przepływu Generatora Świątecznych Zdjęć.",
        linkHref: "/pl/christmas/photo-generator",
        linkLabel: "Najpierw stwórz świąteczny portret",
      },
      {
        h2: "Wiadomości na Kartki Świąteczne",
        body:
          "Napisz własne słowa lub skorzystaj z wbudowanej pomocy w tworzeniu wiadomości jako punktu wyjścia. Dla bardziej prowadzonych życzeń Generator Wiadomości Świątecznych może pomóc znaleźć odpowiedni ton.",
        linkHref: "/pl/christmas/messages",
        linkLabel: "Znajdź świąteczną wiadomość",
      },
      {
        h2: "Jak Zrobić Kartkę Świąteczną Online",
        body: "Prosta droga od pustej strony do kartki świątecznej do udostępnienia.",
        list: [
          "Wybierz styl kartki świątecznej",
          "Wgraj zdjęcie lub użyj świątecznego portretu",
          "Napisz swoją wiadomość (lub uzyskaj pomoc)",
          "Pobierz plik PNG lub udostępnij cyfrowo",
        ],
      },
    ],
    faqs: [
      {
        q: "Czy mogę wgrać własne zdjęcie?",
        a: "Tak. Wgraj zdjęcie jako centralny element swojej kartki świątecznej.",
      },
      {
        q: "Czy mogę użyć świątecznego portretu?",
        a: "Tak. Jeśli stworzyłeś portret w Generatorze Świątecznych Zdjęć, możesz przenieść go do kreatora kartek.",
      },
      {
        q: "Czy pomożecie mi napisać wiadomość?",
        a: "Tak. Skorzystaj z wbudowanej pomocy w tworzeniu wiadomości lub odwiedź Generator Wiadomości Świątecznych po więcej opcji.",
      },
      {
        q: "Czy mogę zrobić kartkę rodzinną?",
        a: "Tak. Style i układy zdjęć przyjazne rodzinom są częścią kreatora.",
      },
      {
        q: "Czy mogę zrobić kartkę ze zwierzęciem?",
        a: "Tak. Zdjęcia zwierząt dobrze sprawdzają się w kilku stylach kartek świątecznych.",
      },
      {
        q: "Czy mogę pobrać kartkę?",
        a: "Tak. Pobierz plik PNG w wysokiej rozdzielczości do użytku osobistego.",
      },
      {
        q: "Czy mogę ją udostępnić cyfrowo?",
        a: "Tak. Udostępnij za pomocą opcji udostępniania swojego urządzenia, WhatsApp, e-mail lub kopiując link, gdzie jest to dostępne.",
      },
      {
        q: "Jakie style kartek są dostępne?",
        a: "Style obejmują klasyczny, elegancki złoty, przytulny, zimowa kraina czarów, minimalistyczny, vintage, żartobliwy i romantyczny świąteczny wygląd.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Generator Wiadomości Świątecznych | Życzenia dla Rodziny i Przyjaciół",
    description: "Znajdź idealną wiadomość świąteczną dla rodziny, przyjaciół i współpracowników — a potem użyj jej w spersonalizowanej kartce świątecznej.",
    h1: "Znajdź Idealną Wiadomość Świąteczną",
    lede: "Generuj ciepłe, zabawne, romantyczne lub profesjonalne życzenia świąteczne, a potem umieść swoją ulubioną wiadomość na kartce świątecznej.",
    h2: "Zmień Słowa w Kartkę",
    breadcrumbs: [
      { href: "/pl/christmas", label: "Boże Narodzenie" },
      { href: "/pl/christmas/messages", label: "Wiadomości" },
    ],
    links: [
      { href: "/pl/christmas/cards", label: "Kreator Kartek Świątecznych" },
      { href: "/pl/christmas/wishlist", label: "Świąteczna Lista Życzeń" },
      { href: "/pl/christmas/tree", label: "Cyfrowa Choinka" },
      { href: "/pl/christmas", label: "Strona główna świąt" },
    ],
    geo: {
      h2: "Czym jest generator wiadomości świątecznych?",
      body:
        "Generator wiadomości świątecznych pomaga napisać życzenia świąteczne, wybierając, dla kogo jest wiadomość, i ton, który chcesz — a potem generuje edytowalne opcje wiadomości. W TheDigitalGifter możesz stworzyć ciepłe, zabawne, romantyczne, serdeczne, krótkie, profesjonalne lub religijne wiadomości świąteczne w języku angielskim lub rumuńskim, a potem je skopiować lub przenieść do kartki świątecznej.",
    },
    sections: [
      {
        h2: "Znajdź Idealną Wiadomość Świąteczną",
        body:
          "Wybierz odbiorcę, wybierz ton, ustaw długość (krótka, średnia lub długa), opcjonalnie dodaj jeden osobisty szczegół, i wygeneruj opcje wiadomości świątecznych, które możesz edytować i wykorzystać. Wiadomości są tworzone w języku angielskim lub rumuńskim.",
      },
      {
        h2: "Wiadomości Świąteczne Według Odbiorcy",
        body:
          "Generator obsługuje najczęstsze relacje świąteczne. Uruchom narzędzie i wybierz, do kogo piszesz — dedykowane strony dla poszczególnych odbiorców nie są jeszcze dostępne.",
        list: ["Mama", "Tata", "Żona", "Mąż", "Dziewczyna", "Chłopak", "Rodzina", "Przyjaciel", "Współpracownik"],
      },
      {
        h2: "Wiadomości Świąteczne Według Tonu",
        body: "Obecnie dostępne opcje tonu to ciepły, zabawny, romantyczny, serdeczny, krótki i słodki, profesjonalny oraz religijny.",
      },
      {
        h2: "Przykłady Wiadomości Świątecznych",
        body: "Kierunki demonstracyjne dla rodzajów życzeń, które narzędzie może pomóc napisać — edytuj cokolwiek, aby zabrzmiało jak Ty.",
        list: [
          "Serdeczna notka do mamy, dziękująca za kolejny rok cichej dobroci",
          "Krótkie, ciepłe życzenie dla przyjaciela, którego nie widujesz wystarczająco często",
          "Romantyczna świąteczna linia na pierwsze wspólne Święta pary",
          "Lekka, zabawna wiadomość do współpracownika, która pozostaje w porządku dla środowiska pracy",
        ],
      },
      {
        h2: "Jak Napisać Znaczącą Wiadomość Świąteczną",
        body:
          "Zwróć się do osoby po imieniu lub relacji, wspomnij o jednym wspólnym wspomnieniu lub cesze, gdy to odpowiednie, wyraź jedno jasne uczucie, zachowaj naturalne słownictwo i zakończ osobiście. Generator jest punktem wyjścia — Twoja edycja czyni to prawdziwym.",
      },
      {
        h2: "Użyj Swojej Wiadomości na Kartce Świątecznej",
        body: "Gdy znajdziesz słowa, które Ci się podobają, przejdź do Kreatora Kartek Świątecznych i połącz wiadomość ze zdjęciem i projektem.",
        linkHref: "/pl/christmas/cards",
        linkLabel: "Umieść tę świąteczną wiadomość na kartce",
      },
    ],
    faqs: [
      {
        q: "Jak działa generator wiadomości świątecznych?",
        a: "Wybierz odbiorcę, ton i długość, opcjonalnie dodaj szczegół, a potem wygeneruj opcje wiadomości, które możesz skopiować lub edytować.",
      },
      {
        q: "Czy mogę napisać wiadomość dla mojego partnera?",
        a: "Tak. Wybierz dziewczynę, chłopaka, partnera, żonę lub męża oraz romantyczny lub ciepły ton.",
      },
      {
        q: "Czy może tworzyć zabawne wiadomości świąteczne?",
        a: "Tak. Wybierz zabawny ton — zachowaj profesjonalizm w wiadomościach do współpracowników.",
      },
      {
        q: "Czy mogę edytować wygenerowane wiadomości?",
        a: "Tak. Traktuj wygenerowany tekst jako szkic i przepisz go swobodnie przed wysłaniem lub użyciem na kartce.",
      },
      {
        q: "Czy może tworzyć krótkie życzenia świąteczne?",
        a: "Tak. Wybierz krótką długość lub ton krótki i słodki.",
      },
      {
        q: "Czy mogę użyć wiadomości w kartce świątecznej?",
        a: "Tak. Przejdź do Kreatora Kartek Świątecznych z przeniesieniem wiadomości.",
      },
      {
        q: "Czy wiadomości są generowane po polsku?",
        a: "Jeszcze nie. Obecnie generator tworzy wiadomości w języku angielskim lub rumuńskim; możesz przetłumaczyć i dostosować tekst podczas edycji.",
      },
    ],
  },
};

/**
 * @param {string} basePath
 * @returns {object | null}
 */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
