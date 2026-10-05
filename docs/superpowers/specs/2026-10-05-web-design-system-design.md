# D1: design aplikacji webowej na bazie makiet „pixel/arcade”

Status: zaakceptowany przez Fabiana 2026-10-05. Źródło: dwie makiety (ciemna i jasna) czterech ekranów mobilnych: wybór roli („I have a slot / I have a spot”), profil DJ-a, rezerwacja DJ-a (kalendarz + formularz), panel lokalu.

## 1. Kierunek wizualny

Makiety zastępują dotychczasową paletę czarno-szaro-czerwoną **w aplikacji webowej** (`apps/web`). Landing zostaje bez zmian, dopóki Fabian nie zdecyduje inaczej.

Cechy stylu odczytane z makiet:
- ostre rogi (radius 0), cienkie ramki 1–2 px wokół każdego panelu, siatka linii w tle,
- trzy kolory: czerń/szarość, żółty, czerwony (czerwony = główna akcja i stan „wybrane”, żółty = wyróżnienie i wypełnienia),
- dwa kroje: pikselowy do nagłówków, etykiet i przycisków; monospace do treści i danych,
- tekst wersalikami, pikselowe ikony i ilustracje (słuchawki, pinezka, nuta, kwadrat), szachownica jako ornament.

### Kolory (zmierzone z makiet)

| Token | Jasny | Ciemny |
|---|---|---|
| tło (`background`) | `#d7d7d2` | `#050505` |
| panel (`card`) | `#eeeeea` | `#0d0d0d` |
| pole formularza (`input` tło) | `#fcfcf8` | `#050505` |
| tekst (`foreground`) | `#101010` | `#f2f2ee` |
| ramki (`border`) | `#101010` | `#ffd400` |
| żółty (`highlight`, nowy) | `#ffe31a` | `#ffd400` |
| czerwony (`primary`) | `#d91f17` | `#ff261f` |
| tekst na czerwonym | `#ffffff` | `#050505` |

Dwie świadome odchyłki od makiet, obie z powodu kontrastu (WCAG AA 4.5:1):
- jasny czerwony to `#d91f17` zamiast `#ff2c2c`: biały tekst na `#ff2c2c` ma tylko 3.7:1, na `#d91f17` ma 5.1:1,
- w ciemnym motywie tekst na czerwonych przyciskach jest czarny (5.4:1), tak jak na makiecie „Book now”; biały dawałby 3.8:1.

W ciemnym motywie nagłówki są żółte, treść jasna (`foreground`), żeby dłuższe opisy dało się czytać. Błędy (`danger`) nadal zawsze z ikoną.

### Typografia

- Nagłówki, etykiety, przyciski: **Silkscreen** (OFL, ma polskie znaki).
- Treść, dane, pola formularzy: **Space Mono** (OFL, polskie znaki).
- Oba kroje hostowane lokalnie (`next/font/local`), jak na landingu, żeby build nie zależał od Google Fonts.
- Makiety nie podają nazw krojów; to najbliższe darmowe odpowiedniki. Jeśli designer ma konkretne pliki, podmiana to jedna linijka.

### Ikony

Pikselowe ikony z biblioteki **pixelarticons** (MIT) zamiast lucide w całej aplikacji webowej (nawigacja, przyciski). Ilustracje z makiet (słuchawki DJ-a, pinezka, nuta, „radar”) rysuję jako własne SVG na siatce pikseli.

## 2. Gdzie lądują tokeny

`@spot-on-slot/design-tokens` dostaje drugi zestaw palet, `arcade` (`index.ts`) i plik `arcade.css`, który nadpisuje zmienne i radius. Web importuje `theme.css` + `arcade.css`, landing tylko `theme.css`. Test pilnuje zgodności `arcade.css` z `index.ts`, tak jak dziś dla `theme.css`. Przeniesienie landingu na nowy styl to później jeden import.

## 3. Adaptacja na desktop

Makiety są mobilne, więc dla szerokich ekranów (od `md`, 768 px):
- **Powłoka aplikacji**: boczny pasek nawigacji jako ramka z logo „SPOT / ON / SLOT” i żółtym kwadratem z ekranu wyboru roli; aktywna pozycja na czerwono. Na telefonie zostaje dolny pasek zakładek i arkusz „Więcej”, w nowym stylu.
- **Nagłówek strony**: ramka „‹ TYTUŁ ···” z makiet na telefonie; na desktopie ten sam pasek bez strzałki wstecz, nad treścią.
- **Profil DJ-a**: dwie kolumny (avatar + dane + tagi po lewej, statystyki + „O mnie” + lokalizacja + terminy po prawej), przycisk „Zarezerwuj” w prawej kolumnie zamiast przyklejonego do dołu ekranu.
- **Rezerwacja**: kalendarz po lewej, formularz wydarzenia po prawej.
- **Panel lokalu**: kafle „Dziś” w rzędzie po 3, pod nimi „Wolne sloty” i „Szybkie akcje” obok siebie, „Dziś wieczorem” na całą szerokość.
- **Wybór roli**: pełny ekran poza powłoką aplikacji, dwa duże kafle obok siebie (tak jak na telefonie, tylko większe).

## 4. Zakres D1

1. Tokeny `arcade`, kroje, ikony; przestylowanie komponentów `packages/ui` (przycisk, karta, pole, select, checkbox, dialog, arkusz, toast, menu) do ostrych rogów i ramek.
2. Nowe komponenty w `packages/ui`: `Panel` (ramka z tytułem), `PageHeader`, `Tag`, `SkillMeter` (pasek 10 kratek, np. „8/10”), `SlotChip` (termin), `StatTile` (kafel „Dziś”), `ActionTile` (szybka akcja), `MonthCalendar` (dostępny/wybrany/niedostępny), `Checker` (szachownica), pikselowe ilustracje.
3. Przestylowana powłoka (sidebar, dolne zakładki, „Więcej”, strona 404, ustawienia, strony-zaślepki).
4. Cztery ekrany z makiet zbudowane z tych komponentów na przykładowych danych, pod `/design` (poza nawigacją, `noindex`), w obu motywach i obu językach. Prawdziwe strony podłączę do API, gdy powstaną moduły `identity`, `artist`, `venue`, `availability`, `booking`; wtedy te ekrany przejdą pod docelowe adresy.
5. Teksty z makiet po polsku i angielsku w `messages/{pl,en}.json` (np. „Mam slot / Mam miejsce”, „Jestem DJ-em / Jestem klubem”).

Poza zakresem: landing, backend, logika rezerwacji, prawdziwy wybór roli przy rejestracji.

## 5. Dostępność

- Kontrast tekstu min. 4.5:1 w obu motywach (test na parach tokenów).
- Kalendarz: stany nie tylko kolorem (wybrany dzień ma też obramowanie i `aria-pressed`/`aria-selected`), nawigacja strzałkami.
- `SkillMeter` ma tekst „8/10” i `role="meter"` z `aria-valuenow`.
- Kroje pikselowe tylko w nagłówkach i krótkich etykietach, treść w monospace.
- Animacji brak poza istniejącymi; `prefers-reduced-motion` respektowany.

## 6. Weryfikacja

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`, zrzuty ekranów czterech ekranów i powłoki (telefon + desktop, jasny + ciemny) porównane z makietami i dołączone do PR.
