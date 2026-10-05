# B2: media (zdjęcia profili)

Status: do akceptacji przez Fabiana. Etap według `architektura/segmenty-mvp.md`: B2 (moduł `media`). Miniatury robi backend po uploadzie (Fabian wybrał 2026-10-05).

## 1. Co użytkownik dostaje

1. Zalogowany użytkownik wgrywa zdjęcie (JPEG, PNG albo WebP, do 10 MB) prosto z przeglądarki do magazynu plików, bez przesyłania przez nasz serwer.
2. Po wgraniu backend sprawdza plik, obraca go zgodnie z orientacją z aparatu, usuwa metadane (EXIF, w tym GPS) i zapisuje trzy rozmiary WebP: 320, 800 i 1600 px dłuższego boku.
3. Zdjęcie dostaje adresy trzech rozmiarów do wyświetlenia i może zostać usunięte przez właściciela.
4. Profile artysty i lokalu (B4/B5) będą wskazywać zdjęcia po `id`; w tym etapie zdjęcie istnieje samodzielnie.

Poza zakresem: wideo i pliki audio, przycinanie w przeglądarce, galerie profili (B4/B5, W3/W4), moderacja treści (B13), limity zapytań (B16).

## 2. Przepływ

| Krok | Wywołanie | Wynik |
|---|---|---|
| 1 | `POST /api/v1/media/uploads` `{contentType, size}` | `{uploadId, url, headers, expiresAt}`: podpisany adres PUT ważny 10 minut, z wymuszonym typem i rozmiarem |
| 2 | `PUT {url}` z przeglądarki | plik w magazynie, w prefiksie `uploads/` |
| 3 | `POST /api/v1/media/uploads/{uploadId}/complete` | backend pobiera plik, sprawdza, tworzy rozmiary, zwraca `MediaResponse` |
| – | `GET /api/v1/media/{id}` | `{id, width, height, variants: {small, medium, large}}` z adresami |
| – | `DELETE /api/v1/media/{id}` | usuwa rekord i pliki (tylko właściciel) |

Przetwarzanie w kroku 3 jest synchroniczne: przy 10 MB trwa ułamek sekundy do dwóch sekund, a użytkownik i tak czeka na podgląd. Kolejkę dodamy, jeśli pomiary pokażą, że trzeba.

## 3. Backend (`media`)

- **Dane:** `media_upload` (właściciel, klucz w magazynie, deklarowany typ i rozmiar, `expires_at`, status `PENDING`/`COMPLETED`) i `media` (właściciel, wymiary, klucze trzech wariantów) + kolumny `BaseEntity`.
- **Magazyn:** AWS SDK v2 (klient S3 i presigner) z nadpisanym adresem, więc ten sam kod działa z Cloudflare R2 na produkcji i z emulatorem lokalnie. Konfiguracja `spotonslot.media.*`: `endpoint`, `region`, `bucket`, `access-key`, `secret-key`, `public-base-url`.
- **Udostępnianie:** warianty leżą pod `media/{id}/{rozmiar}.webp` i są publiczne przez `public-base-url` (na R2 własna domena lub r2.dev; zdjęcia profili i tak będą na publicznych profilach). Oryginał z `uploads/` usuwamy po przetworzeniu, więc w magazynie nie zostaje plik z metadanymi.
- **Sprawdzanie pliku:** typ po pierwszych bajtach (nie po nagłówku z przeglądarki), rozmiar zgodny z deklarowanym, najwyżej 40 megapikseli (ochrona przed „bombą” z małego pliku o ogromnych wymiarach).
- **Obróbka:** Thumbnailator (skalowanie i orientacja EXIF), TwelveMonkeys (odporne czytanie JPEG, także CMYK), zapis WebP przez bibliotekę z natywnym libwebp (`webp-imageio`).
- **Błędy** (kody PL/EN w `messages_*.properties`): `MEDIA_UNSUPPORTED_TYPE` (400), `MEDIA_TOO_LARGE` (400), `MEDIA_UPLOAD_NOT_FOUND` (404, też cudzy lub wygasły upload), `MEDIA_FILE_MISSING` (400, nie wgrano pliku), `MEDIA_INVALID_IMAGE` (400, plik nie jest poprawnym obrazem), `MEDIA_NOT_FOUND` (404).
- **Limit:** 200 zdjęć na konto (`MEDIA_QUOTA_EXCEEDED`, 409), żeby jedno konto nie zapełniło magazynu.
- **Sprzątanie:** codziennie usuwamy niedokończone uploady starsze niż 24 godziny (rekord i plik). Zdjęcia niepodpięte do profilu zaczniemy sprzątać w B4/B5, gdy powstanie pojęcie „podpięte”.
- **Usunięcie konta (B14):** `media` nasłuchuje na przyszłe zdarzenie usunięcia konta; w B2 tylko zostawiam miejsce w projekcie.

## 4. Lokalnie i na produkcji

- Lokalnie emulator S3 **Adobe S3Mock** w `docker compose` i w testach (Testcontainers). MinIO, wpisany wcześniej w architekturze, nie publikuje już darmowych obrazów na Docker Hub.
- Produkcja: bucket R2, zmienne `MEDIA_ENDPOINT`, `MEDIA_BUCKET`, `MEDIA_ACCESS_KEY`, `MEDIA_SECRET_KEY`, `MEDIA_PUBLIC_BASE_URL` (wymagane w `prod`). Na liście wdrożeniowej (B16): reguła CORS na buckecie dla adresu aplikacji web (PUT z przeglądarki).

## 5. Web

- `@spot-on-slot/api-client`: pomocnik `uploadImage(file)` łączący trzy kroki (zgłoszenie, PUT, zakończenie).
- `packages/ui`: komponent wyboru zdjęcia w stylu arcade (przycisk + przeciągnij i upuść, podgląd, stan wysyłania, błąd z ikoną); tekst przez propsy.
- `apps/web`: podgląd komponentu na stronie `/design/upload`, żeby sprawdzić całość z prawdziwym backendem. Właściwe miejsca (zdjęcie profilu, galeria) dojdą w W2–W4.

## 6. Testy

- Backend: testy integracyjne z S3Mock: pełny przepływ, zły typ udający JPEG, za duży plik, upload bez pliku, cudzy upload, wygasły upload, usuwanie, limit, sprzątanie; test obróbki (orientacja, brak EXIF w wariantach, wymiary). `ModularityTest` zielony.
- Web: Vitest dla `uploadImage` (zamockowany `fetch`) i komponentu.

## 7. Decyzje domyślne (do zmiany jednym słowem)

1. Formaty JPEG, PNG, WebP do 10 MB; bez HEIC (zdjęcia z iPhone'a przeglądarka i tak zwykle wysyła jako JPEG).
2. Rozmiary WebP 320 / 800 / 1600 px, oryginał usuwany.
3. Warianty publiczne pod stałym adresem, bez podpisanych linków do odczytu.
4. 200 zdjęć na konto.
5. Emulator lokalny: S3Mock zamiast MinIO.
