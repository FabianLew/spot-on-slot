# W8: wyszukiwarka z mapą

Status: zaakceptowany przez Fabiana 2026-10-06 (z odświeżaniem po bezruchu mapy). Etap według `architektura/segmenty-mvp.md`: W8 (`apps/web`), na backendzie B9 (bez zmian w API).

## 1. Co dostają użytkownicy

1. **Zakładka „Szukaj”** (`/search`) zastępuje dzisiejszą zaślepkę i ma trzy karty: **Artyści**, **Lokale** i **Ogłoszenia**.
   - Domyślna karta zależy od roli:
     - konto lokalu widzi Artystów;
     - artysta widzi Ogłoszenia „Szukam artysty”.
2. **Miejsce i promień:**
   - na start środkiem jest własna lokalizacja z profilu (nazwa miasta w pasku);
   - „Zmień” otwiera pole z podpowiedziami miejsc, takie jak przy lokalizacji w profilu;
   - „Moja lokalizacja” bierze punkt z przeglądarki tylko do tego wyszukiwania, bez zapisywania;
   - promień do wyboru: 5, 10, 25, 50 (domyślnie), 100 lub 200 km.
3. **Filtry** (panel nad wynikami, na telefonie w wysuwanym arkuszu „Filtry”):
   - **gatunki** (dowolny z wybranych);
   - **termin:** data oraz godziny od–do (koniec przed początkiem oznacza następny dzień, jak w kalendarzu):
     - u artystów: tylko wolni przez cały ten czas;
     - w ogłoszeniach: wystarczy sama data albo data z godzinami;
   - **budżet** w zł;
   - **u artystów:** „Tylko ci, którzy dojadą”;
   - **u lokali:** typ lokalu;
   - **w ogłoszeniach:** „Jestem wolny” / „Szukam artysty”.

   Filtry są zapisane w adresie strony, więc link do wyszukiwania da się skopiować, a „wstecz” działa.
4. **Wyniki: lista i mapa.**
   - **Układ:** na desktopie lista jest po lewej, a mapa po prawej. Na telefonie przełącza się „Lista / Mapa”.
   - **Karty na liście:**
     - artysta: zdjęcie, pseudonim, miasto, gatunki, stawka, zasięg dojazdu i odległość;
     - lokal: zdjęcie, nazwa, typ, miasto, gatunki, pojemność i odległość;
     - ogłoszenie: karta jak w W7 plus autor i odległość.
   - **Kliknięcie karty** otwiera profil `/a/{slug}`, `/v/{slug}` albo ogłoszenie `/o/{id}`.
   - **Długość listy:** 20 wyników naraz i „Pokaż więcej”.
   - **Mapa:**
     - pokazuje pinezki 100 najbliższych wyników;
     - kliknięcie pinezki podświetla kartę i otwiera dymek z nazwą i linkiem;
     - kilka wyników w tym samym punkcie daje jedną pinezkę z liczbą.
   - **Przesunięcie mapy** odświeża wyniki dopiero, gdy mapa stoi w bezruchu przez 0,8 s. W trakcie przeciągania i zoomu nic nie jest wysyłane.
     - Środek to środek mapy, a promień to odległość do rogu widoku (najwyżej 200 km).
     - Małe przesunięcie (mniej niż ok. 1/4 widoku, bez zmiany zoomu) nie wysyła nowego zapytania.
     - Starsze zapytanie jest anulowane, gdy przychodzi nowe; wyniki, które już były, wracają z pamięci podręcznej bez zapytania.
     - Pasek miejsca pokazuje wtedy „Obszar mapy” zamiast nazwy miasta.
     - Przełącznik „Szukaj przy przesuwaniu mapy” (domyślnie włączony) pozwala to wyłączyć. Bez niego po przesunięciu pojawia się przycisk „Szukaj w tym obszarze”.
   - **Prywatność:** artyści stoją na mapie w przybliżonym punkcie (~1 km) z dopiskiem „okolice”, nigdy pod dokładnym adresem.
