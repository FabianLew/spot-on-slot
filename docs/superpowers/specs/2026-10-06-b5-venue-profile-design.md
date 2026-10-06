# B5: profil lokalu

Status: szkic do akceptacji Fabiana. Etap według `architektura/segmenty-mvp.md`: B5 (moduł `venue`). Spec zakłada wariant „jedno konto może prowadzić kilka lokali”, polecany na karcie decyzji z 2026-10-06.

## 1. Co użytkownik dostaje

1. Konto z rolą VENUE może założyć lokal i zostaje jego właścicielem. Jedna osoba może prowadzić kilka lokali, najwyżej 10, jako właściciel albo członek zespołu.
2. Lokal ma:
   - nazwę (wymagana) i typ: klub, bar, pub, sala koncertowa, sala eventowa, restauracja albo inny;
   - adres: ulica z numerem, kod pocztowy i miasto;
   - pojemność (liczba osób) i opis;
   - gatunki grane w lokalu (z tej samej listy co u artystów, od 1 do 5) i własne tagi;
   - linki: strona www, Instagram, Facebook;
   - zdjęcie główne i galerię do 12 zdjęć.
3. Adres lokalu to dane firmy, a nie osoby, więc jest publiczny i zapisany dokładnie. Inaczej niż w przypadku artysty nie przybliżamy go do 1 km. Punkt na mapie powstaje z geokodowania adresu przez moduł `location` (Photon, B3). Gdy geokoder nie znajdzie adresu, właściciel może wskazać punkt z podpowiedzi.
4. Zespół lokalu:
   - właściciel zaprasza osobę e-mailem jako właściciela albo menedżera;
   - zaproszona osoba przyjmuje zaproszenie po zalogowaniu na konto VENUE z tym adresem, a jeśli nie ma konta, najpierw je zakłada;
   - menedżer edytuje profil lokalu (a później, w B8 i B10, ogłoszenia i bookingi);
   - właściciel dodatkowo zarządza zespołem i publikacją;
   - lokal ma zawsze co najmniej jednego właściciela.
5. Po kliknięciu „Opublikuj” lokal jest widoczny pod `/v/{slug}` dla każdego, kto ma link, także bez konta. Wcześniej trzeba mieć nazwę, typ, adres z punktem, co najmniej jeden gatunek i zdjęcie główne. Profil publiczny nie pokazuje członków zespołu.
6. Inne moduły (wyszukiwarka B9, ogłoszenia B8, booking B10) dostają fasadę: lokale, którymi zarządza dana osoba i jej rola w każdym z nich, publiczne dane lokalu i jego punkt na mapie.

Poza zakresem:
- ekrany edycji, zespołu i strona publiczna w aplikacji web (W4, po W2);
- godziny otwarcia, scena i sprzęt (do dopisania później, jeśli makiety tego potrzebują);
- weryfikacja, że lokal naprawdę należy do osoby, która go założyła (moderacja, B13);
- indeksowanie w Google (do startu MVP strona ma `noindex`).

## 2. Backend (`venue`)

| Wywołanie | Wynik |
|---|---|
| `GET /api/v1/venues/mine` | lokale, którymi zarządzam, z moją rolą |
| `POST /api/v1/venues` | nowy lokal (szkic), twórca zostaje właścicielem; tylko rola VENUE (inne 403) |
| `GET`, `PUT /api/v1/venues/{id}` | odczyt i zapis całego profilu (właściciel i menedżer) |
| `POST /api/v1/venues/{id}/publish`, `.../unpublish` | publikacja (422 `VENUE_PROFILE_INCOMPLETE` z listą brakujących pól) i wycofanie (właściciel) |
| `DELETE /api/v1/venues/{id}` | usunięcie lokalu (właściciel) |
| `GET /api/v1/venues/{id}/team`, `POST .../team/invitations`, `DELETE .../team/{userId}`, `DELETE .../team/invitations/{id}` | zespół i zaproszenia (właściciel; lista także dla menedżera) |
| `POST /api/v1/venues/invitations/{token}/accept` | przyjęcie zaproszenia po zalogowaniu |
| `GET /api/v1/venues/slugs/{slug}` | 204, gdy adres jest wolny, albo 409 `VENUE_SLUG_TAKEN` |
| `GET /api/v1/venues/types` | lista typów (kody; nazwy PL/EN tłumaczy web) |
| `GET /api/v1/public/venues/{slug}` | profil publiczny bez logowania, tylko opublikowany (inaczej 404) |

