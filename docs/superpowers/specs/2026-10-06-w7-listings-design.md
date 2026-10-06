# W7: ogłoszenia w aplikacji

Status: zaakceptowany przez Fabiana 2026-10-06. Etap według `architektura/segmenty-mvp.md`: W7 (`apps/web`), na backendzie B8 (bez zmian w API).

## 1. Co dostaje artysta

1. **Zakładka „Ogłoszenia”** (`/listings`) zastępuje dzisiejszą zaślepkę.
   - Lista „Moje ogłoszenia” z filtrem **Aktywne / Zakończone**. Zakończone to zamknięte, wygasłe i obsadzone, każde z etykietą statusu.
   - Karta ogłoszenia pokazuje:
     - datę i godziny (z dopiskiem „+1”, gdy termin kończy się następnego dnia);
     - gatunki;
     - stawkę albo „do ustalenia”;
     - miasto i zasięg;
     - początek opisu.
   - Na karcie są przyciski „Edytuj”, „Zamknij” (z potwierdzeniem) i „Kopiuj link”.
2. **„Dodaj ogłoszenie”** otwiera okno w dwóch krokach:
   1. Wybór terminu z listy najbliższych wolnych terminów z kalendarza (90 dni). Terminy, które już mają aktywne ogłoszenie, są oznaczone i nie da się ich wybrać.
   2. Formularz:
      - gatunki (1–5), wstępnie z profilu;
      - opis do 500 znaków z licznikiem;
      - stawka od–do w zł, wstępnie z profilu;
      - zasięg dojazdu w km, wstępnie z profilu.

   Bez wolnych terminów okno pokazuje „Najpierw dodaj wolny termin w kalendarzu” z linkiem do kalendarza.
3. **Z kalendarza:** w panelu dnia przy wolnym terminie jest przycisk „Ogłoś”. Otwiera to samo okno od razu na kroku 2. Termin, który ma aktywne ogłoszenie, dostaje znacznik „Ogłoszony”.
4. **Edycja:** to samo okno z wypełnionymi polami. Zmiana terminu to wybór innego wolnego terminu.
5. **Bez opublikowanego profilu** zakładka pokazuje, czego brakuje, i link do profilu, zamiast przycisku „Dodaj”.

## 2. Co dostaje lokal

1. **`/listings` dla konta VENUE:**
   - przełącznik lokali jak w „Profilu”, gdy członek zespołu ma ich kilka (`?venue=id`);
   - lista ogłoszeń lokalu z tym samym filtrem i kartami;
   - właściciel i menedżer mogą wszystko.
2. **„Dodaj ogłoszenie” „Szukam artysty”:**
   - data, od, do: koniec przed początkiem oznacza następny dzień, jak w kalendarzu;
   - gatunki (1–5), wstępnie z profilu lokalu;
   - budżet od–do w zł (opcjonalny, „do ustalenia”);
   - opis do 1000 znaków.

   Nieopublikowany lokal widzi informację i link do profilu.
3. **Panel lokalu z makiety:** przycisk „Dodaj wolny slot” z szybkich akcji prowadzi do tego okna.

## 3. Strona publiczna ogłoszenia

- **`/o/{id}`:** renderowana na serwerze, bez logowania, `noindex` do startu MVP, przez `PublicShell` jak `/a/{slug}` i `/v/{slug}`.
- **Treść:** rodzaj („Jestem wolny” / „Szukam artysty”), termin, gatunki, stawka albo budżet, miasto, zasięg i opis.
- **Autor:** karta z linkiem do profilu artysty (`/a/{slug}`) albo lokalu (`/v/{slug}`).
- **Nieaktywne ogłoszenie** daje 404.
- **Później:** przycisk odpowiedzi („Zapytaj o booking”) przyjdzie z W9.

## 4. Jak to działa w aplikacji

- **Dane:**
  - `GET/POST /api/v1/listings/mine`;
  - `GET/POST /api/v1/venues/{id}/listings`;
  - `PUT /api/v1/listings/{id}` i `POST .../close`;
  - `GET /api/v1/public/listings/{id}` (przez `findPublicListing` w `src/lib/public-profiles.ts`).
- **Źródła danych w formularzach:**
  - wolne terminy pochodzą z `GET /api/v1/availability/me`;
  - wartości wstępne pochodzą z własnego profilu (`/artists/me`, lokal z `/venues/mine`).
- **Odświeżanie:** zapisy odświeżają `["listings"]`. Zmiany w kalendarzu też, bo mogą wygasić ogłoszenie.
- **Czas:** godziny liczy `warsaw-time.ts` (Europe/Warsaw); kwoty w zł zamieniane są na grosze.
- **Kod:** komponenty w `components/listings`, teksty PL/EN w `messages` (`listings.*`).

## 5. Testy

- **Vitest + Testing Library:**
  - listy artysty i lokalu z filtrem statusów;
  - dodanie z listy wolnych terminów i z kalendarza;
  - termin już ogłoszony;
  - edycja i zamknięcie;
  - ogłoszenie lokalu przez północ;
  - błędy z backendu (np. termin już nie jest wolny);
  - brak opublikowanego profilu;
  - strona publiczna i 404.
- **End-to-end z prawdziwym backendem:**
  - ogłoszenie artysty z kalendarza, wygaśnięcie po usunięciu terminu;
  - ogłoszenie lokalu;
  - `/o/{id}` bez logowania.

  Zrzuty desktop i mobile, jasny i ciemny motyw, do `w7-screens/`.

## 6. Decyzje domyślne (do zmiany jednym słowem)

1. Ogłoszenie artysty dodaje się z zakładki „Ogłoszenia” (lista wolnych terminów) i z panelu dnia w kalendarzu („Ogłoś”).
2. Lista dzieli się na Aktywne i Zakończone; zakończonego nie da się wznowić, jest „Dodaj podobne” z tymi samymi gatunkami i opisem.
3. Publiczny link ogłoszenia to `/o/{id}` w aplikacji web, bez logowania, `noindex`.
4. Gatunki, stawka i zasięg są wstępnie wypełnione z profilu; można je zmienić dla ogłoszenia.
5. Przeglądanie cudzych ogłoszeń (lista, mapa, filtry) przyjdzie w W8 z wyszukiwarką.
