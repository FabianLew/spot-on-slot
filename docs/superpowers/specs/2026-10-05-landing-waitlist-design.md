# Landing z listą oczekujących: L1, B15, L2 (design)

Data: 2026-10-05 · Status: zatwierdzony (Fabian, 2026-10-05) · Segmenty: L1, B15, L2 z `docs/architecture.md`

## Cel

Uruchomić landing, który tłumaczy, czym jest Spot On Slot, i zbiera zapisy na listę oczekujących od artystów, bookerów oraz klubów i lokali. Zapis wymaga potwierdzenia linkiem z e-maila (double opt-in).

Sukces: osoba wchodzi na `/pl` lub `/en`, czyta stronę, zapisuje się, dostaje e-mail w swoim języku, klika link i widzi potwierdzenie. W bazie jest potwierdzony zapis z rolą, miastem i językiem.

## Decyzje (z brainstormingu)

- Języki: polski i angielski od startu, adresy `/pl` i `/en`.
- Administrator danych: dane w konfiguracji landingu. Build produkcyjny nie przejdzie bez nich (sekcja 4).
- Teksty: piszę je na podstawie brand booka, Fabian akceptuje razem z tym specem (sekcja 6).

## Poza zakresem

- Pełna polityka prywatności, regulamin, sitemap, analityka i Open Graph (L3).
- Publiczne profile (L4).
- Limity zapytań per IP (B16); tu jest tylko honeypot i limit ponownej wysyłki.
- Panel do przeglądania listy. Na razie lista jest dostępna tylko z bazy danych.
- Wysyłka wiadomości „ruszamy” do całej listy.
- Deploy landingu i produkcyjny serwer SMTP (B16).

## 1. Backend: moduł `waitlist` (B15)

**Moduł.** Nowy moduł Spring Modulith `pl.spotonslot.waitlist` z warstwami `api`, `application`, `domain` i `infrastructure`. W pakiecie głównym jest publiczne zdarzenie `WaitlistConfirmationRequested(email, locale, token)`.

**Tabela** `waitlist_signup` (migracja `V2__waitlist.sql`):
- kolumny bazowe;
- `email` (`varchar(254)`, zapisany małymi literami, unikalny);
- `role` (`ARTIST` | `BOOKER` | `VENUE`);
- `city` (`varchar(100)`);
- `locale` (`pl` | `en`);
- `status` (`PENDING` | `CONFIRMED`);
- `token_hash` (SHA-256 tokenu, unikalny);
- `token_expires_at`, `token_sent_at`, `consent_at`, `confirmed_at` (`timestamptz`).

Token to 32 losowe bajty w base64url. W bazie jest tylko jego hash.

**Zapis:** `POST /api/v1/waitlist/signups`.
- Body: `{ email, role, city, locale, consent, website }`.
- `website` to ukryte pole-pułapka (honeypot). Gdy jest wypełnione, backend nic nie zapisuje, ale odpowiada tak samo jak przy udanym zapisie.
- Walidacja:
  - `email` musi być poprawnym adresem e-mail, do 254 znaków;
  - `role` musi mieć jedną z trzech wartości;
  - `city` ma 2–100 znaków po przycięciu;
  - `locale` musi być z `SUPPORTED_LOCALES`;
  - `consent` musi być `true`.

  Błędy wracają jako `VALIDATION_FAILED` z `errors[]`.
- Odpowiedź to zawsze `202 Accepted` bez treści, żeby nie zdradzać, czy adres jest już na liście.
  - Nowy adres: tworzy zapis `PENDING`, ustawia token ważny 48 godzin i publikuje zdarzenie.
  - Adres w stanie `PENDING`: aktualizuje rolę, miasto i język. Jeśli od ostatniej wysyłki minęło co najmniej 10 minut, generuje nowy token i wysyła e-mail ponownie; w przeciwnym razie nie wysyła nic.
  - Adres w stanie `CONFIRMED`: nic nie zmienia i nic nie wysyła.
- Równoległy zapis tego samego adresu łapie `DataIntegrityViolationException` i kończy się tak samo, czyli `202`.

