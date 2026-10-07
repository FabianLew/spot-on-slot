# W9: booking w aplikacji

Status: zaakceptowany przez Fabiana 2026-10-06. Etap według `architektura/segmenty-mvp.md`: W9 (`apps/web`), na backendzie B10. Jedna drobna zmiana w API, opisana w punkcie 5.

## 1. Skąd się wysyła zapytanie

1. **Lokal → artysta.**
   - Przycisk „Zapytaj o termin” jest:
     - na profilu artysty `/a/{slug}`;
     - na karcie artysty w wyszukiwarce.
   - Przycisk „Zapytaj o booking” jest na ogłoszeniu „Jestem wolny” (`/o/{id}` i karta w wyszukiwarce).
   - Okno zapytania (`/bookings/new?artist=slug` albo `?listing=id`):
     - **lokal:** przełącznik, gdy członek zespołu ma kilka opublikowanych lokali;
     - **termin:**
       - z profilu: wybór z najbliższych wolnych terminów artysty (90 dni, z publicznego kalendarza); godziny można zawęzić w obrębie terminu;
       - z ogłoszenia: termin ogłoszenia, który też można zawęzić;
     - **honorarium w zł:** podpowiedź to stawka „od” z profilu albo kwota z ogłoszenia; 0 zł znaczy występ bez honorarium;
     - **wiadomość:** do 1000 znaków.
   - Gdy artysta nie ma wolnych terminów, okno pokazuje „Artysta nie ma teraz wolnych terminów”.
2. **Artysta → lokal.**
   - Przycisk „Zgłoś się” jest na ogłoszeniu „Szukam artysty” (`/o/{id}` i karta w wyszukiwarce).
   - Termin jest z ogłoszenia, bez zmiany.
   - Kwota jest wstępnie z budżetu ogłoszenia („do”), a gdy budżetu nie ma, ze stawki „od” z profilu.
   - Do tego wiadomość.
3. **Kto widzi przyciski.**
   - Przycisk widzi tylko konto, które może z niego skorzystać: lokal na artyście i jego ogłoszeniu, artysta na ogłoszeniu lokalu.
   - Na stronach publicznych bez logowania przycisk prowadzi przez logowanie (`/login?next=`) z powrotem do okna.
   - Bez opublikowanego profilu (artysta) albo lokalu okno mówi, czego brakuje, z linkiem do profilu.

## 2. Zakładka „Bookingi” (`/bookings`)

1. **Filtry:**
   - **Czeka na mnie** (domyślny, gdy coś czeka);
   - **Oczekujące:** wszystkie w negocjacji;
   - **Nadchodzące:** zaakceptowane;
   - **Historia:** zakończone, odrzucone, wycofane, anulowane, wygasłe.

   Konto lokalu ma przełącznik „Wszystkie lokale” albo jeden lokal (`?venue=`).
2. **Karta bookingu pokazuje:**
   - drugą stronę: pseudonim artysty albo nazwę lokalu ze zdjęciem i linkiem do profilu;
   - termin (z „+1”, gdy kończy się następnego dnia);
   - kwotę;
   - status z etykietą, a przy oczekujących „Czeka na Ciebie” albo „Czeka na odpowiedź” i czas do wygaśnięcia.
3. **Licznik.** W menu przy „Bookingi” jest liczba bookingów, które czekają na mnie. Odświeża się po każdej akcji i co minutę.
4. **Pusta lista** podpowiada, gdzie zacząć: lokal → wyszukiwarka artystów, artysta → ogłoszenia lokali w wyszukiwarce.

## 3. Szczegóły bookingu (`/bookings/{id}`)

1. **Góra:** aktualne warunki (termin, kwota, wiadomość), status i druga strona.
2. **Akcje zależne od stanu:**
   - **moja kolej:** „Akceptuj”, „Kontroferta”, „Odrzuć” (opcjonalny powód);
   - **moja ostatnia propozycja:** „Wycofaj” (z potwierdzeniem);
   - **zaakceptowany, przed początkiem:** „Anuluj booking” z wymaganym powodem i ostrzeżeniem, że druga strona dostanie powiadomienie;
   - pozostałe stany są tylko do odczytu.
