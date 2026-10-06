# B4: profil artysty

Status: zaakceptowany przez Fabiana 2026-10-06. Etap według `architektura/segmenty-mvp.md`: B4 (moduł `artist`). Widoczność profilu publicznego: każdy z linkiem (Fabian wybrał 2026-10-06).

## 1. Co użytkownik dostaje

1. Konto z rolą ARTIST ma jeden profil artysty, który może zapisać w dowolnym momencie i uzupełniać po kawałku. Profil startuje jako szkic.
2. Profil zawiera:
   - pseudonim (wymagany), imię i nazwisko;
   - opis;
   - gatunki z listy i własne tagi;
   - linki do SoundCloud, Spotify, Instagram i YouTube;
   - stawkę orientacyjną;
   - zdjęcie główne i galerię;
   - zasięg dojazdu;
   - sześć suwaków „umiejętności” z makiety, od 1 do 10, które artysta ustawia sam: tempo, doświadczenie, energia, winyle, CDJ, produkcja.
3. Bazą artysty jest jego lokalizacja z B3, czyli miasto z dokładnością do około 1 km. Profil dodaje tylko zasięg dojazdu w km.
4. Po kliknięciu „Opublikuj” profil jest widoczny pod `/a/{slug}` dla każdego, kto ma link, także bez konta. Wcześniej trzeba mieć pseudonim, co najmniej jeden gatunek, zdjęcie główne i ustawioną lokalizację. Imię i nazwisko nie są publiczne, a zamiast punktu na mapie widać tylko miasto.
5. Inne moduły (wyszukiwarka B9, booking B10) dostają fasadę: czy użytkownik ma opublikowany profil, jego publiczne dane i zasięg.

Poza zakresem:
- ekrany edycji i strona publiczna w aplikacji web (W3, po W2);
- booker i reprezentowani artyści (B6, po MVP);
- dostępność i kalendarz (B7);
- moderacja (B13);
- indeksowanie w Google (do startu MVP strona ma `noindex`).

## 2. Backend (`artist`)

| Wywołanie | Wynik |
|---|---|
| `GET /api/v1/artists/me` | własny profil (wszystkie pola) albo 404 `ARTIST_PROFILE_NOT_FOUND` |
| `PUT /api/v1/artists/me` | utworzenie lub zapis całego profilu; tylko rola ARTIST (inne 403) |
| `POST /api/v1/artists/me/publish`, `.../unpublish` | publikacja (422 `ARTIST_PROFILE_INCOMPLETE` z listą brakujących pól) i wycofanie |
| `GET /api/v1/artists/slugs/{slug}` | 204, gdy adres jest wolny, albo 409 `ARTIST_SLUG_TAKEN` (do podpowiedzi w formularzu) |
| `GET /api/v1/artists/genres` | lista gatunków (kody; nazwy PL/EN tłumaczy web) |
| `GET /api/v1/public/artists/{slug}` | profil publiczny bez logowania, tylko opublikowany (inaczej 404) |

- **Dane:** tabela `artist_profile` (właściciel z unikalnym `owner_id`, `slug` unikalny, pola tekstowe, stawki, zasięg, umiejętności, `published_at`), `artist_genre` i `artist_tag` (kolekcje), `artist_photo` (kolejność, `media_id`).
- **Slug:**
  - 3–40 znaków, małe litery, cyfry i myślniki;
  - domyślnie powstaje z pseudonimu bez polskich znaków („Weronika K.” daje `weronika-k`), a przy kolizji dostaje kolejny numer;
  - artysta może go zmienić, ale tylko na wolny adres i nie na zarezerwowane słowa (`admin`, `api`, `new`, `me` i podobne).
- **Gatunki:** stała lista około 20 kodów w kodzie (np. `TECHNO`, `HOUSE`, `DRUM_AND_BASS`, `HIP_HOP`, `OPEN_FORMAT`), od 1 do 5 na profil; tagi własne do 10, każdy do 30 znaków.
- **Linki:** tylko `https://` i domena właściwego serwisu (np. `soundcloud.com`, `open.spotify.com`, `instagram.com`, `youtube.com` i `youtu.be`); inne adresy dają błąd walidacji.
- **Stawka:** od–do w PLN za występ, opcjonalna („do uzgodnienia” przy pustej); kwoty w groszach jako liczby całkowite.
- **Zdjęcia:**
  - zdjęcie główne i do 12 w galerii, wskazane przez `id` z B2;
  - backend sprawdza, że zdjęcia należą do artysty;
  - fasada modułu `media` zwraca adresy rozmiarów, a usunięte zdjęcie znika z profilu przez zdarzenie z `media`.
- **Lokalizacja:** miasto z fasady `location` (B3); do publikacji potrzebna ustawiona lokalizacja. Zasięg dojazdu od 0 do 500 km.
- **Bezpieczeństwo:** `/api/v1/public/**` jest bez logowania, tylko do odczytu, i nie zwraca imienia, nazwiska ani współrzędnych.
- **Błędy** (PL/EN): `ARTIST_PROFILE_NOT_FOUND` (404), `ARTIST_SLUG_TAKEN` (409), `ARTIST_SLUG_RESERVED` (400), `ARTIST_PROFILE_INCOMPLETE` (422), `ARTIST_MEDIA_NOT_OWNED` (400), walidacja pól jako 400 z `errors`.

## 3. Web

W tym etapie tylko nowe typy w `@spot-on-slot/api-client`. Formularz edycji i stronę `/a/{slug}` zbuduje W3 według makiety „Profil DJ-a”, po kreatorze W2. Architektura przewiduje publiczne profile SEO na landingu; gdzie stanie `/a/{slug}` (web czy landing), ustalimy w W3, bo endpoint publiczny jest ten sam.

## 4. Testy

- Backend:
  - testy integracyjne: zapis i odczyt, rola inna niż ARTIST, slug (generowanie, kolizja, zarezerwowany, zmiana), walidacja linków, gatunków i stawek, cudze zdjęcie;
  - publikacja z brakami i bez braków, profil publiczny (bez danych prywatnych, 404 dla szkicu), usunięcie zdjęcia w `media`;
  - `ModularityTest` zielony.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. Profil zaczyna jako szkic, a publikację włącza sam artysta.
2. Imię i nazwisko nie są publiczne.
3. Do publikacji potrzebne są: pseudonim, gatunek, zdjęcie główne i lokalizacja.
4. Gatunki ze stałej listy (1–5) plus własne tagi.
5. Stawka orientacyjna od–do w PLN za występ, opcjonalna.
6. Suwaki umiejętności z makiety, ustawiane przez artystę, opcjonalne.
7. Baza z lokalizacji konta (B3) plus zasięg dojazdu.
8. B4 bez ekranów; ekrany w W3.
