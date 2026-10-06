# W3: profil artysty w aplikacji

Status: zaakceptowany przez Fabiana 2026-10-06 (strona publiczna w aplikacji web). Etap według `architektura/segmenty-mvp.md`: W3 (`apps/web`), na backendzie B4 (bez zmian w API).

## 1. Co użytkownik dostaje

1. **Zakładka „Profil”** (`/profile`) dla konta ARTIST zastępuje dzisiejszą zaślepkę. Pokazuje profil tak, jak zobaczą go inni, w układzie z makiety „Profil DJ-a”:
   - zdjęcie, pseudonim, miasto, zasięg dojazdu i gatunki;
   - paski umiejętności;
   - opis, linki i widełki stawki;
   - galeria.

   Na górze jest pasek stanu: „Szkic” albo „Opublikowany” z linkiem do strony publicznej, przyciski „Edytuj”, „Opublikuj” albo „Wycofaj publikację” oraz „Kopiuj link”.
2. **Edycja** (`/profile/edit`) to jeden formularz w sekcjach (panele arcade):
   1. **Podstawy:** pseudonim, adres profilu (`/a/{slug}` ze sprawdzaniem, czy jest wolny), imię i nazwisko (prywatne, tylko dla Ciebie).
   2. **Muzyka:** gatunki (1–5) i własne tagi (do 10).
   3. **O mnie:** opis do 2000 znaków z licznikiem.
   4. **Zdjęcia:** zdjęcie główne i galeria do 12 zdjęć (dodawanie, usuwanie, kolejność strzałkami).
   5. **Linki:** SoundCloud, Spotify, Instagram, YouTube.
   6. **Stawka i dojazd:** widełki w zł (opcjonalne), zasięg dojazdu w km.
   7. **Umiejętności:** sześć suwaków jak w makiecie (tempo, doświadczenie, energia, winyle, CDJ, produkcja).
   8. **Lokalizacja:** obecne miasto i zmiana (ten sam wybór co w kreatorze).

   „Zapisz” wysyła cały profil naraz. Błędy z backendu trafiają do pól. Wyjście z niezapisanymi zmianami pyta o potwierdzenie.
3. **Strona publiczna** `/a/{slug}`:
   - dla każdego, także bez konta, renderowana na serwerze;
   - ten sam układ co podgląd, bez imienia, nazwiska i dokładnego punktu;
   - szkic albo nieistniejący adres daje stronę 404;
   - do startu MVP strona ma `noindex`, ale już teraz ma tytuł, opis i obrazek do udostępniania (Open Graph).
4. **Kreator W2:** na końcu odsyła do edycji („Uzupełnij resztę profilu”), a karta na pulpicie prowadzi do kreatora, dopóki profil nie ma tego, co potrzebne do publikacji.

Poza zakresem:
- kalendarz wolnych terminów i „Zarezerwuj” z makiety (B7/B10, W6/W7);
- profil lokalu (W4);
- indeksowanie w Google (do startu MVP).

## 2. Jak to działa w aplikacji

- **Dane:** `GET`/`PUT /api/v1/artists/me`, `POST .../publish` i `.../unpublish`, `GET /api/v1/artists/slugs/{slug}` (adres wolny?), `GET /api/v1/public/artists/{slug}`. Zapis reużywa `artistRequest` z W2.
- **Strona publiczna:**
  - leży poza grupą `(app)`, więc nie przechodzi przez `AuthGate`;
  - pobiera dane na serwerze tym samym api-clientem (bez tokenu);
  - adres backendu bierze z konfiguracji serwera.
- **Komponenty:** podgląd i strona publiczna mają jeden komponent `ArtistProfileView` (dane z profilu własnego albo publicznego). Formularz edycji składa się z małych sekcji, żeby W4 mogło użyć ich wzoru dla lokalu.
- **`packages/ui`:** dochodzą `TagInput` (tagi z klawiatury) i suwak umiejętności (`Slider` z `SkillMeter` jako podglądem); galeria z kolejnością korzysta z `ImagePicker`.
- **Inne role:** konto VENUE pod `/profile` widzi na razie informację, że profil lokalu przyjdzie w W4. BOOKER i ADMIN widzą zaślepkę jak dziś.
- **Teksty:** PL/EN w `messages`, w tym nazwy umiejętności i linków.

## 3. Testy

- Vitest + Testing Library:
  - podgląd szkicu i opublikowanego profilu;
  - publikacja z brakami i bez;
  - edycja: zapis całego profilu, błędy pól z backendu, zajęty adres;
  - galeria (dodanie, usunięcie, kolejność), tagi, suwaki;
  - strona publiczna (dane, 404, brak danych prywatnych).
- Sprawdzenie end-to-end z prawdziwym backendem:
  - edycja, publikacja, wejście na `/a/{slug}` bez logowania, wycofanie;
  - zrzuty desktop i mobile, jasny i ciemny motyw, do `w3-screens/`.

## 4. Decyzje domyślne (do zmiany jednym słowem)

1. Strona publiczna stoi w aplikacji web, w stylu arcade (karta decyzji w wątku).
2. Podgląd w zakładce „Profil” jest tym samym widokiem co strona publiczna, plus pasek stanu i przyciski.
3. Edycja to jedna strona z sekcjami i jednym „Zapisz”, a nie osobne zapisy sekcji.
4. Kolejność galerii zmienia się strzałkami (działa z klawiatury i na telefonie), bez przeciągania.
5. Stawka wpisywana w złotych (backend trzyma grosze), bez stawki = „do ustalenia”.
6. Bez kalendarza i rezerwacji, które przyjdą z bookingiem.
