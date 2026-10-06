# B9: wyszukiwanie (moduł `search`)

Status: zaakceptowany przez Fabiana 2026-10-06 (wyszukiwanie tylko po zalogowaniu). Etap według `architektura/segmenty-mvp.md`: B9 (backend), ekrany z mapą przyjdą w W8.

## 1. Co użytkownicy dostają

Trzy wyszukiwarki z tymi samymi filtrami miejsca. Każda zwraca wyniki od najbliższych, z odległością i punktem pod mapę.

1. **Artyści** (opublikowane profile).
   - **Filtry:**
     - miejsce i promień;
     - gatunki (dowolny z wybranych);
     - termin od–do (tylko artyści, którzy mają wtedy wolny czas w kalendarzu);
     - budżet (stawka „od” artysty nie wyższa niż budżet; artyści bez stawki też pasują);
     - opcja „tylko ci, którzy dojadą”, czyli lokal mieści się w zasięgu dojazdu artysty.
   - **Karta:** pseudonim, adres profilu, miasto, gatunki, zdjęcie główne, stawka, zasięg dojazdu, odległość.
   - **Punkt:** zaokrąglony punkt artysty (~1 km), nigdy dokładny.
2. **Lokale** (opublikowane).
   - **Filtry:** miejsce i promień, gatunki, typ lokalu.
   - **Karta:** nazwa, adres profilu, typ, miasto, gatunki, pojemność, zdjęcie, odległość.
   - **Punkt:** dokładny punkt lokalu.
3. **Ogłoszenia** (aktywne, z opublikowanym autorem).
   - **Filtry:**
     - rodzaj („Jestem wolny” / „Szukam artysty”);
     - miejsce i promień;
     - termin od–do (ogłoszenia, które zachodzą na ten czas);
     - gatunki;
     - budżet (dla „Szukam artysty”: budżet lokalu „do” nie niższy niż podana kwota; dla „Jestem wolny”: stawka „od” nie wyższa).
   - **Karta:** jak w W7 (termin, gatunki, kwoty, miasto) plus autor i odległość.

## 2. API

- `GET /api/v1/search/artists`, `GET /api/v1/search/venues`, `GET /api/v1/search/listings`.
- **Wspólne parametry:**
  - `lat`, `lng` (środek, np. z własnej lokalizacji, z przeglądarki albo z podpowiedzi `GET /api/v1/locations/search`);
  - `radiusKm` (1–200, domyślnie 50);
  - `genres`;
  - `page`, `size` (do 100).
- **Bez `lat`/`lng`** środkiem jest zapisana lokalizacja szukającego. Bez niej dostaje 400 `SEARCH_LOCATION_REQUIRED`.
- **Kolejność:** zawsze od najbliższych, przy równej odległości alfabetycznie.
- **Wyniki** to strony w zwykłym formacie `PageResponse`. Ekran mapy w W8 pobiera do 100 najbliższych.

## 3. Jak to działa

- **`search` tylko składa wyniki** z fasad innych modułów. Dane zostają u właścicieli:
  - `Locations.findWithin` daje artystów w promieniu;
  - `Venues` i `Listings` dostają zapytania „opublikowane/aktywne w promieniu” na swoich kolumnach PostGIS;
  - `ArtistProfiles` zwraca karty artystów;
  - `Availability.freeAmong` sprawdza termin.
- **Bez Elasticsearch,** zgodnie z architekturą: SQL + PostGIS z indeksami gist, które już są.
- **Prywatność:** nic nie ujawnia dokładnego punktu osoby, imienia i nazwiska ani notatek z kalendarza.

## 4. Testy

- **Testy integracyjne (Testcontainers):**
  - promień i kolejność;
  - każdy filtr osobno;
  - termin z kalendarza (slot, reguła, rezerwacja);
  - „dojadą”;
  - szkice i nieaktywne ogłoszenia niewidoczne;
  - brak lokalizacji;
  - paginacja;
  - uprawnienia według decyzji z karty.
- **Na koniec:** `ModularityTest`, `pnpm api:generate`.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. **Kto może szukać:** zalogowani użytkownicy każdej roli (karta decyzji w wątku).
2. **Środek wyszukiwania:** podany punkt, a bez niego własna lokalizacja; promień 1–200 km, domyślnie 50 km.
3. **Kolejność:** zawsze od najbliższych. Sortowanie po cenie albo trafności przyjdzie po MVP.
4. **„Tylko ci, którzy dojadą”** jest opcjonalne; domyślnie liczy się tylko promień szukającego.
5. **Budżet** nie wyklucza artystów i ogłoszeń bez podanej kwoty („do ustalenia”).
6. **Zaawansowane wyszukiwanie dla płatnych lokali** (z modelu monetyzacji) przyjdzie później. Na MVP wszystko jest dostępne za darmo.
