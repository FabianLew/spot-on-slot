# W0: szkielet aplikacji web (design)

Data: 2026-10-05 · Status: do przeglądu · Segment: W0 z `docs/architecture.md`

## Cel

Dać kolejnym segmentom web (W1–W15) gotowy szkielet `apps/web`, żeby żaden z nich nie wymyślał go sam:
- layout z nawigacją na komputer i telefon;
- trasy wszystkich sekcji;
- stany ładowania i błędów, z obsługą błędów API w formacie problem+json z B0;
- tłumaczenia PL/EN;
- motyw jasny i ciemny z tokenów;
- komponenty bazowe w `packages/ui`;
- wzorzec formularzy;
- testy frontendu w CI.

Sukces: segment W1 dodaje stronę z formularzem i wywołaniem API, używając tylko gotowych elementów: layoutu, komponentów z `@spot-on-slot/ui`, wzorca formularza, obsługi błędów i kluczy tłumaczeń. Wygląda ona tak samo w obu motywach i obu językach.

## Decyzje (z brainstormingu)

- Język: next-intl bez prefiksu w adresie; język w cookie, domyślnie `pl`.
- Nawigacja: sidebar na komputerze, dolne zakładki na telefonie.
- Motyw: jasny i ciemny od startu, domyślnie według systemu, przełącznik w menu i w ustawieniach.
- Stylistyka: czerń i szarości z czerwonym akcentem (korekta Fabiana z 2026-10-05).

## Poza zakresem

Logowanie, rejestracja i ochrona tras (W1); PWA, service worker i web push (W13); treść sekcji (W2–W15); testy e2e w Playwright (W16); landing (L1). Landing korzysta z tych samych tokenów, więc zmieni mu się paleta, ale jego strony nie są tu przebudowywane.

## 1. Tokeny i motyw

**Paleta (wartości tymczasowe do czasu brand booka).** Nazwy zgodne z konwencją shadcn/ui:

| Token | Jasny | Ciemny |
|---|---|---|
| `background` | #ffffff | #0a0a0a |
| `foreground` | #0a0a0a | #fafafa |
| `card` / `popover` | #ffffff | #171717 |
| `card-foreground` / `popover-foreground` | #0a0a0a | #fafafa |
| `primary` | #dc2626 | #dc2626 |
| `primary-foreground` | #ffffff | #ffffff |
| `secondary` | #f4f4f5 | #27272a |
| `secondary-foreground` | #18181b | #fafafa |
| `muted` | #f4f4f5 | #171717 |
| `muted-foreground` | #52525b | #a1a1aa |
| `accent` | #f4f4f5 | #27272a |
| `accent-foreground` | #18181b | #fafafa |
| `border` / `input` | #e4e4e7 | #27272a |
| `ring` | #dc2626 | #dc2626 |
| `success` | #15803d | #22c55e |
| `danger` | #b91c1c | #f87171 |
| `danger-foreground` | #ffffff | #0a0a0a |

