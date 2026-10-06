# W6: kalendarz dostępności w aplikacji

Status: szkic do akceptacji Fabiana; widok tygodnia jako lista dni (wybór Fabiana 2026-10-06). Etap według `architektura/segmenty-mvp.md`: W6 (`apps/web`), na backendzie B7 (bez zmian w API).

## 1. Co dostaje artysta

1. **Zakładka „Kalendarz”** (`/calendar`) zastępuje dzisiejszą zaślepkę. Na górze przełącznik **Miesiąc / Tydzień**, strzałki i „Dziś”.
2. **Widok miesiąca** to siatka z makiety „Rezerwacja DJ-a”:
   - dzień z wolnym terminem jest żółty;
   - dzień z rezerwacją ma czerwony znacznik;
   - pusty dzień jest szary („niedostępny”), a wybrany dzień ma czerwoną ramkę.

   Każdy dzień da się kliknąć, także pusty. Obok siatki (na telefonie pod nią) jest panel wybranego dnia z terminami: godziny (np. „22:00–04:00, kończy się następnego dnia”), notatka, oznaczenie „Co tydzień” albo „Zarezerwowany”. Pod listą jest przycisk „Dodaj wolny termin”.
3. **Widok tygodnia** to siedem dni od poniedziałku, każdy z listą swoich terminów i przyciskiem „+”. Na komputerze dni stoją w kolumnach, na telefonie jeden pod drugim.
4. **Dodawanie i edycja** w jednym oknie:
   - pola: data, od, do i notatka (do 200 znaków); jeśli „do” wypada przed „od”, termin kończy się następnego dnia i okno to pisze;
   - pole „Powtarzaj co tydzień” pokazuje wybór dni tygodnia oraz „od” i opcjonalne „do” (zapis jako reguła);
   - błędy backendu, np. nakładanie się z terminem od 05.10 22:00, pokazują się w oknie.
5. **Terminy z reguły:**
   - przy pojedynczym dniu reguły do wyboru są „Pomiń ten dzień” i „Przywróć”;
   - pominięty dzień zostaje widoczny jako przekreślony, żeby dało się go przywrócić;
   - „Edytuj regułę” zmienia wszystkie przyszłe dni.
6. **Panel „Stałe terminy”** to lista reguł (dni, godziny, okres) z edycją i usuwaniem.
7. **Zarezerwowane terminy** są tylko do odczytu, z opisem „zmienisz je przez rezerwację”. Przeszłe dni też są tylko do odczytu. Od B10 zaakceptowana rezerwacja sama zamienia wolny czas w zarezerwowany (przez fasadę `Availability`), a odwołanie oddaje go jako wolny; od W9 termin pokaże nazwę lokalu i link do rezerwacji.
8. **Profil artysty** (podgląd w „Profil” i strona publiczna `/a/{slug}`) dostaje panel z makiety „Najbliższe wolne terminy”: do 6 najbliższych dni z wolnym terminem w ciągu 60 dni, jako chipy z datą i godziną. Bez wolnych terminów pokazuje „Brak wolnych terminów”. Przycisk „Zarezerwuj” przyjdzie z bookingiem (W9).

## 2. Inne role i stany

- Artysta bez profilu widzi w „Kalendarzu” informację i link do kreatora.
- Konto VENUE (i pozostałe role) widzi na razie informację, że kalendarz lokalu przyjdzie z rezerwacjami (W9).
- Godziny wyświetlamy w strefie Europe/Warsaw, tak jak resztę dat w aplikacji.

## 3. Jak to działa w aplikacji

- **Dane:**
  - widoczny miesiąc albo tydzień pobiera `GET /api/v1/availability/me?from=&to=`;
  - lista reguł pochodzi z `GET .../me/rules`;
  - zapisy idą przez `POST/PUT/DELETE` slotów i reguł oraz `DELETE/PUT .../rules/{id}/dates/{date}`;
  - po zapisie odświeżają się widoczne zakresy.
- **Strona publiczna:** chipy terminów pochodzą z `GET /api/v1/public/artists/{slug}/availability` i renderują się na serwerze.
- **`packages/ui`:**
  - `MonthCalendar` dostaje stan „zarezerwowany” i tryb, w którym każdy dzień da się wybrać (dzisiejsze użycie w makiecie „Rezerwacja DJ-a” działa bez zmian);
  - wybór dni tygodnia dla reguły korzysta z istniejącego `ChoiceChips`.
- **Kod:** komponenty w `components/calendar`, teksty PL/EN w `messages` (`calendar.*`).

## 4. Testy

- Vitest + Testing Library:
  - miesiąc i tydzień: stany dni i nawigacja;
  - dodanie terminu przez północ i reguły;
  - edycja i usuwanie;
  - pominięcie i przywrócenie dnia reguły;
  - błąd nakładania się;
  - zarezerwowany termin tylko do odczytu;
  - brak profilu, rola VENUE;
  - chipy na profilu.
- Sprawdzenie end-to-end z prawdziwym backendem: dodanie terminów i reguły, pominięcie dnia, widok publiczny. Zrzuty desktop i mobile, jasny i ciemny motyw, do `w6-screens/`.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. Widok tygodnia to lista terminów dnia w kolumnach, bez siatki godzin (karta decyzji w wątku).
2. Klik w dzień wybiera go i pokazuje panel dnia; dodawanie zawsze przez przycisk, nie przez sam klik.
3. Jedno okno dla terminu pojedynczego i cyklicznego (pole „Powtarzaj co tydzień”).
4. Edycja reguły zmienia wszystkie przyszłe dni; pojedynczy dzień można tylko pominąć albo przywrócić.
5. Profil pokazuje do 6 najbliższych wolnych dni w ciągu 60 dni, bez rezerwacji z poziomu chipa.
6. Kalendarz lokalu i rezerwacje przyjdą w W9.