5. **Stany:**
   - bez zapisanej lokalizacji: „Wybierz miejsce albo ustaw lokalizację w profilu” z polem miejsca;
   - brak wyników: podpowiedź, żeby zwiększyć promień albo poluzować filtry;
   - błędy: `ApiErrorState`.

## 2. Mapa

- **Biblioteka:** MapLibre GL JS (decyzja z 2026-10-05).
- **Kafelki:** wektorowe kafelki OpenStreetMap z OpenFreeMap (darmowe, bez klucza, z atrybucją OSM).
  - Styl ma jasną i ciemną wersję w kolorach aplikacji. Pinezki są pikselowe: czerwone dla artystów, żółte dla lokali.
  - Zmiana dostawcy to jedna zmienna `NEXT_PUBLIC_MAP_STYLE_URL` (np. na MapTiler, gdy ruch urośnie).
- **Ładowanie:** mapa ładuje się tylko na `/search`, leniwie i bez renderowania na serwerze, żeby nie spowalniać reszty aplikacji.

## 3. Jak to działa w aplikacji

- **Dane:** `GET /api/v1/search/artists|venues|listings` przez `@spot-on-slot/api-client`.
  - Lista pobiera strony po 20 (`useInfiniteQuery`).
  - Mapa pobiera osobno 100 najbliższych.
  - Domyślny środek to własna lokalizacja: backend używa jej, gdy nie dostaje `lat`/`lng`.
- **Czas:** godziny liczy `warsaw-time.ts` (Europe/Warsaw); kwoty w zł zamieniane są na grosze.
- **Kod:** komponenty w `components/search`, mapa w osobnym pliku ładowanym dynamicznie, teksty PL/EN w `messages` (`search.*`).

## 4. Testy

- **Vitest + Testing Library** (mapa podmieniona na atrapę):
  - filtry w adresie i w zapytaniach;
  - domyślna karta według roli;
  - karty wyników i linki do profili;
  - „Pokaż więcej”;
  - brak lokalizacji, brak wyników, błąd;
  - przełącznik Lista/Mapa;
  - odświeżanie po bezruchu mapy (bez zapytań w trakcie ruchu, pomijanie drobnych przesunięć) i „Szukaj w tym obszarze” po wyłączeniu przełącznika;
  - grupowanie pinezek w jednym punkcie.
- **End-to-end z prawdziwym backendem:**
  - lokal szuka artystów w Krakowie z filtrem terminu i gatunku;
  - artysta szuka ogłoszeń „Szukam artysty”;
  - kliknięcie pinezki prowadzi do profilu.

  Zrzuty desktop i mobile, jasny i ciemny motyw, trafią do `w8-screens/`. Sandbox nie ma dostępu do serwera kafelków, więc na zrzutach mapa dostanie zastępczy podkład w kolorach stylu; prawdziwe kafelki zobaczysz lokalnie.

## 5. Decyzje domyślne (do zmiany jednym słowem)

1. **Karty i układ:** trzy karty (Artyści, Lokale, Ogłoszenia); domyślna według roli. Lista z mapą obok na desktopie, przełącznik na telefonie.
2. **Środek wyszukiwania:** własna lokalizacja, którą można zmienić na dowolne miejsce albo punkt z przeglądarki (niezapisywany). Promień domyślnie 50 km.
3. **Mapa:** odświeża wyniki po 0,8 s bezruchu, pomija drobne przesunięcia i da się to wyłączyć przełącznikiem (wtedy działa przycisk „Szukaj w tym obszarze”).
4. **Kafelki:** OpenFreeMap (darmowe, bez klucza), dostawcę wymienia się jedną zmienną.
5. **Rezerwacja:** przycisk „Zapytaj o booking” przy wynikach przyjdzie z W9; teraz karta prowadzi do profilu albo ogłoszenia.
6. **Zakres:** wyszukiwarka tylko dla zalogowanych (jak w B9). Zapisane wyszukiwania i powiadomienia o nowych wynikach przyjdą po MVP.
