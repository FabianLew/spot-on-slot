# B3: lokalizacja

Status: zaakceptowany przez Fabiana 2026-10-05. Etap według `architektura/segmenty-mvp.md`: B3 (moduł `location`). Mapy i geokodowanie: MapLibre + OpenStreetMap (Fabian wybrał 2026-10-05).

## 1. Co użytkownik dostaje

1. Zalogowany użytkownik ustawia swoją lokalizację na dwa sposoby: przyciskiem „Użyj mojej lokalizacji” (geolokalizacja z przeglądarki, po jego zgodzie) albo wpisując miasto lub adres i wybierając jedną z podpowiedzi.
2. W obu przypadkach zapisujemy tylko punkt przybliżony do około 1 km i nazwę miejscowości (np. „Kraków, małopolskie”). Dokładnych współrzędnych z telefonu ani wpisanego adresu nie przechowujemy.
3. Użytkownik widzi zapisaną lokalizację, może ją zmienić albo usunąć.
4. Inne moduły dostają zapytanie „kto jest w promieniu X km od punktu”, posortowane po odległości. Skorzystają z niego profile (B4/B5) i wyszukiwarka (B9).

Poza zakresem: mapa na ekranie (W8), adres lokalu z dokładnym punktem (B5, ten sam moduł doda wtedy precyzję „dokładna”), kreator po rejestracji (W2), limity zapytań (B16).

## 2. Geokodowanie

- Dostawca: **Photon** (wyszukiwarka na danych OpenStreetMap, zaprojektowana pod podpowiedzi podczas pisania). Lokalnie i w dev publiczna instancja `photon.komoot.io`; na produkcję własna lub płatna instancja, adres w `LOCATION_GEOCODER_URL` (pozycja na liście wdrożeniowej B16, bo publiczna instancja nie daje gwarancji ruchu).
- Przeglądarka nie łączy się z Photonem bezpośrednio, tylko przez nasz backend. Dzięki temu dostawcę wymienimy w jednym miejscu (interfejs `Geocoder`), a klucz lub adres zostaje na serwerze.
- Podpowiedzi: od 3 znaków, do 5 wyników, nazwy po polsku dla PL (nazwy lokalne z OSM) i po angielsku dla EN, z preferencją wyników z Polski (bez twardego ograniczenia do kraju).
- Nazwa miejscowości przy zapisie pochodzi z odwrotnego geokodowania przybliżonego punktu, więc wygląda tak samo dla obu sposobów ustawienia i nie da się wpisać nazwy niezgodnej z punktem.

## 3. Backend (`location`)

| Wywołanie | Wynik |
|---|---|
| `GET /api/v1/locations/search?q=...` | lista podpowiedzi `{label, city, region, countryCode, latitude, longitude}` |
| `PUT /api/v1/locations/me` `{latitude, longitude, source: DEVICE\|MANUAL}` | zapisana lokalizacja `{label, city, region, countryCode, latitude, longitude, source, updatedAt}` (punkt już przybliżony) |
| `GET /api/v1/locations/me` | zapisana lokalizacja albo 404 `LOCATION_NOT_SET` |
| `DELETE /api/v1/locations/me` | 204 |

- **Dane:** tabela `location`: właściciel jako para `subject_type` + `subject_id` (teraz `USER`, w B5 dojdzie `VENUE`), jedna lokalizacja na właściciela, źródło, precyzja (`APPROXIMATE`), nazwa, miejscowość, region, kod kraju, szerokość i długość + kolumna PostGIS `geography(Point)` liczona z nich przez bazę, z indeksem GIST.
- **Przybliżenie:** zaokrąglenie do siatki 0,01° (w Polsce około 1,1 km na 0,7 km) przed zapisem i przed odwrotnym geokodowaniem.
- **Zapytanie w promieniu:** fasada modułu `findWithin(subjectType, punkt, promień km)` przez `ST_DWithin` na `geography`, z odległością w metrach, sortowanie po odległości, promień od 1 do 500 km. Bez endpointu REST w B3, żeby nie wystawiać listy użytkowników w okolicy; endpoint dostanie wyszukiwarka (B9) razem z jej filtrami.
- **Błędy** (PL/EN w `messages_*.properties`): `LOCATION_NOT_SET` (404), `LOCATION_GEOCODER_UNAVAILABLE` (503, dostawca nie odpowiada; nowa klasa w `shared.error`), `LOCATION_NOT_FOUND` (422, odwrotne geokodowanie nie znalazło miejscowości, np. punkt na morzu), złe współrzędne i za krótkie zapytanie jako zwykłe błędy walidacji (400 z `errors`).
- **Usunięcie konta (B14):** lokalizacja użytkownika zniknie razem z kontem przez zdarzenie; w B3 tylko zostawiam na to miejsce.

## 4. Web

- `packages/ui`: komponent `LocationPicker` w stylu arcade: pole z podpowiedziami (lista wyboru, obsługa klawiatury), przycisk „Użyj mojej lokalizacji”, stan ładowania i błąd z ikoną. Tekst przez propsy, geolokalizacja przekazana z zewnątrz.
- `apps/web`: strona `/design/location` do sprawdzenia całości z prawdziwym backendem (ustaw, pokaż, usuń). Właściwe miejsce, czyli kreator po rejestracji, dojdzie w W2.
- Odmowa zgody na geolokalizację w przeglądarce kończy się komunikatem i propozycją wpisania miasta.

## 5. Testy

- Backend: testy integracyjne z PostGIS i podstawionym Photonem (lokalny serwer HTTP z nagranymi odpowiedziami): zapis z urządzenia i ręczny, przybliżenie punktu, nadpisanie, odczyt, usunięcie, brak lokalizacji, dostawca niedostępny, brak miejscowości, walidacja; zapytanie w promieniu z odległościami i sortowaniem; test klienta Photona (mapowanie odpowiedzi, język). `ModularityTest` zielony.
- Web: Vitest dla `LocationPicker` i strony demo (zamockowany `fetch`).

## 6. Decyzje domyślne (do zmiany jednym słowem)

1. Lokalizacja użytkownika zawsze przybliżona do około 1 km, bez dokładnego punktu w bazie.
2. Geokoder Photon przez backend; publiczna instancja tylko w dev, własna na produkcji.
3. Podpowiedzi od 3 znaków, 5 wyników, preferencja Polski.
4. Zapytanie w promieniu tylko w fasadzie modułu, bez publicznego endpointu do B9.
5. Promień od 1 do 500 km.
