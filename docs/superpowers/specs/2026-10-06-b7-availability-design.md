# B7: dostępność artysty (moduł `availability`)

Status: szkic do akceptacji Fabiana. Etap według `architektura/segmenty-mvp.md`: B7 (backend), ekrany przyjdą w W6.

## 1. Co dostaje artysta (i inni)

1. **Wolne sloty.** Artysta dodaje terminy, w których może zagrać: początek i koniec (np. sobota 22:00–04:00), opcjonalnie krótka notatka („tylko Kraków”).
2. **Cykliczność.** Reguła „co tydzień w wybrane dni, w tych godzinach”, od daty i opcjonalnie do daty, np. „wolne w piątki 21:00–03:00 od 10 października”. Pojedynczy termin z reguły można usunąć (np. urlop), nie ruszając reszty.
3. **Strefa czasowa.** Godziny reguł liczą się w strefie artysty (domyślnie `Europe/Warsaw`), więc „piątek 21:00” zostaje 21:00 także po zmianie czasu. Pojedyncze sloty trzymamy w UTC (`timestamptz`), jak resztę czasów.
4. **Zajęte terminy.** Slot ma stan „wolny” albo „zajęty”. W B7 każdy slot jest wolny. Zajmowanie po potwierdzonym bookingu dochodzi w B10 (zdarzenie `BookingAccepted`), ale model i fasada są na to gotowe.
5. **Widok publiczny.** Opublikowany profil artysty pokazuje wolne i zajęte terminy na najbliższe tygodnie, bez notatek.

Poza zakresem:
- ekrany kalendarza (W6);
- wyszukiwanie po terminie (B9, korzysta z fasady);
- dostępność lokali (lokal publikuje terminy przez ogłoszenia w B8);
- import z Google Calendar.

## 2. API

- **Kalendarz:** `GET /api/v1/availability/me?from=&to=` zwraca terminy w zakresie (do 92 dni). Sloty pojedyncze i rozwinięte reguły mają tę samą postać: początek, koniec, stan, notatka, skąd pochodzą (slot albo reguła).
- **Sloty:** `POST /api/v1/availability/me/slots`, `PUT`/`DELETE .../slots/{id}`.
- **Reguły:**
  - `GET`/`POST /api/v1/availability/me/rules`, `PUT`/`DELETE .../rules/{id}`;
  - `DELETE .../rules/{id}/dates/{date}` pomija jeden dzień reguły, a `PUT` na ten sam adres przywraca go.
- **Publiczne:** `GET /api/v1/public/artists/{slug}/availability?from=&to=`. Tylko opublikowane profile, tylko początek, koniec i stan.
- **Uprawnienia:** wszystko pod `/me` wymaga roli ARTIST i istniejącego profilu artysty.
- **Fasada `Availability`** dla innych modułów:
  - czy artysta jest wolny w danym przedziale;
  - którzy z podanych artystów są wolni w przedziale (pod B9);
  - zajęcie i zwolnienie przedziału (pod B10).

## 3. Reguły

- Slot trwa od 30 minut do 24 godzin i może przechodzić przez północ.
- Terminy jednego artysty nie mogą na siebie nachodzić, także z regułami: 409 `AVAILABILITY_OVERLAP` ze wskazaniem kolidującego terminu.
- Nie da się dodać ani zmienić terminu, który już się zaczął. Przeszłe terminy zostają do odczytu.
- Limity na konto: 20 reguł i 500 przyszłych pojedynczych slotów. Reguły rozwijają się najwyżej rok w przód.
- Błędy mają kody `AVAILABILITY_*` z tekstami PL/EN, jak w innych modułach.

## 4. Testy

- Testy integracyjne (Testcontainers):
  - zakresy dat, nakładanie się slotów i reguł;
  - przejście przez północ i zmiana czasu (reguła w piątek 21:00 przed i po 25 października);
  - pominięcie dnia reguły i limity;
  - widok publiczny bez notatek, 404 dla szkicu.
- Zajmowanie przedziału przez fasadę, jako przygotowanie pod B10.
- `ModularityTest`, potem `pnpm api:generate` i commit `schema.d.ts`.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. Artysta oznacza wolne terminy; pusty dzień znaczy „niedostępny” (karta decyzji w wątku).
2. Strefa domyślna `Europe/Warsaw`, bez wyboru strefy do czasu ustawień konta.
3. Reguły są tylko tygodniowe (wybrane dni tygodnia), bez „co drugi tydzień” i „pierwszy piątek miesiąca”.
4. Zakres odczytu do 92 dni, reguły do roku w przód.
5. Notatki slotu widzi tylko artysta.
6. Zajmowanie slotów po bookingu i podgląd zajętych terminów u lokalu przyjdą z B10.