**Potwierdzenie:** `POST /api/v1/waitlist/confirmations` z body `{ token }`.
- `200` z `{ status: "CONFIRMED" }`. Ponowne użycie tego samego tokenu po potwierdzeniu też daje `200`.
- Nieznany token: `404` z kodem `WAITLIST_TOKEN_INVALID`.
- Wygasły token: `422` z kodem `WAITLIST_TOKEN_EXPIRED`.
- Potwierdzenie wymaga POST, a nie GET z linku, bo skanery poczty otwierające linki nie mogą przypadkowo potwierdzać zapisów.

**Sprzątanie.** Zadanie `@Scheduled` uruchamiane raz dziennie usuwa zapisy `PENDING` starsze niż 7 dni, licząc od `created_at`.

**Bezpieczeństwo.** Oba endpointy są publiczne (`PUBLIC_PATHS`). CORS dla landingu jest już skonfigurowany (`localhost:3001` w dev, `CORS_ALLOWED_ORIGINS` w prod).

**Teksty błędów.** W `messages_pl/en.properties` dochodzą `error.WAITLIST_TOKEN_INVALID.*` i `error.WAITLIST_TOKEN_EXPIRED.*`.

## 2. Backend: e-mail potwierdzający (moduł `notification`)

- Moduł `notification` słucha `WaitlistConfirmationRequested` (`@ApplicationModuleListener`, czyli po commicie, z rejestrem zdarzeń Modulith) i wysyła e-mail przez `spring-boot-starter-mail`.
- Wiadomość ma część tekstową i prostą część HTML, z tekstami z `MessageSource` w języku zapisu.
- Link w wiadomości: `{spotonslot.landing.base-url}/{locale}/waitlist/confirm?token={token}`.
- Konfiguracja:
  - dev: Mailpit z `docker-compose.yml`, czyli SMTP `localhost:1025` i podgląd poczty na `localhost:8025`;
  - prod: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` i `LANDING_BASE_URL` ze zmiennych środowiskowych;
  - testy: `JavaMailSender` jest mockowany.

## 3. Landing (L1)

**i18n.**
- next-intl z routingiem `[locale]`, prefiks zawsze widoczny.
- `/` przekierowuje według `Accept-Language`: na `/en` dla angielskiego, w pozostałych przypadkach na `/pl`. Robi to `proxy.ts`, czyli middleware w Next 16.
- Strony są generowane statycznie przez `generateStaticParams`.
- Teksty są w `apps/landing/messages/{pl,en}.json`, a test pilnuje zgodności kluczy.
- Przełącznik języka w nagłówku prowadzi na tę samą stronę w drugim języku.
- `<html lang>` odpowiada aktywnemu językowi. Metadane mają `alternates.languages`, czyli `hreflang`.

**Motyw.** Hero jest zawsze ciemny (czarne tło, biały tekst), niezależnie od ustawień systemu. Sekcje poniżej używają tych samych tokenów co `apps/web`; kolor jasny lub ciemny wynika z ustawień systemu (next-themes, `defaultTheme="system"`), bez przełącznika na landingu.

**Strona `/{locale}`, od góry:**
1. Nagłówek (pływa nad hero, sekcja 3a): logo i nazwa „Spot On Slot”, pigułka nawigacji z kotwicami do sekcji, przełącznik PL/EN i przycisk „Dołącz” przewijający do formularza.
2. Hero pełnoekranowy z reflektorem podążającym za kursorem (sekcja 3a).
3. Dla kogo: trzy karty (Artyści, Kluby i lokale, Bookerzy).
4. Jak to działa: trzy kroki.
5. Lista oczekujących: formularz (sekcja 5).
6. FAQ: rozwijane pytania na `<details>`/`<summary>`, czyli natywnie i bez JS.
7. Stopka: nazwa, rok i kontakt do administratora danych.

Teksty są w sekcji 6. Sekcje poniżej hero korzystają z komponentów `@spot-on-slot/ui` i działają od 360 px szerokości.

### 3a. Hero z reflektorem (prompt Fabiana z 2026-10-05)

Hero odtwarza kompozycję, interakcję i animacje z promptu Fabiana, przeniesione na nasz stack. Zachowane bez zmian: układ warstw, pozycje i rozmiary tekstów, klasy responsywne, animacje wejścia (`heroReveal`, `heroFadeUp`, `heroZoom` z tymi samymi czasami i opóźnieniami), wygładzanie kursora w `requestAnimationFrame` (współczynnik 0,1), promień reflektora 260 px, maska z canvasa z dokładnie tymi samymi przystankami gradientu, pigułka nawigacji z efektem szkła, `100dvh` i `prefers-reduced-motion`.

**Co zmieniam względem promptu i dlaczego:**

| W promptcie | U nas | Powód |
|---|---|---|
| React 18 + Vite | Next.js 16 w `apps/landing`, hero jako komponent kliencki `"use client"` | Landing już jest aplikacją Next; reszta strony jest statyczna i SEO |
| `@import` Google Fonts w CSS | `next/font/google` (Inter i Playfair Display italic) ze zmiennymi `--font-inter` i `--font-playfair` | Bez zewnętrznego żądania przy ładowaniu, brak przeskoku fontu |
| `@tailwind base/components/utilities` | Tailwind 4 (`@import "tailwindcss"`), keyframes w `globals.css` | Tak jest skonfigurowany monorepo |
| Stałe w pliku komponentu | Stałe konfiguracyjne (obrazy, kolor CTA, promień) w `hero.config.ts`; teksty z `messages/{pl,en}.json` | Teksty muszą mieć dwie wersje językowe |
| `CTA_COLOR` `#e8702a` | `#dc2626` i hover `#b91c1c`, czyli `primary` z tokenów | Nasza paleta: czerń, szarość, czerwień |
| Hamburger bez menu | Hamburger otwiera `Sheet` z linkami sekcji i przełącznikiem języka | Na telefonie bez tego nie da się przejść do FAQ ani zmienić języka |
| Tylko hero, bez sekcji poniżej | Pod hero są sekcje z punktu 3 (dla kogo, jak to działa, formularz, FAQ, stopka) | Landing musi zbierać zapisy; prompt zabrania dodatków tylko „bez wyraźnej prośby” |
| Nawigacja zawsze przezroczysta, biały tekst | Nad hero bez zmian (pigułka ze szkła); gdy hero schowa się pod paskiem (`IntersectionObserver` na sekcji hero, `rootMargin: -80px` u góry), nawigacja dostaje pełne tło `bg-background/95` z dolną krawędzią, tekst `text-foreground`, pigułkę `bg-muted`, CTA w kolorze `primary`; tokeny jasne i ciemne z motywu | Biały tekst znikał na jasnych sekcjach, a niewidoczny pasek `z-[100]` dalej przechwytywał kliknięcia (także hamburger) |
| Reflektor w `clientX`/`clientY` | Pozycja kursora minus `getBoundingClientRect().left/top` sekcji, liczone w każdej klatce | Canvas maski jest w układzie sekcji; po przewinięciu strony plamka była przesunięta względem kursora |
| Pętla `requestAnimationFrame` działa zawsze | Pętla zatrzymana, gdy sekcja hero jest poza ekranem (`IntersectionObserver`), wznawia się od ostatniej wygładzonej pozycji | Bez sensu liczyć i renderować maskę 60 razy na sekundę, gdy hero nie widać |