3. **Kontroferta:** okno z datą, godzinami (koniec przed początkiem oznacza następny dzień), kwotą i wiadomością, wypełnione aktualnymi warunkami.
4. **Akceptacja nieaktualnej propozycji** (druga strona właśnie wysłała nową) pokazuje komunikat „Pojawiła się nowa propozycja” i odświeża warunki. Nic nie zostaje zaakceptowane po cichu.
5. **Konflikt kalendarza przy akceptacji** artysty pokazuje komunikat z linkiem do kalendarza na ten dzień.
6. **Historia:** oś kroków od najnowszego. Każdy krok ma stronę (artysta, lokal albo system), co zrobiła, warunki, jeśli się zmieniły, wiadomość i czas.
7. **Brak dostępu:** booking, którego nie widzę, daje stronę 404.

## 4. Kalendarz i ogłoszenia

- **Kalendarz artysty:** zarezerwowany termin z bookingu dostaje link „Zobacz booking”.
- **Ogłoszenie:** obsadzone ogłoszenie na liście „Zakończone” linkuje do bookingu, który je obsadził.

## 5. Jak to działa

- **Dane:** `GET/POST /api/v1/bookings`, `GET /api/v1/bookings/{id}` i kroki `accept`/`decline`/`counter`/`withdraw`/`cancel`.
- **Źródła danych w formularzach:**
  - wolne terminy z `GET /api/v1/public/artists/{slug}/availability`;
  - podpowiedzi z publicznego profilu i ogłoszenia.
- **Zmiana w backendzie:**
  - własny kalendarz (`/api/v1/availability/me`) dostaje `bookingId` przy zarezerwowanym terminie; publiczny kalendarz nadal pokazuje tylko czas i status;
  - ogłoszenie autora (`/listings/mine`, `/venues/{id}/listings`) dostaje `bookingId`, gdy jest obsadzone.
- **Odświeżanie:** akcje odświeżają `["bookings"]`. Akceptacja i anulowanie odświeżają też `["availability"]` i `["listings"]`.
- **Czas:** godziny przez `warsaw-time.ts`; kwoty w zł zamieniane na grosze.
- **Kod:** komponenty w `components/bookings`, teksty PL/EN `bookings.*`.

## 6. Testy

- **Vitest + Testing Library:**
  - zapytanie lokalu z profilu (wybór wolnego terminu, zawężenie godzin) i z ogłoszenia;
  - zgłoszenie artysty;
  - lista z filtrami i licznikiem;
  - akcje w szczegółach dla każdego stanu;
  - kontroferta przez północ;
  - `BOOKING_STALE` i `BOOKING_CALENDAR_CONFLICT`;
  - anulowanie z powodem;
  - 404.
- **Backend:** test integracyjny na `bookingId` w kalendarzu i ogłoszeniu.
- **End-to-end z prawdziwym backendem:**
  - lokal pyta artystę z profilu, artysta składa kontrofertę, lokal akceptuje, a termin w kalendarzu jest „Zarezerwowany” z linkiem;
  - artysta zgłasza się na „Szukam artysty”, lokal akceptuje, a ogłoszenie jest obsadzone;
  - anulowanie.

  Zrzuty desktop i mobile, jasny i ciemny motyw, do `w9-screens/`.

## 7. Decyzje domyślne (do zmiany jednym słowem)

1. Zapytanie lokalu wybiera termin z wolnych terminów artysty; można je zawęzić, ale nie wyjść poza nie (tak wymaga B10).
2. Przyciski bookingu są na profilu, ogłoszeniu i kartach wyszukiwarki; anonimowy użytkownik idzie przez logowanie.
3. Zakładka ma filtry Czeka na mnie / Oczekujące / Nadchodzące / Historia, a w menu jest licznik „czeka na mnie”.
4. Historia jest od najnowszego kroku, a wiadomości są częścią kroków. Czat przy bookingu przyjdzie w B11/W10.
5. Kalendarz i obsadzone ogłoszenie linkują do bookingu, dzięki małej zmianie w API.
