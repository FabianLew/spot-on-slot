# B10: booking (moduł `booking`)

Status: szkic do akceptacji. Etap według `architektura/segmenty-mvp.md`: B10 (backend), ekrany przyjdą w W9. Termin rezerwuje dopiero akceptacja (wybór Fabiana na karcie, 2026-10-06).

## 1. Co użytkownicy dostają

1. **Zapytanie od lokalu do artysty.**
   - Członek zespołu opublikowanego lokalu (właściciel albo menedżer) wysyła zapytanie z profilu artysty albo z jego ogłoszenia „Jestem wolny”.
   - Zapytanie zawiera:
     - termin: od 30 minut do 24 godzin, także przez północ, najwyżej 365 dni naprzód;
     - honorarium w zł;
     - wiadomość: do 1000 znaków.
   - Z ogłoszenia termin i kwota podpowiadają się z ogłoszenia.
   - Termin musi być wolny w kalendarzu artysty. Dzień bez wolnego czasu jest niedostępny, tak jak w wyszukiwarce.
2. **Zgłoszenie artysty na ogłoszenie „Szukam artysty”.**
   - Artysta z opublikowanym profilem odpowiada na ogłoszenie lokalu.
   - Termin pochodzi z ogłoszenia, a artysta podaje swoją kwotę i wiadomość.
   - Termin nie musi być oznaczony jako wolny, bo zgłoszenie samo jest deklaracją artysty, ale nie może nachodzić na jego zarezerwowany czas.
   - Bez ogłoszenia artysta nie wysyła zapytań do lokali (lokale nie mają kalendarza).
3. **Negocjacja.** Strona, na której ruch czekamy, może:
   - zaakceptować;
   - odrzucić, z opcjonalnym powodem;
   - złożyć kontrofertę: inny termin, kwota albo wiadomość. Wtedy ruch przechodzi na drugą stronę.

   Liczba rund nie jest ograniczona. Strona, która wysłała ostatnią propozycję, może ją wycofać, dopóki druga nie odpowie.
4. **Akceptacja.**
   - Akceptuje się zawsze ostatnią propozycję. Jeśli w międzyczasie przyszła nowa, akceptacja dostaje 409 i trzeba ją powtórzyć na aktualnej.
   - Zaakceptowany booking zajmuje czas w kalendarzu artysty jako „Zarezerwowany”:
     - wolny termin, który obejmuje booking, staje się w całości zarezerwowany (bez dzielenia, jak w B7);
     - jeśli nic w kalendarzu nie nachodzi na ten czas (zgłoszenie na ogłoszenie lokalu), powstaje nowy zarezerwowany termin;
     - jeśli coś w kalendarzu nachodzi na ten czas tylko częściowo, akceptacja dostaje 409, a artysta musi najpierw poprawić kalendarz.
   - Inne oczekujące zapytania tego artysty na nachodzący czas zamykają się same jako odrzucone, z dopiskiem „termin zajęty”.
   - Ogłoszenie, z którego był booking, przechodzi w stan „Obsadzone”.
5. **Anulowanie zaakceptowanego bookingu.**
   - Każda strona może anulować przed jego początkiem. Powód jest wymagany (do 500 znaków).
   - Czas wraca do kalendarza jako wolny.
   - Po początku występu anulować się nie da.
6. **Same z siebie:**
   - oczekujące zapytanie bez odpowiedzi przez 72 godziny albo takie, którego termin się zaczął, wygasa;
   - zaakceptowany booking po końcu występu staje się zakończony.

   Tak jak w ogłoszeniach, odczyt pokazuje nowy status od razu, a zadanie co 15 minut go zapisuje.
7. **Historia.** Każdy krok zostaje w historii bookingu:
   - kto: artysta, lokal (z nazwą osoby z zespołu) albo system;
   - co: zapytanie, kontroferta, akceptacja, odrzucenie, wycofanie, anulowanie, wygaśnięcie, zakończenie;
   - warunki w tym kroku i wiadomość.

   Kwota, statusy i historia są od początku, pod przyszłe płatności i opinie (decyzja o monetyzacji).