**Mechanika reflektora: dokładnie jak w promptcie Fabiana (zrzut z 2026-10-05).** W komponencie nadrzędnym `SPOTLIGHT_R = 260`; refy `mouse` (surowa pozycja), `smooth` (wygładzona) i `rafRef`; stan `cursorPos` z wartością początkową `{x: -999, y: -999}`. Nasłuch `mousemove` zapisuje `clientX`/`clientY`. Pętla `requestAnimationFrame` liczy `smooth.x += (mouse.x - smooth.x) * 0.1` (tak samo dla `y`; `mouse` to pozycja kursora pomniejszona o `getBoundingClientRect().left/top` sekcji, zob. tabela wyżej) i wywołuje `setCursorPos`; pętla jest wstrzymana, gdy hero jest poza ekranem. Po odmontowaniu: zdjęcie nasłuchu i `cancelAnimationFrame`. `RevealLayer({ image, cursorX, cursorY })` trzyma ukryty `canvas` (`absolute inset-0 pointer-events-none`, `display: none`) o rozmiarze `window.innerWidth/innerHeight`, ustawianym przy montowaniu i `resize`, oraz `div` odsłaniający (`absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none`) z obrazem w tle. Przy każdej zmianie pozycji: czyszczenie canvasa, gradient radialny w `(cursorX, cursorY)` od 0 do `SPOTLIGHT_R` z przystankami 0 → `rgba(255,255,255,1)`, 0,4 → 1, 0,6 → 0,75, 0,75 → 0,4, 0,88 → 0,12, 1 → 0, wypełnienie koła o promieniu `SPOTLIGHT_R`, potem `canvas.toDataURL()` jako `maskImage` i `WebkitMaskImage` z `maskSize: '100% 100%'`. Bez dodatkowego dławienia. Na ekranach dotykowych nie ma `mousemove`, więc kursor zostaje w `(-999, -999)` i widać sam obraz bazowy; to wynika z mechaniki, a nie z osobnego warunku.