- **Dane:** tabela `venue` (slug unikalny, pola tekstowe, adres, `latitude`/`longitude` i punkt PostGIS, pojemność, `published_at`), `venue_member` (lokal, użytkownik, rola, unikalna para), `venue_invitation` (e-mail, rola, skrót tokenu, ważność), kolekcje `venue_genre`, `venue_tag`, `venue_link`, `venue_photo`.
- **Slug:** te same zasady co u artysty (3–40 znaków, z nazwy bez polskich znaków, numer przy kolizji, zarezerwowane słowa), osobna przestrzeń adresów `/v/...`.
- **Adres:** zapis adresu geokoduje go przez fasadę `location`; brak wyniku nie blokuje zapisu, ale bez punktu nie da się opublikować lokalu. Zapis może też przyjść z punktem z podpowiedzi (`GET /api/v1/locations/search`).
- **Pojemność:** od 1 do 100 000 osób, opcjonalna.
- **Linki:** tylko `https://`; Instagram i Facebook na swoich domenach, strona www dowolna.
- **Zdjęcia:** jak u artysty: id z B2, sprawdzanie własności przez fasadę `media`, usunięte zdjęcie znika z profilu przez zdarzenie `MediaDeleted`. Zdjęcia dodaje ten, kto edytuje, więc w lokalu mogą być zdjęcia różnych członków zespołu.
- **Zaproszenia:**
  - mail przez moduł `notification`, link ważny 7 dni, jednorazowy;
  - przyjąć może tylko zalogowany użytkownik z rolą VENUE i tym samym adresem e-mail;
  - właściciel nie może usunąć ostatniego właściciela ani samego siebie, jeśli jest ostatnim.
- **Bezpieczeństwo:** każdy endpoint `/{id}` sprawdza członkostwo w zespole; dla osoby spoza zespołu lokal „nie istnieje” (404).
- **Błędy** (PL/EN): `VENUE_NOT_FOUND` (404), `VENUE_SLUG_TAKEN` (409), `VENUE_SLUG_RESERVED` (400), `VENUE_PROFILE_INCOMPLETE` (422), `VENUE_MEDIA_NOT_OWNED` (400), `VENUE_LIMIT_REACHED` (422), `VENUE_FORBIDDEN` (403, menedżer przy akcji właściciela), `VENUE_LAST_OWNER` (422), `VENUE_INVITATION_INVALID` (400), `VENUE_ALREADY_MEMBER` (409); walidacja pól jako 400 z `errors`.

## 3. Web

W tym etapie tylko nowe typy w `@spot-on-slot/api-client`. Ekrany edycji, zespołu, przełącznik lokali i strona `/v/{slug}` powstaną w W4 według makiety „Panel lokalu”, po kreatorze W2. Strona dla linku z zaproszenia też trafia do W4; do tego czasu link prowadzi na adres w aplikacji web, który W4 obsłuży.

## 4. Testy

- Backend, testy integracyjne:
  - zakładanie lokalu, limit 10, rola inna niż VENUE;
  - zapis i odczyt, geokodowanie adresu (stub Photon), brak wyniku;
  - slug, walidacja linków, gatunków i pojemności, cudze zdjęcie;
  - zespół: zaproszenie i przyjęcie, zły adres e-mail, wygasły token, menedżer bez praw właściciela, ostatni właściciel;
  - publikacja z brakami i bez braków, profil publiczny bez danych zespołu, 404 dla szkicu i dla osoby spoza zespołu;
  - `ModularityTest` zielony.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. Jedno konto VENUE może prowadzić do 10 lokali (do potwierdzenia na karcie decyzji).
2. Role w zespole: właściciel i menedżer.
3. Adres lokalu publiczny i dokładny (dane firmy).
4. Do publikacji potrzebne są: nazwa, typ, adres z punktem, gatunek i zdjęcie główne.
5. Zaproszenie e-mailem, ważne 7 dni, tylko dla konta VENUE z tym adresem.
6. Gatunki z tej samej listy co u artystów (1–5) plus własne tagi.
7. Linki: strona www, Instagram, Facebook.
8. B5 bez ekranów; ekrany w W4.