Sidebar w motywie ciemnym używa `card` (#171717) na tle `background`.

Błędy (`danger`) zawsze idą z ikoną, żeby nie myliły się z czerwonym akcentem.

Tekst `primary-foreground` na `primary` ma kontrast 4,8:1, a `muted-foreground` na `background` i `muted` co najmniej 4,5:1 w obu motywach (WCAG AA).

**Pliki.**
- `packages/design-tokens/src/index.ts` eksportuje `colors.light` i `colors.dark` (te same klucze) oraz dotychczasowe `radius`, `spacing` i `typography`.
- `theme.css` definiuje zmienne CSS w `:root` (jasny) i `.dark` (ciemny), a `@theme inline` mapuje je na kolory Tailwinda (`bg-primary`, `text-muted-foreground`…).
- Test w `design-tokens` porównuje `theme.css` z `index.ts`, więc rozjazd wywala CI.

**Przełączanie.**
- `next-themes` z `attribute="class"`, domyślnie `system`.
- `<html suppressHydrationWarning>`, bez migania przy ładowaniu.
- `viewport.themeColor` ma osobny kolor dla `prefers-color-scheme: light` i `dark`.

## 2. Język (i18n)

- `next-intl` w trybie bez routingu. `src/i18n/request.ts` wybiera język w kolejności:
  1. cookie `NEXT_LOCALE`;
  2. pierwszy obsługiwany język z `Accept-Language`;
  3. `pl`.

  Obsługiwane języki pochodzą z `SUPPORTED_LOCALES` w `@spot-on-slot/shared`.
- Teksty w `apps/web/messages/pl.json` i `en.json`, pogrupowane po obszarach (`nav`, `common`, `errors`, `settings`, `pages`).
- Klucze są typowane: deklaracja `AppConfig` w next-intl z typem z `pl.json`, więc literówka w kluczu nie przejdzie `typecheck`.
- Test sprawdza, że `en.json` ma dokładnie te same klucze co `pl.json`.
- Zmiana języka: server action ustawia cookie (rok, `SameSite=Lax`) i odświeża stronę. `<html lang>` odpowiada aktywnemu językowi.
- Teksty w komponentach `packages/ui` przychodzą przez propsy (np. etykieta „Zamknij” w dialogu), więc `ui` nie zależy od next-intl.

## 3. Nawigacja i trasy

**Trasy** (angielskie, niezależne od języka), w grupie `src/app/(app)/` ze wspólnym layoutem:

| Trasa | Sekcja | Telefon |
|---|---|---|
| `/dashboard` | Pulpit | zakładka |
| `/calendar` | Kalendarz | zakładka |
| `/search` | Szukaj | zakładka |
| `/messages` | Wiadomości | zakładka |
| `/listings` | Ogłoszenia | Więcej |
| `/bookings` | Bookingi | Więcej |
| `/profile` | Profil | Więcej |
| `/settings` | Ustawienia | Więcej |

`/` przekierowuje na `/dashboard`. Strony sekcji mają nagłówek i pusty stan („Ta sekcja jest w przygotowaniu”); segmenty W2–W15 je wypełnią. `/settings` ma działający formularz (sekcja 6).

**Konfiguracja.** Jedna tablica `navItems` (`href`, klucz tłumaczenia, ikona lucide, `mobile: "tab" | "more"`) zasila sidebar, dolne zakładki i menu „Więcej”. Nowa sekcja to jeden wpis.

**Layout.**
- Od `md` (768 px): stały sidebar po lewej z logo (tekst „Spot On Slot” do czasu logo z brand booka), listą sekcji oraz menu użytkownika na dole (przełącznik języka i motywu; miejsce na konto po W1). Treść po prawej z ograniczoną szerokością.
- Poniżej `md`: górny pasek z tytułem sekcji i dolny pasek z 4 zakładkami oraz „Więcej”. „Więcej” otwiera dolny panel (`Sheet`) z pozostałymi sekcjami i przełącznikami. Dolny pasek uwzględnia `safe-area-inset-bottom`.
- Aktywna pozycja ma `aria-current="page"` i czerwony wskaźnik. Nawigacja to landmark `<nav>` z etykietą. Działa link „Przejdź do treści”.

## 4. Ładowanie i błędy

**Pliki tras.**
- `loading.tsx` w `(app)` pokazuje szkielety (`Skeleton`).
- `error.tsx` pokazuje komunikat i przycisk „Spróbuj ponownie” (`reset`).
- `not-found.tsx` to strona 404 z linkiem do pulpitu.
- `global-error.tsx` łapie błędy layoutu głównego.

**Błędy API.** `src/lib/api-error.ts`:
- `ApiProblem` to typ schematu `ProblemDetail` z `@spot-on-slot/api-client`.
- `toApiProblem(error)` normalizuje błąd z `openapi-fetch` albo błąd sieci do `ApiProblem`. Brak odpowiedzi daje kod `NETWORK_ERROR` z tłumaczeniem po stronie web.
- `ApiErrorState` wyświetla `title` i `detail` z backendu (już przetłumaczone przez `Accept-Language`) oraz `requestId` do zgłoszenia, z przyciskiem ponowienia.
- Klient API wysyła `Accept-Language` zgodny z aktywnym językiem.

**TanStack Query.** Domyślnie bez ponawiania dla 4xx, maksymalnie 2 próby dla 5xx i błędów sieci. Błędy mutacji bez własnej obsługi trafiają do toastu.

## 5. Komponenty `packages/ui`

shadcn/ui (Radix przez pakiet `radix-ui`, `class-variance-authority`, ikony `lucide-react`), dopasowane do tokenów:
- `Button`, z wariantami `default`, `secondary`, `outline`, `ghost`, `destructive` i rozmiarami; zastępuje obecny;
- `Input`, `Textarea`, `Label`, `Select`, `Checkbox`;
- `Dialog`, `Sheet`, `DropdownMenu`;
- `Toaster` i `toast` (`sonner`);
- `Avatar`, `Card`, `Skeleton`;
- `Form` i `FormField` (integracja z react-hook-form: etykieta, opis, komunikat błędu, `aria-invalid` i `aria-describedby`).

Każdy komponent ma widoczny fokus (`ring`) i działa z klawiatury.

## 6. Formularze

- `react-hook-form` + `zod` (4) przez `@hookform/resolvers`. Schematy, które przydadzą się też w Expo, trafiają do `@spot-on-slot/shared`.
- Komunikaty walidacji po stronie klienta są tłumaczone: schematy zwracają klucze, a `FormField` tłumaczy je przez next-intl.
- `applyServerErrors(form, problem)` mapuje `errors[]` z odpowiedzi `VALIDATION_FAILED` na pola formularza (`setError`). Błędy pól, których formularz nie zna, oraz inne kody trafiają do błędu głównego formularza.
- Wzorcowy formularz: `/settings` z wyborem języka (`Select`) i motywu (jasny, ciemny, systemowy). Zapis ustawia cookie i motyw, a potem pokazuje toast „Zapisano”. Do czasu W1 nic nie trafia na backend.

## 7. Testy i CI

- Vitest + Testing Library (`jsdom`) w `packages/ui`, `packages/design-tokens` i `apps/web`; skrypt `test` w każdym z nich i zadanie `test` w `turbo.json`.
- Zakres testów:
  - komponenty `ui` (render, wariant, dostępność `Form`/`FormField`);
  - zgodność `theme.css` z `index.ts`;
  - zgodność kluczy `pl.json`/`en.json`;
  - wybór języka (cookie, `Accept-Language`, domyślny);
  - `toApiProblem` i `applyServerErrors`;
  - `navItems` (każda sekcja ma stronę i tłumaczenie);
  - nawigacja (aktywna pozycja, zakładki i „Więcej” na telefonie);
  - formularz ustawień.
- CI: krok `pnpm test` w jobie frontendu.
- `CLAUDE.md` dostaje konwencje frontendu (navItems, i18n, błędy API, formularze, testy).

## Kryteria akceptacji

1. Na szerokości ≥ 768 px widać sidebar ze wszystkimi sekcjami; poniżej widać dolny pasek z 4 zakładkami i „Więcej” z resztą sekcji. Aktywna sekcja jest oznaczona wizualnie i przez `aria-current`.
2. Wszystkie trasy z tabeli działają, `/` prowadzi na `/dashboard`, a nieznany adres pokazuje stronę 404 w aktywnym języku.
3. Bez cookie język wynika z `Accept-Language` (domyślnie polski). Zmiana języka w ustawieniach lub menu przełącza teksty i `<html lang>` oraz przetrwa przeładowanie.
4. Motyw domyślnie podąża za systemem. Przełącznik zmienia go bez migania przy przeładowaniu. Oba motywy używają palety z sekcji 1.
5. Wyjątek w stronie pokazuje `error.tsx` z działającym „Spróbuj ponownie”. Błąd API pokazuje tytuł, opis i `requestId` z problem+json.
6. Formularz ustawień waliduje dane przez zod, pokazuje błędy przy polach, a `applyServerErrors` przypina `errors[]` z API do pól (test jednostkowy).
7. `packages/ui` eksportuje komponenty z sekcji 5, używane przez `apps/web`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` i `pnpm build` przechodzą lokalnie i w CI.