**Grafiki.** `apps/landing/public/hero/base.jpg` (czarno-biała, 1023×1537) jako obraz bazowy i `reveal.png` (czerwona, 1360×2048) jako obraz odsłaniany. Obie mają tę samą kompozycję i proporcje, więc `bg-cover` z wyśrodkowaniem je pokrywa. W implementacji `reveal.png` (3,6 MB) zostaje przekonwertowany do JPEG lub WebP o tej samej szerokości, żeby ważył poniżej 500 kB. Obrazy są pionowe, więc na szerokich ekranach `bg-cover` przytnie górę i dół; profil pozostaje w kadrze, bo jest w środku kompozycji. Zdjęcia referencyjne są też w `/mnt/project-files/landing-hero/`.

**Wartości konfiguracyjne (`hero.config.ts`):**

```ts
export const HERO_BASE_IMAGE = "/hero/base.jpg";
export const HERO_REVEAL_IMAGE = "/hero/reveal.jpg";
export const HERO_CTA_COLOR = "#dc2626";
export const HERO_CTA_HOVER_COLOR = "#b91c1c";
export const SPOTLIGHT_R = 260;
export const NAV_ITEMS = ["audiences", "howItWorks", "waitlist", "faq"] as const; // klucze tłumaczeń i kotwice
export const ACTIVE_NAV_ITEM = "audiences";
```

**Teksty hero** (zastępują wiersz „Hero” z sekcji 6):

| | PL | EN |
|---|---|---|
| Nazwa | Spot On Slot | Spot On Slot |
| Nagłówek, linia 1 (Playfair italic) | Idealny artysta | The right artist |
| Nagłówek, linia 2 | na Twoje wydarzenie. | for your event. |
| Opis lewy dół | Spot On Slot łączy artystów, bookerów, kluby i lokale. Sprawdzasz dostępność, umawiasz występ i oszczędzasz czas na organizacji. | Spot On Slot connects artists, bookers, clubs and venues. Check availability, book a performance and save time on organising. |
| Opis prawy dół | Ruszamy wkrótce. Zapisz się na listę oczekujących, a damy Ci znać jako pierwszemu. | Launching soon. Join the waitlist and you'll be the first to know. |
| CTA główne | Dołącz do listy oczekujących | Join the waitlist |
| Nawigacja | Dla kogo · Jak to działa · Lista oczekujących · FAQ | Who it's for · How it works · Waitlist · FAQ |
| CTA w nawigacji | Dołącz | Join |

Logo: do czasu brand booka abstrakcyjny znak SVG z promptu.

**Dostępność.** Reflektor jest wyłącznie dekoracją: obrazy mają pustą alternatywę (`aria-hidden`), a treść hero to zwykłe nagłówki i akapity. Przy `prefers-reduced-motion` nie ma animacji wejścia ani zoomu, reflektor zostaje.

**Testy hero.** Render tekstów z tłumaczeń, aktywna pozycja nawigacji, CTA przewija do `#waitlist`, brak maski na urządzeniu bez kursora, sprzątanie nasłuchiwania `mousemove` i `requestAnimationFrame` po odmontowaniu.

**Strona `/{locale}/waitlist/confirm?token=…`.** Komponent kliencki wysyła token przez `POST /confirmations` i pokazuje jeden z czterech stanów:
- ładowanie;
- „Gotowe”;
- „Link wygasł”, z przyciskiem do formularza;
- „Link nieprawidłowy” (też gdy brak tokenu albo wystąpi błąd sieci; przy błędzie sieci jest przycisk „Spróbuj ponownie”).

Strona ma `robots: noindex`.

## 4. Administrator danych w konfiguracji

