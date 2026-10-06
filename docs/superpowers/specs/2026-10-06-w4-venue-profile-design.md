# W4: profil lokalu w aplikacji

Status: zaakceptowany przez Fabiana 2026-10-06. Etap według `architektura/segmenty-mvp.md`: W4 (`apps/web`), na backendzie B5 (bez zmian w API).

## 1. Co użytkownik dostaje

1. **Zakładka „Profil”** (`/profile`) dla konta VENUE zastępuje dzisiejszy komunikat „profil lokalu przyjdzie później”. Pokazuje lokal tak, jak zobaczą go inni, w układzie z makiety „Panel lokalu”:
   - zdjęcie, nazwa, typ, adres, pojemność i gatunki;
   - opis, tagi, linki (www, Instagram, Facebook);
   - galeria.

   Na górze jest pasek stanu jak u artysty: „Szkic” z listą braków albo „Opublikowany” z linkiem, przyciski „Edytuj”, „Zespół”, „Opublikuj” albo „Wycofaj publikację” oraz „Kopiuj link”. Publikacja i wycofanie są tylko dla właściciela; menedżer widzi je wyłączone z dopiskiem „Tylko właściciel”.
2. **Kilka lokali** (do 10 na konto): gdy konto ma więcej niż jeden lokal, nad podglądem jest przełącznik lokali; wybór zapamiętuje adres (`/profile?venue={id}`). Przycisk „Dodaj lokal” otwiera kreator lokalu z W2 dla nowego lokalu. Przy limicie przycisk jest wyłączony z wyjaśnieniem.
3. **Edycja** (`/profile/venues/{id}/edit`) to jeden formularz w sekcjach, na wzór edycji artysty:
   1. **Podstawy:** nazwa, typ, adres profilu (`/v/{slug}` ze sprawdzaniem, czy jest wolny), pojemność.
   2. **Adres:** ulica, kod, miasto z podpowiedziami (jak w kreatorze); adres, którego nie ma na mapie, zapisuje się z ostrzeżeniem, że lokalu nie da się wtedy opublikować.
   3. **Muzyka:** gatunki (1–5) i własne tagi (do 10).
   4. **Opis:** do 2000 znaków z licznikiem.
   5. **Zdjęcia:** zdjęcie główne i galeria do 12 zdjęć (dodawanie, usuwanie, kolejność strzałkami).
   6. **Linki:** www, Instagram, Facebook.
   7. **Strefa usuwania** (tylko właściciel): „Usuń lokal” z potwierdzeniem przez wpisanie nazwy lokalu.

   „Zapisz” wysyła cały lokal naraz, błędy z backendu trafiają do pól, wyjście z niezapisanymi zmianami pyta o potwierdzenie.
4. **Zespół** (`/profile/venues/{id}/team`):
   - lista członków (e-mail, rola, od kiedy) i oczekujących zaproszeń (e-mail, rola, ważne do);
   - właściciel zaprasza e-mailem z rolą Właściciel albo Menedżer, cofa zaproszenia i usuwa członków (z potwierdzeniem); ostatniego właściciela nie da się usunąć;
   - menedżer widzi listę bez przycisków i może tylko opuścić zespół.
5. **Przyjęcie zaproszenia** (`/venue-invitation?token=`, link z e-maila):
   - bez logowania prowadzi do logowania albo rejestracji i wraca na tę stronę;
   - po zalogowaniu pokazuje „Dołącz do zespołu lokalu” i po kliknięciu przenosi do profilu tego lokalu;
   - zaproszenie wygasłe, cofnięte albo na inny e-mail daje jasny komunikat (przy innym e-mailu z opcją wylogowania).
6. **Strona publiczna** `/v/{slug}`: jak `/a/{slug}` u artysty, renderowana na serwerze, bez logowania, bez zespołu, z dokładnym adresem; szkic albo nieistniejący adres daje 404; `noindex` do startu MVP, tytuł, opis i obrazek Open Graph.

Poza zakresem:
- wolne terminy, zapytania i statystyki z makiety panelu lokalu (ogłoszenia W9, booking W10);
- mapa z pinezką (W8);
- przekazanie lokalu innemu kontu poza zaproszeniem z rolą Właściciel.

## 2. Jak to działa w aplikacji

- **Dane:** `GET /api/v1/venues/mine`, `GET`/`PUT`/`DELETE /api/v1/venues/{id}`, `POST .../publish|unpublish`, `GET /api/v1/venues/slugs/{slug}`, zespół (`GET .../team`, `POST .../team/invitations`, `DELETE .../team/invitations/{invitationId}`, `DELETE .../team/{userId}`), `POST /api/v1/venues/invitations/accept`, `GET /api/v1/public/venues/{slug}`. Zapis reużywa `venueRequest` z W2.
- **Rola w lokalu** przychodzi w odpowiedzi (`role`), więc przyciski tylko dla właściciela ukrywa sam front; backend i tak odpowiada 403 `VENUE_FORBIDDEN`, które pokazujemy jako komunikat.
- **Komponenty:** `VenueProfileView` dla podglądu i strony publicznej; formularz lokalu korzysta z sekcji i pola galerii z W3 (`GalleryField`, `TagInput`). Pola adresu z kreatora wydzielam do wspólnego komponentu, żeby kreator i edycja działały tak samo.
- **Strona zaproszenia** leży w grupie `(onboarding)` (logowanie wymagane, bez kreatora wymuszanego przez `OnboardingGate`), bo zaproszona osoba może jeszcze nie mieć żadnego lokalu.
- **Kreator:** konto, które dołączyło do zespołu przez zaproszenie, ma już lokal, więc `OnboardingGate` go nie zatrzymuje.
- **Teksty:** PL/EN w `messages` (`venueProfile.*`).

## 3. Testy

- Vitest + Testing Library:
  - podgląd szkicu i opublikowanego lokalu, przełącznik lokali;
  - publikacja (właściciel) i przyciski wyłączone dla menedżera;
  - edycja: zapis całego lokalu, błędy pól z backendu, zajęty adres, adres bez punktu, usuwanie;
  - zespół: zaproszenie, cofnięcie, usunięcie, ostatni właściciel, widok menedżera;
  - przyjęcie zaproszenia: sukces, wygasłe, inny e-mail;
  - strona publiczna (dane, 404, brak zespołu).
- Sprawdzenie end-to-end z prawdziwym backendem:
  - edycja i publikacja lokalu, `/v/{slug}` bez logowania;
  - zaproszenie drugiego konta przez Mailpit, przyjęcie, widok menedżera, usunięcie z zespołu;
  - drugi lokal i przełącznik;
  - zrzuty desktop i mobile, jasny i ciemny motyw, do `w4-screens/`.

## 4. Decyzje domyślne (do zmiany jednym słowem)

1. Lokal ma tę samą zakładkę „Profil” co artysta (bez nowej pozycji w nawigacji), z przełącznikiem przy kilku lokalach.
2. Nowy lokal powstaje w kreatorze z W2, edycja to jedna strona z sekcjami i jednym „Zapisz”.
3. Zespół ma osobną podstronę zamiast sekcji w edycji, bo zmiany w nim zapisują się od razu.
4. Strona publiczna lokalu to `/v/{slug}`, w stylu arcade, jak u artysty.
5. Usunięcie lokalu wymaga wpisania jego nazwy (nie da się go cofnąć).
6. Bez terminów, zapytań i statystyk z makiety, które przyjdą z ogłoszeniami i bookingiem.
