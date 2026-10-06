# B8: ogłoszenia (moduł `listing`)

Status: zaakceptowany przez Fabiana 2026-10-06 (termin artysty z kalendarza). Etap według `architektura/segmenty-mvp.md`: B8 (backend), ekrany przyjdą w W7.

## 1. Co użytkownicy dostają

1. **„Jestem wolny” od artysty.**
   - Artysta wybiera jeden ze swoich wolnych terminów z kalendarza: pojedynczy termin albo konkretny dzień reguły tygodniowej (karta decyzji w wątku). Data i godziny ogłoszenia pochodzą z kalendarza, nie wpisuje się ich drugi raz.
   - Do tego dochodzą:
     - gatunki: 1–5, domyślnie z profilu;
     - krótki opis: do 500 znaków;
     - stawka: opcjonalna, domyślnie widełki z profilu;
     - region: miasto i zasięg dojazdu z profilu; zasięg można zmienić dla tego ogłoszenia.
   - Wymaga opublikowanego profilu artysty.
2. **„Szukam artysty” od lokalu.**
   - Lokal nie ma kalendarza, więc członek zespołu (właściciel albo menedżer) wybiera jeden ze swoich opublikowanych lokali i wpisuje:
     - datę i godziny: od 30 minut do 24 godzin, także przez północ;
     - gatunki: 1–5;
     - budżet od–do w zł: opcjonalny, „do ustalenia”;
     - opis: do 1000 znaków.
   - Miejsce to adres i punkt lokalu.
3. **Statusy:**
   - **Aktywne** od razu po dodaniu (bez szkiców).
   - **Zamknięte**, gdy autor je zamknie.
   - **Wygasłe**, gdy termin się zaczął albo (u artysty) zniknął z kalendarza: został zarezerwowany, usunięty albo dzień reguły pominięty.
   - **Obsadzone** to stan przygotowany pod booking (B10): zaakceptowana rezerwacja z ogłoszenia zamknie je jako obsadzone.

   Zamknięte i wygasłe ogłoszenie zostaje na liście autora do wglądu, ale nie da się go wznowić. Zamiast tego dodaje się nowe.
4. **Edycja aktywnego ogłoszenia:**
   - opis, gatunki i stawka albo budżet;
   - u lokalu także data i godziny;
   - u artysty zmiana terminu to wybór innego wolnego terminu z kalendarza.
5. **Widoczność:**
   - aktywne ogłoszenie jest publiczne pod `GET /api/v1/public/listings/{id}`, bez notatek z kalendarza i bez danych prywatnych;
   - lista i wyszukiwanie po mapie przyjdą w B9;
   - autor widzi swoje ogłoszenia we wszystkich statusach.

Poza zakresem:
- ekrany (W7);
- wyszukiwanie i mapa (B9);
- odpowiedź na ogłoszenie, czyli zapytanie o booking (B10);
- powiadomienia o nowych ogłoszeniach (B12; B8 tylko publikuje zdarzenie).

## 2. API

- **Artysta:**
  - `GET /api/v1/listings/mine` (moje, filtr statusu, paginacja);
  - `POST /api/v1/listings/mine` (dodanie „Jestem wolny”, podaje termin z kalendarza: początek i koniec).
- **Lokal:**
  - `GET /api/v1/venues/{venueId}/listings`;
  - `POST /api/v1/venues/{venueId}/listings` (dodanie „Szukam artysty”).
- **Wspólne dla autora:** `PUT /api/v1/listings/{id}` (edycja) i `POST /api/v1/listings/{id}/close` (zamknięcie); u lokalu każdy członek zespołu.
- **Publiczne:** `GET /api/v1/public/listings/{id}` (tylko aktywne, inaczej 404).
- **Fasada `Listings`** pod B9 i B10: aktywne ogłoszenia z punktem i terminem, „obsadź ogłoszenie”.
- **Zdarzenie `ListingPublished`** (rodzaj, autor, termin, gatunki, punkt) pod powiadomienia w B12.

## 3. Reguły

- Termin ogłoszenia artysty musi w chwili dodania być wolnym czasem w kalendarzu (fasada `Availability`), inaczej 409 `LISTING_NOT_FREE`. Kalendarz publikuje zdarzenie o zmianie, a moduł `listing` sprawdza wtedy aktywne ogłoszenia tego artysty i zamyka te, których termin nie jest już wolny.
- Ogłoszenia, których termin się zaczął, wygasają przez zadanie uruchamiane co 15 minut. Przy odczycie traktujemy je jako wygasłe także przed tym zadaniem.
- Artysta nie może mieć dwóch aktywnych ogłoszeń na ten sam termin. Lokal może mieć kilka na ten sam wieczór, np. dwie sceny.
- Limity:
  - 20 aktywnych ogłoszeń na artystę;
  - 30 aktywnych ogłoszeń na lokal;
  - termin najwyżej rok w przód.
- Punkt na mapie:
  - u artysty to zaokrąglony punkt z modułu `location` (jak w profilu, ~1 km);
  - u lokalu to dokładny punkt lokalu.

  Oba są zapisane w ogłoszeniu pod B9, więc późniejsza zmiana lokalizacji nie przesuwa starych ogłoszeń.
- Błędy mają kody `LISTING_*` z tekstami PL/EN.

## 4. Testy

- Testy integracyjne (Testcontainers):
  - dodanie z wolnego terminu i z terminu zajętego;
  - wygaśnięcie po rezerwacji, usunięciu i pominięciu dnia;
  - ogłoszenie lokalu przez północ;
  - uprawnienia: menedżer tak, osoba spoza zespołu nie, rola ARTIST dla lokalu nie;
  - limity, zamykanie, edycja;
  - widok publiczny bez danych prywatnych;
  - zdarzenie `ListingPublished`;
  - zadanie wygaszające.
- `ModularityTest`, potem `pnpm api:generate` i commit `schema.d.ts`.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. Termin „Jestem wolny” pochodzi z kalendarza artysty (karta decyzji w wątku).
2. Ogłoszenie jest aktywne od razu, bez szkiców i bez moderacji przed publikacją (moderacja w B13).
3. Zamkniętego ani wygasłego ogłoszenia nie da się wznowić; dodaje się nowe.
4. Ogłoszenie „Szukam artysty” dodaje właściciel albo menedżer, dla opublikowanego lokalu.
5. Limity: 20 aktywnych na artystę, 30 na lokal, termin do roku w przód.
6. Budżet i stawka są w zł (zapis w groszach), opcjonalne.