- Zmienne `NEXT_PUBLIC_PRIVACY_CONTROLLER` (nazwa lub imię i nazwisko) i `NEXT_PUBLIC_PRIVACY_EMAIL` trafiają do klauzuli pod formularzem i do stopki.
- Gdy `LANDING_ENV=production`, `next.config.ts` przerywa build, jeśli którejś z nich brakuje.
- W dev i CI brakujące wartości zastępuje widoczny tekst „[administrator danych]” i „[e-mail kontaktowy]”, żeby nie dało się go przeoczyć.
- Do tego `NEXT_PUBLIC_API_URL`, czyli adres backendu. Build z `LANDING_ENV=production` wymaga też jej oraz `NEXT_PUBLIC_SITE_URL` (bez nich formularz trafiałby na `localhost`).

## 5. Formularz zapisu (L2)

- Pola:
  - E-mail;
  - „Kim jesteś?” jako `Select`: Artysta, Booker, Klub lub lokal;
  - Miasto, jako zwykłe pole tekstowe (podpowiedzi miast dojdą z modułem lokalizacji);
  - zgoda jako `Checkbox`;
  - honeypot `website`, ukryty przed ludźmi i czytnikami ekranu.
- `react-hook-form` + zod, ten sam wzorzec co w `apps/web`:
  - `Form` z `@spot-on-slot/ui`;
  - komunikaty walidacji jako klucze;
  - `applyServerErrors` dla `errors[]` z backendu. Funkcję przenoszę z `apps/web` do pakietu, z którego korzystają obie aplikacje (pakiet wybierze plan).
- Wywołanie przez `@spot-on-slot/api-client` z `Accept-Language`. `locale` w body to język strony.
- Po sukcesie formularz zastępuje komunikat „Sprawdź skrzynkę” z adresem e-mail.
- Błąd sieci lub serwera pokazuje komunikat nad przyciskiem, z ikoną.
- Pod przyciskiem jest klauzula informacyjna (sekcja 6).

## 6. Teksty do akceptacji

Źródło: brand book, czyli misja („zbliżać ludzi i ułatwiać im współpracę”, „zaoszczędzić czas przy organizacji eventów”), Big Idea, persona marki (punktualna, dokładna, godna zaufania, pomocna) i lista funkcji aplikacji. Nie ma w nich liczb, opinii ani dat startu.

### Hero
Teksty hero są w sekcji 3a.

### Dla kogo
| | PL | EN |
|---|---|---|
| Nagłówek | Dla kogo jest Spot On Slot | Who Spot On Slot is for |
| Artyści | Pokaż, kiedy masz wolne terminy, i daj znać, że szukasz występu. Lokale z okolicy łatwiej Cię znajdą. | Show when you're free and let people know you're looking for gigs. Venues nearby will find you more easily. |
| Kluby i lokale | Znajdź artystę na konkretny termin w pobliżu, wyślij zapytanie i ustal szczegóły w jednym miejscu. | Find an artist nearby for a specific date, send a request and settle the details in one place. |
| Bookerzy | Prowadź kalendarze swoich artystów i odpowiadaj na zapytania z jednego miejsca. | Keep your artists' calendars and answer requests from one place. |

Funkcje dla bookerów nie są jeszcze przesądzone w MVP. Jeśli booker trafi do aplikacji po starcie, ta karta i tak opisuje cel, a nie termin.

### Jak to działa
| Krok | PL | EN |
|---|---|---|
| Nagłówek | Jak to działa | How it works |
| 1 | **Załóż profil.** Artysta dodaje opis i linki do swojej muzyki, lokal nazwę i lokalizację. | **Create a profile.** Artists add a bio and links to their music, venues add their name and location. |
| 2 | **Pokaż lub znajdź termin.** Artyści zaznaczają wolne dni w kalendarzu, lokale szukają artystów dostępnych w danym terminie. | **Share or find a date.** Artists mark free days in their calendar, venues search for artists available on a given date. |
| 3 | **Umów występ.** Wyślij zapytanie, ustal szczegóły w wiadomościach i potwierdź booking. | **Book the gig.** Send a request, agree on the details in messages and confirm the booking. |

