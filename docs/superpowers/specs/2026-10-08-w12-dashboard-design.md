# W12: Pulpit (dashboard)

Status: szkic do akceptacji. Etap według `architektura/segmenty-mvp.md`: W12. Działa na istniejących danych z W6, W7, W9 i W10, więc bez zmian w backendzie.

Wygląd idzie za makietą „Panel lokalu” z D1 (`d1-screens/design-venue-panel-*`): kafelki z liczbami, listy terminów, kafelki szybkich akcji, styl arcade. Makieta używa przykładowych danych. Pulpit pokazuje prawdziwe dane konta.

## 1. Wspólne zasady

- **Adres:** `/dashboard`, pierwsza pozycja menu („Pulpit”). Tu trafia się po zalogowaniu, jak dziś.
- **Przypomnienie o profilu:** karta „Dokończ profil” (`ProfileReminder`) zostaje na górze, dopóki profil albo lokal nie jest opublikowany.
- **Krótkie sekcje:** każda pokazuje najwyżej 3 pozycje i ma link „Wszystkie” do pełnej zakładki.
- **Pusta sekcja:** nie znika, tylko mówi jednym zdaniem, co zrobić, i daje przycisk, np. „Brak nadchodzących występów. Szukaj ogłoszeń”.
- **Kliknięcie pozycji:**
  - booking otwiera `/bookings/{id}`;
  - rozmowa otwiera `/messages/{id}`;
  - wolny termin otwiera `/calendar?day=`;
  - ogłoszenie otwiera `/listings`.
- **Błąd ładowania sekcji** pokazuje błąd tylko w tej sekcji (`ApiErrorState` z „Spróbuj ponownie”). Reszta pulpitu działa dalej.
- **Odświeżanie:** liczniki odświeżają się co minutę, jak w menu. Nowa wiadomość na żywo od razu zmienia licznik i listę rozmów.
- **Czas:** wszystkie daty i godziny są w czasie polskim.

## 2. Pulpit artysty

- **Nagłówek:** nazwa sceniczna, miasto, gatunki i stan profilu (szkic albo opublikowany).
- **„Dziś” (3 kafelki):**
  - **Czeka na mnie:** liczba bookingów, na które mam odpowiedzieć;
  - **Nieprzeczytane:** liczba rozmów z nieprzeczytanymi wiadomościami;
  - **Najbliższy występ:** data, albo „—”, gdy nic nie ma.
- **„Dziś wieczorem”:** pasek pojawia się tylko w dniu, w którym mam zaakceptowany występ. Pokazuje lokal, godziny i link do bookingu. Zastępuje panel „Na żywo” z makiety.
- **„Czeka na odpowiedź”:** bookingi, na które mam odpowiedzieć. Przy każdym widać lokal, termin, kwotę i „Odpowiedz do …” (`respondBy`).
- **„Nadchodzące występy”:** zaakceptowane bookingi od najbliższego. Przy każdym widać lokal, datę, godziny i kwotę.
- **„Wiadomości”:** rozmowy z nieprzeczytanymi wiadomościami, z nazwą, początkiem ostatniej wiadomości i licznikiem. Bez nieprzeczytanych sekcja pisze „Wszystko przeczytane”.
- **„Wolne terminy”:** moje najbliższe wolne terminy z kalendarza na 60 dni, przy ogłoszonych znacznik „Ogłoszony”. Bez wolnych terminów sekcja prowadzi do kalendarza.
- **„Szybkie akcje”:**
  - Dodaj wolny termin → `/calendar`;
  - Ogłoś się → `/listings?add=1`;
  - Szukaj ogłoszeń → `/search`, zakładka „Szukam artysty”;
  - Profil → `/profile`.

## 3. Pulpit lokalu

- **Przełącznik lokalu:** konto z kilkoma lokalami wybiera lokal przełącznikiem (`?venue=`). Domyślny jest najstarszy, jak w Profilu. Wszystkie sekcje dotyczą wybranego lokalu.
- **Nagłówek:** nazwa lokalu, miasto, typ, gatunki i stan (szkic albo opublikowany).
- **„Dziś” (3 kafelki):**
  - **Czeka na mnie:** liczba bookingów, na które lokal ma odpowiedzieć;
  - **Nieprzeczytane:** liczba rozmów lokalu z nieprzeczytanymi wiadomościami;
  - **Artyści w pobliżu:** liczba opublikowanych artystów w promieniu 50 km od adresu lokalu, z linkiem do wyszukiwarki. Lokal bez adresu ma tu „—”.
- **„Dziś wieczorem”:** jak u artysty, dla zaakceptowanych występów w tym lokalu dzisiaj. Gdy jest ich kilka, widać wszystkie.
- **„Czeka na odpowiedź”, „Nadchodzące występy”, „Wiadomości”:** jak u artysty, tylko z nazwą artysty zamiast lokalu.
- **„Moje ogłoszenia”:** aktywne „Szukam artysty” tego lokalu, z datą, godzinami i gatunkami. Bez aktywnych ogłoszeń sekcja ma przycisk „Dodaj ogłoszenie”.
- **„Szybkie akcje”:**
  - Dodaj ogłoszenie → `/listings?venue=…&add=1`;
  - Szukaj artystów → `/search`;
  - Wiadomości → `/messages?venue=…`;
  - Profil → `/profile?venue=…`.

## 4. Inne przypadki

- **Konto bez profilu albo lokalu** (pominęło kreator) widzi przypomnienie, szybkie akcje i puste sekcje. Wolne terminy i ogłoszenia prowadzą wtedy do kreatora.
- **Inne role** (na razie żadnej nie można zarejestrować) widzą powitanie bez sekcji.

## 5. Układ

- **Komputer:** nagłówek, rząd 3 kafelków, potem sekcje w dwóch kolumnach. Po lewej „Czeka na odpowiedź” i „Nadchodzące występy”, po prawej „Wiadomości”, „Wolne terminy” albo „Moje ogłoszenia” i „Szybkie akcje”.
- **Telefon:** jedna kolumna w tej samej kolejności. Kafelki zostają w jednym rzędzie po 3, jak w makiecie.

## 6. Poza zakresem

- Statystyki i wykresy: wyświetlenia profilu należą do płatnych planów później.
- Rekomendacje „dla ciebie”.
- Własny układ pulpitu.
- Powiadomienia push (W13).

## 7. Testy

- **Vitest:**
  - pulpit artysty i lokalu na przykładowych danych;
  - puste sekcje z przyciskami;
  - „Dziś wieczorem” tylko w dniu występu;
  - przełącznik lokalu zmienia zapytania;
  - błąd jednej sekcji nie psuje innych;
  - przypomnienie o profilu.
- **E2E ze zrzutami** (`w12-screens/`):
  - artysta i lokal, z danymi i bez;
  - komputer i telefon, jasny i ciemny motyw.