8. **Widoczność.**
   - Booking widzą tylko strony: artysta i cały zespół lokalu. Dla innych to 404.
   - Lokal nie widzi prawdziwego imienia i nazwiska artysty, tylko pseudonim.
   - Kontakt (e-mail, telefon) nie jest pokazywany. Rozmowy przyjdą w B11.

Statusy: `PENDING` (z informacją, na kogo czekamy), `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `CANCELLED`, `EXPIRED`, `COMPLETED`.

Poza zakresem:
- ekrany (W9);
- wiadomości i czat przy bookingu (B11);
- płatności, umowy, faktury i prowizja (po MVP);
- opinie (po MVP).

## 2. API

- `POST /api/v1/bookings`:
  - lokal podaje `venueId`, `artistSlug` (albo `listingId` ogłoszenia artysty), termin, kwotę i wiadomość;
  - artysta podaje `listingId` ogłoszenia lokalu, kwotę i wiadomość.
- `GET /api/v1/bookings`: moje bookingi.
  - Artysta widzi swoje, konto lokalu widzi bookingi wszystkich swoich lokali.
  - Filtry: `status`, `venueId`, `from`/`to`, oraz „czeka na mnie”.
  - Paginacja, sortowanie po terminie.
- `GET /api/v1/bookings/{id}`: szczegóły z historią.
- Kroki:
  - `POST /api/v1/bookings/{id}/accept` z numerem propozycji, którą akceptuję;
  - `.../decline` (z opcjonalnym powodem);
  - `.../counter` (termin, kwota, wiadomość);
  - `.../withdraw`;
  - `.../cancel` (powód).
- Fasada `Bookings`:
  - czy lokal ma zaakceptowany booking nachodzący na dany czas: to warunek alertów lokalu, który B12 odkłada do B10;
  - dane bookingu dla wiadomości w B11.
- Zdarzenia `BookingRequested`, `BookingCountered`, `BookingAccepted`, `BookingDeclined`, `BookingWithdrawn`, `BookingCancelled`, `BookingExpired`, z identyfikatorami stron i terminem.
  - Jeśli B12 (PR #18) będzie już scalony, w tym etapie podepnę je pod powiadomienia (w aplikacji i e-mail, bez dziennego limitu, kategoria „Booking”). W przeciwnym razie zrobię to zaraz po jego scaleniu.

## 3. Reguły

- Kwota od 0 do 100 000 zł, w groszach. 0 oznacza występ bez honorarium.
- Ten sam lokal nie może mieć dwóch oczekujących zapytań do tego samego artysty na nachodzący czas: 409 `BOOKING_DUPLICATE`.
- Limity przeciw zalewaniu:
  - 30 oczekujących zapytań na lokal;
  - 20 oczekujących zgłoszeń na artystę.
- Wszystkie kroki jednego artysty idą po kolei pod jego blokadą, tą samą co kalendarz. Dwie akceptacje na ten sam wieczór nie przejdą obie.
- Kody błędów:
  - `BOOKING_NOT_FREE`: termin niewolny przy zapytaniu lokalu;
  - `BOOKING_CALENDAR_CONFLICT`: kolizja z kalendarzem przy akceptacji;
  - `BOOKING_STALE`: akceptacja nieaktualnej propozycji;
  - `BOOKING_NOT_YOUR_TURN`;
  - `BOOKING_CLOSED`: krok na zamkniętym bookingu;
  - `BOOKING_LIMIT`.
- Czasy w UTC (`timestamptz`), pokazywane w czasie polskim.
- Fasada `Availability` dostaje jedną metodę: zarezerwuj ten czas (obejmującym wolnym terminem albo nowym zarezerwowanym, jeśli nic nie nachodzi).

## 4. Testy

- Testy integracyjne (Testcontainers):
  - pełna ścieżka lokal → artysta z kontrofertą i akceptacją;
  - zgłoszenie artysty na ogłoszenie lokalu;
  - konflikty kalendarza;
  - automatyczne zamknięcie konkurencyjnych zapytań;
  - wygasanie i zakończenie;
  - anulowanie zwalniające czas;
  - widoczność dla osób spoza stron;
  - równoczesne akceptacje;
  - `ModularityTest`.