### Lista oczekujących
| | PL | EN |
|---|---|---|
| Nagłówek | Dołącz do listy oczekujących | Join the waitlist |
| Opis | Damy Ci znać, gdy ruszymy. Zapis jest bezpłatny i do niczego nie zobowiązuje. | We'll let you know when we launch. Signing up is free and there's no commitment. |
| E-mail | Adres e-mail | Email address |
| Rola | Kim jesteś? | Who are you? |
| Opcje roli | Artysta / Booker / Klub lub lokal | Artist / Booker / Club or venue |
| Miasto | Miasto | City |
| Zgoda | Zgadzam się na przetwarzanie mojego adresu e-mail, roli i miasta, żeby Spot On Slot mógł poinformować mnie o starcie platformy. | I agree to the processing of my email address, role and city so that Spot On Slot can tell me when the platform launches. |
| Przycisk | Zapisz mnie | Sign me up |
| Sukces | **Sprawdź skrzynkę.** Wysłaliśmy link potwierdzający na {email}. Kliknij go, żeby dokończyć zapis. | **Check your inbox.** We've sent a confirmation link to {email}. Click it to complete your sign-up. |
| Błąd | Nie udało się zapisać. Spróbuj ponownie za chwilę. | We couldn't sign you up. Please try again shortly. |

Komunikaty walidacji: „Podaj poprawny adres e-mail”, „Wybierz, kim jesteś”, „Podaj miasto”, „Zgoda jest wymagana do zapisu” (EN: “Enter a valid email address”, “Choose who you are”, “Enter your city”, “Consent is required to sign up”).

### Klauzula informacyjna (pod formularzem)
**PL:** Administratorem Twoich danych jest {administrator}, kontakt: {e-mail}. Przetwarzamy adres e-mail, rolę i miasto wyłącznie po to, żeby poinformować Cię o starcie Spot On Slot, na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO). Niepotwierdzone zapisy usuwamy po 7 dniach, a potwierdzone przechowujemy do wycofania zgody albo zamknięcia listy oczekujących. Zgodę możesz wycofać w każdej chwili, pisząc na powyższy adres. Masz prawo dostępu do danych, ich sprostowania i usunięcia oraz prawo skargi do Prezesa UODO.

**EN:** Your data is controlled by {administrator}, contact: {email}. We process your email address, role and city only to tell you when Spot On Slot launches, based on your consent (Art. 6(1)(a) GDPR). Unconfirmed sign-ups are deleted after 7 days; confirmed ones are kept until you withdraw consent or the waitlist closes. You can withdraw consent at any time by writing to the address above. You have the right to access, correct and delete your data and to lodge a complaint with the supervisory authority (in Poland, the President of UODO).

Przed startem produkcyjnym warto dać klauzulę do przejrzenia prawnikowi.

### FAQ
| PL | EN |
|---|---|
| **Czym jest Spot On Slot?** Platformą do umawiania występów i planowania wydarzeń. Łączy artystów, bookerów, kluby i lokale, żeby łatwiej im było ze sobą współpracować. | **What is Spot On Slot?** A platform for booking performances and planning events. It connects artists, bookers, clubs and venues so they can work together more easily. |
| **Kiedy startujecie?** Pracujemy nad pierwszą wersją. Osoby z listy oczekujących dowiedzą się o starcie jako pierwsze. | **When do you launch?** We're working on the first version. People on the waitlist will be the first to know. |
| **Ile to kosztuje?** Zasady i ceny ogłosimy przed startem. Zapis na listę jest bezpłatny. | **How much does it cost?** We'll announce pricing before launch. Joining the waitlist is free. |
| **Po co pytacie o rolę i miasto?** Żeby lepiej przygotować platformę dla artystów, bookerów i lokali w Twojej okolicy. | **Why do you ask for my role and city?** So we can better prepare the platform for artists, bookers and venues in your area. |
| **Czy będzie działać na telefonie?** Tak. Pierwsza wersja działa w przeglądarce na komputerze i telefonie, aplikacja mobilna pojawi się później. | **Will it work on my phone?** Yes. The first version runs in the browser on desktop and mobile; a mobile app will follow. |
| **Jak usunąć mój zapis?** Napisz na adres administratora podany pod formularzem, a usuniemy Twoje dane. | **How do I remove my sign-up?** Write to the contact address below the form and we'll delete your data. |

### Strona potwierdzenia
| Stan | PL | EN |
|---|---|---|
| Ładowanie | Potwierdzamy Twój zapis… | Confirming your sign-up… |
| Sukces | **Gotowe, jesteś na liście.** Napiszemy, gdy ruszymy. | **Done, you're on the list.** We'll write when we launch. |
| Wygasł | **Link wygasł.** Zapisz się ponownie, a wyślemy nowy. | **This link has expired.** Sign up again and we'll send a new one. |
| Nieprawidłowy | **Ten link jest nieprawidłowy.** Sprawdź, czy skopiowałeś cały adres z wiadomości. | **This link is invalid.** Check that you copied the full address from the email. |
| Przyciski | Wróć na stronę główną / Spróbuj ponownie | Back to home / Try again |

### E-mail potwierdzający
| | PL | EN |
|---|---|---|
| Temat | Potwierdź zapis na listę Spot On Slot | Confirm your Spot On Slot waitlist sign-up |
| Treść | Cześć! Dziękujemy za zapis na listę oczekujących Spot On Slot. Kliknij poniższy link, żeby go potwierdzić. Link jest ważny przez 48 godzin. {link} Jeśli to nie Ty, zignoruj tę wiadomość. Bez potwierdzenia nie zapiszemy Twojego adresu. | Hi! Thanks for joining the Spot On Slot waitlist. Click the link below to confirm. The link is valid for 48 hours. {link} If this wasn't you, just ignore this email. Without confirmation we won't keep your address. |
| Przycisk w HTML | Potwierdź zapis | Confirm sign-up |

### Błędy API (backend)
| Kod | PL | EN |
|---|---|---|
| `WAITLIST_TOKEN_INVALID` | Nieprawidłowy link / Link potwierdzający jest nieprawidłowy. | Invalid link / The confirmation link is invalid. |
| `WAITLIST_TOKEN_EXPIRED` | Link wygasł / Link potwierdzający wygasł. Zapisz się ponownie. | Link expired / The confirmation link has expired. Please sign up again. |

## 7. Testy i CI

- **Backend:** testy integracyjne `@IntegrationTest` dla obu endpointów:
  - nowy adres, ponowny zapis `PENDING` z limitem 10 minut i bez niego, adres `CONFIRMED`;
  - honeypot, walidacja;
  - token poprawny, wygasły, nieznany i użyty drugi raz;
  - wyścig zapisu przez unikalny indeks;
  - sprzątanie.

  Do tego test listenera e-mail z mockiem `JavaMailSender` (temat, link, język) i `ModularityTest`.
- **Landing:** Vitest + Testing Library:
  - zgodność kluczy `pl.json`/`en.json`;
  - przekierowanie `/` według `Accept-Language`;
  - formularz: walidacja, sukces, błędy z serwera, honeypot;
  - cztery stany strony potwierdzenia;
  - fallback administratora danych.

  Skrypt `test` w `apps/landing` uruchamia się w istniejącym kroku `pnpm test` w CI.
- `pnpm api:generate` po zmianach w API; `schema.d.ts` jest w commicie.
- `CLAUDE.md`: konwencje landingu (i18n z prefiksem, teksty w `messages`, zmienne administratora danych).

## Kryteria akceptacji

1. `/` przekierowuje na `/pl` albo `/en` według `Accept-Language`, a obie wersje pokazują wszystkie sekcje z tekstami z sekcji 3a i 6, w motywie jasnym i ciemnym, od 360 px szerokości.
1a. Hero zajmuje cały ekran, a ruch kursora odsłania czerwoną wersję grafiki w miękkim kole o promieniu 260 px, z opóźnieniem względem wskaźnika. Teksty i CTA pojawiają się animacją wejścia z promptu; przy `prefers-reduced-motion` są widoczne od razu.
2. Poprawny zapis kończy się komunikatem „Sprawdź skrzynkę”, a w Mailpit widać e-mail w języku strony z linkiem `/{locale}/waitlist/confirm?token=…`.
3. Kliknięcie linku pokazuje „Gotowe, jesteś na liście”, a zapis w bazie ma status `CONFIRMED`. Wygasły i nieznany token pokazują właściwe komunikaty.
4. Ponowny zapis tego samego adresu nie tworzy duplikatu, nie zdradza, że adres już jest na liście, i nie wysyła więcej niż jednego e-maila na 10 minut.
5. Błędy walidacji pokazują się przy polach, także te zwrócone przez backend.
6. Pod formularzem jest klauzula z danymi administratora z konfiguracji. Build z `LANDING_ENV=production` bez tych danych się nie udaje.
7. `./gradlew test`, `pnpm lint`, `pnpm typecheck`, `pnpm test` i `pnpm build` przechodzą lokalnie i w CI.
