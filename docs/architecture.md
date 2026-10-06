# Spot On Slot — propozycja narzędzi i architektury

Zaakceptowana 2026-10-04

## TL;DR

| Obszar | Rekomendacja |
|---|---|
| Repozytorium | Jeden monorepo `spot-on-slot` (pnpm workspaces + Turborepo dla TS, Gradle dla backendu), układ jak w ecommerce-flow |
| Backend | Java 21, Spring Boot 3.5, **monolit modułowy z Spring Modulith** (granice modułów sprawdzane testem) |
| Baza | PostgreSQL 16 + **PostGIS** (wyszukiwanie „w promieniu X km”), Flyway |
| API | REST + OpenAPI (springdoc) → generowany klient TS współdzielony przez web i mobile |
| Web client | Next.js 16 (React 19, TS), TanStack Query, Tailwind + shadcn/ui |
| Landing | Next.js 16 (SSG), osobna aplikacja, docelowo też publiczne profile artystów/lokali pod SEO |
| Mobile (faza 2) | **React Native + Expo** (EAS Build, expo-notifications, expo-location) |
| Pomost przed mobile | Web client jako PWA (instalacja na telefonie, web push) |
| Realtime | WebSocket (STOMP) w monolicie, do czatu i statusów bookingu |
| Powiadomienia | e-mail (Resend/Postmark), push przez Expo Push / FCM+APNs |
| Pliki | S3-kompatybilny storage (Cloudflare R2) |
| Hosting MVP | Backend + Postgres: VPS (Hetzner) z Docker Compose albo Railway; frontendy na Vercel |
| Jakość | JUnit 5, Testcontainers, Spring Modulith tests, Playwright (e2e web), Sentry |

## 1. Ocena Twojej propozycji (monolit modułowy, Spring + React)

**Zgadzam się, to właściwy wybór na MVP.** Powody:

- Jedna osoba / mały zespół: mikroserwisy dałyby koszt (deploy, sieć, spójność danych) bez korzyści.
- Domena jest mocno powiązana (profil → dostępność → ogłoszenie → booking → powiadomienie). Transakcje w jednej bazie są tu dużym ułatwieniem.
- Znasz ten stack z ecommerce-flow, więc możemy przenieść konwencje (struktura pakietów, JWT, Flyway, Testcontainers, workflow stories/prompts w `ai-development/`).

**Jedna zmiana względem ecommerce-flow: Spring Modulith.** W ecommerce-flow moduły są tylko konwencją pakietów, a w `build.gradle` widać wykluczone testy, które przestały się kompilować przez zależności między modułami (ai.tool, aicredits, recruitment). Spring Modulith:
- wymusza granice: moduł eksponuje tylko swój pakiet główny / `api`, reszta jest wewnętrzna, a test `ApplicationModules.verify()` wywala build przy naruszeniu;
- daje zdarzenia między modułami z rejestrem publikacji (zdarzenie nie ginie przy awarii), np. `BookingAccepted` → `availability` blokuje slot, `notification` wysyła push;
- generuje diagramy modułów do dokumentacji;
- ułatwia ewentualne wydzielenie modułu do osobnej usługi w przyszłości (już komunikuje się zdarzeniami).

**React: tak, ale jako Next.js** (tak jak w ecommerce-flow), bo:
- landing i publiczne profile artystów/klubów potrzebują SEO (ktoś googla „DJ techno Kraków”), a to jest główny kanał pozyskania użytkowników marketplace’u;
- jeden framework dla landingu i web clienta = mniej konfiguracji.

## 2. Aplikacja mobilna — rekomendacja: React Native + Expo

| Opcja | Plusy | Minusy | Werdykt |
|---|---|---|---|
| **React Native + Expo** | Ten sam TypeScript i React co web; współdzielimy klienta API, typy, walidację (zod), hooki TanStack Query; build iOS w chmurze bez Maca (EAS); aktualizacje OTA bez review sklepu; gotowe moduły: push, lokalizacja, kalendarz, mapy | UI piszemy osobno (inne komponenty niż web) | **Rekomendowane** |
| Flutter | Świetne UI, jedna baza kodu na iOS/Android | Dart: zero współdzielenia z web/React, nowy język | Nie |
| Natywnie (Kotlin + Swift) | Najlepsza wydajność i UX | Dwie osobne aplikacje, podwójny koszt | Nie na tym etapie |
| Kotlin Multiplatform / Compose MP | Kotlin blisko Javy z backendu | Brak współdzielenia z React, iOS wciąż mniej dojrzały, mniejszy ekosystem | Nie |
| Tylko PWA | Zero dodatkowego kodu | Słabsze push na iOS, brak obecności w App Store, gorszy dostęp do lokalizacji w tle | Jako pomost, nie cel |

Dlaczego to ważne w tym produkcie: wizja z brand booka („używana tak często jak Duolingo”, persona „zalatany, zajęty”) oznacza, że **powiadomienia push i szybka akcja z telefonu są rdzeniem produktu**. Dlatego:
1. MVP: web client responsywny + PWA (manifest, web push) — działa na telefonie od dnia 1.
2. Faza 2: Expo app, która korzysta z tych samych `packages/api-client` i `packages/shared`, więc backend nie wymaga zmian poza rejestracją tokenów push.

Wymóg, o którym warto pamiętać: jeśli w aplikacji iOS będzie logowanie przez Google, App Store wymaga też „Sign in with Apple”. Planujemy to w module auth od początku.

## 3. Struktura monorepo

```
spot-on-slot/
├── apps/
│   ├── backend/          # Spring Boot, monolit modułowy (Gradle)
│   ├── web/              # Next.js — aplikacja dla artystów, bookerów, lokali
│   ├── landing/          # Next.js — strona marketingowa + publiczne profile (SEO)
│   ├── admin/            # (później) panel admina, może być częścią web pod /admin
│   └── mobile/           # (faza 2) Expo / React Native
├── packages/
│   ├── api-client/       # generowany z OpenAPI (orval/openapi-typescript) + hooki TanStack Query
│   ├── shared/           # typy domenowe, schematy zod, stałe, i18n (PL/EN)
│   ├── ui/               # komponenty web (shadcn/ui)
│   └── design-tokens/    # kolory, typografia, spacing z brand booka → Tailwind (web) i RN (mobile)
├── docs/                 # architektura, ADR-y, moduły
├── ai-development/       # stories / prompts (jak w ecommerce-flow)
├── docker-compose.yml    # Postgres+PostGIS, Mailpit, S3Mock lokalnie
└── turbo.json
```

`design-tokens` to sposób, żeby identyfikacja wizualna z brand booka (gdy będzie gotowa) trafiła jednocześnie do web i mobile.

## 4. Moduły backendu

Pakiet bazowy np. `pl.spotonslot` (do ustalenia).

| Moduł | Odpowiedzialność (MVP) |
|---|---|
| `identity` | rejestracja, logowanie, JWT (access + refresh), role: ARTIST, BOOKER, VENUE, ADMIN; później Google/Apple |
| `artist` | profil artysty: imię, nazwisko, pseudonim, gatunki, linki (SoundCloud, Instagram, Spotify), media, stawki |
| `venue` | profil klubu/lokalu: nazwa, adres, pojemność, typ, zdjęcia, osoby zarządzające |
| `location` | geolokalizacja z urządzenia + ręczne ustawienie lokalizacji, geokodowanie adresów, zapytania PostGIS |
| `availability` | kalendarz dostępności artysty, sloty wolne/zajęte, strefy czasowe |
| `listing` | ogłoszenia: „jestem wolny” (artysta) oraz „szukam artysty na termin” (lokal) |
| `search` | wyszukiwanie po lokalizacji, terminie, gatunku; na start SQL + PostGIS, bez Elasticsearch |
| `booking` | zapytanie → oferta → akceptacja/odrzucenie → potwierdzone → zakończone; maszyna stanów |
| `messaging` | rozmowy między stronami (powiązane z bookingiem lub ogólne), WebSocket |
| `notification` | in-app, e-mail, push; preferencje użytkownika; reaguje na zdarzenia innych modułów |
| `waitlist` | publiczny zapis na listę oczekujących z podwójnym opt-in (potwierdzenie e-mailem), czyszczenie niepotwierdzonych zapisów |
| `media` | upload zdjęć/plików do R2, presigned URL |
| `shared` | wyjątki, paginacja, bezpieczeństwo, audyt |

Później: `review` (oceny po wydarzeniu), `payment` (Stripe Connect / Przelewy24, prowizja platformy), `subscription` (plany premium), `event` (rozszerzenie na całą branżę eventową), `admin`.

Przykładowy przepływ zdarzeń:
```
booking: BookingRequested ─► notification (push do artysty)
booking: BookingAccepted  ─► availability (blokada slotu), messaging (wątek), notification
listing: AvailabilityAnnounced ─► notification (lokale w promieniu X km, które obserwują gatunek)
```

Każdy moduł ma ten sam wewnętrzny układ: `api` (kontrolery, DTO), `application` (serwisy, use case’y), `domain` (encje, reguły), `infrastructure` (repozytoria, integracje); publiczny kontrakt dla innych modułów tylko przez interfejs/fasadę w pakiecie głównym i zdarzenia.

## 5. Kluczowe decyzje techniczne

- **Auth:** własny moduł na Spring Security + JWT (jak w ecommerce-flow), refresh token w httpOnly cookie dla web i w SecureStore dla mobile. Keycloak/Auth0 odrzucam na MVP: dodatkowa infrastruktura lub koszt bez wyraźnej korzyści.
- **Kontrakt API:** OpenAPI generowane z kodu, w CI generujemy `packages/api-client`; zmiana w backendzie od razu pokazuje błędy typów w web i mobile.
- **Kalendarz i czas:** wszystko w UTC w bazie (`timestamptz`), strefa czasowa użytkownika i lokalu zapisana osobno; web: FullCalendar; mobile: react-native-calendars.
- **Mapy:** MapLibre + OpenStreetMap (bez kosztów Google Maps na start; Fabian potwierdził 2026-10-05), geokodowanie przez Photon za interfejsem `Geocoder` w backendzie, więc dostawcę można wymienić w jednym miejscu.
- **i18n od pierwszego commita** (PL + EN), bo plan zakłada komercjalizację.
- **Fundament backendu (B0):** błędy (RFC 9457 problem+json), paginacja, `BaseEntity`, request ID, CORS i profile opisuje [specyfikacja B0](superpowers/specs/2026-10-04-b0-backend-foundation-design.md).
- **Szkielet aplikacji web (W0):** nawigację, i18n, motyw, klienta API, błędy i formularze opisuje [specyfikacja W0](superpowers/specs/2026-10-05-w0-web-shell-design.md).
- **Zdjęcia (B2):** wgrywanie przez podpisany link prosto do magazynu i rozmiary WebP opisuje [specyfikacja mediów](superpowers/specs/2026-10-05-b2-media-design.md).
- **Profil artysty (B4):** szkic do publikacji, publiczny profil pod `/a/{slug}` dla każdego z linkiem (Fabian wybrał 2026-10-06); szczegóły w [specyfikacji profilu artysty](superpowers/specs/2026-10-05-b4-artist-profile-design.md).
- **Profil lokalu (B5):** jedno konto może prowadzić kilka lokali (Fabian wybrał 2026-10-06), zespół z rolami właściciel i menedżer, zaproszenia e-mailem, publiczny profil pod `/v/{slug}` z dokładnym adresem; szczegóły w [specyfikacji profilu lokalu](superpowers/specs/2026-10-06-b5-venue-profile-design.md).
- **Lokalizacja (B3):** lokalizacja osoby zapisana tylko jako punkt przybliżony do około 1 km plus miejscowość, zapytania w promieniu przez PostGIS; szczegóły w [specyfikacji lokalizacji](superpowers/specs/2026-10-05-b3-location-design.md).
- **Konta (B1 + W1):** rejestracja, weryfikacja e-maila, logowanie, odświeżanie sesji i reset hasła opisuje [specyfikacja kont](superpowers/specs/2026-10-05-b1-w1-accounts-design.md).
- **Landing z listą oczekujących:** routing `/pl` + `/en`, formularz zapisu i potwierdzenie e-mailem opisuje [specyfikacja landingu](superpowers/specs/2026-10-05-landing-waitlist-design.md).
- **RODO:** zgoda na geolokalizację, przechowujemy przybliżoną lokalizację, eksport/usunięcie konta.

## 6. Infrastruktura i CI

- Lokalnie: `docker compose` (Postgres+PostGIS, S3Mock jako magazyn plików zamiast MinIO, który nie publikuje już darmowych obrazów, Mailpit). Backend wysyła e-maile przez SMTP: w dev do Mailpit (`localhost:1025`, UI `localhost:8025`), na produkcji do skonfigurowanego serwera SMTP.
- CI: GitHub Actions — build + testy backendu (Testcontainers), lint/typecheck/test frontów przez Turborepo, generowanie klienta API, Playwright e2e na PR.
- MVP prod: backend w kontenerze na Hetzner (Docker Compose + Caddy) lub Railway, zarządzany Postgres z PostGIS (np. Neon/Railway), frontendy na Vercel, R2 na pliki, Sentry na błędy.
- Mobile (faza 2): EAS Build + EAS Submit do sklepów, EAS Update do poprawek OTA.

### Zmienne środowiskowe backendu (prod)

Wartości domyślne dla dev są w `application.yml`; w profilu `prod` (`application-prod.yml`) wymagane są `MAIL_HOST`, `MAIL_FROM`, `LANDING_BASE_URL`, `WEB_BASE_URL`, `JWT_SECRET`, zmienne `MEDIA_*` i `LOCATION_GEOCODER_URL` (start bez nich się nie powiedzie).

| Zmienna | Znaczenie |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | połączenie z PostgreSQL |
| `CORS_ALLOWED_ORIGINS` | dozwolone originy frontendów |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | serwer SMTP |
| `MAIL_FROM` | adres nadawcy e-maili |
| `LANDING_BASE_URL` | publiczny adres landingu (linki potwierdzające) |
| `WEB_BASE_URL` | publiczny adres aplikacji webowej (linki aktywacji konta i resetu hasła) |
| `JWT_SECRET` | sekret podpisu access tokenów (HS256, min. 32 bajty) |
| `MEDIA_ENDPOINT`, `MEDIA_BUCKET` | adres API S3 magazynu (Cloudflare R2) i bucket na zdjęcia |
| `MEDIA_ACCESS_KEY`, `MEDIA_SECRET_KEY` | klucze dostępu do magazynu |
| `MEDIA_PUBLIC_BASE_URL` | publiczny adres, pod którym są serwowane rozmiary zdjęć (domena R2) |
| `MEDIA_PRESIGN_ENDPOINT`, `MEDIA_REGION` | opcjonalnie: inny adres w linkach do wgrywania, region podpisu (domyślnie `auto`) |
| `LOCATION_GEOCODER_URL` | adres instancji Photon (własnej lub płatnej); publiczna `photon.komoot.io` tylko w dev |

### Zmienne środowiskowe landingu (prod)

Build z `LANDING_ENV=production` przerywa się, jeśli brakuje którejkolwiek z poniższych (`apps/landing/next.config.ts`, wzór w `apps/landing/.env.example`).

| Zmienna | Znaczenie |
|---|---|
| `NEXT_PUBLIC_API_URL` | adres backendu (formularz zapisu i potwierdzenie) |
| `NEXT_PUBLIC_SITE_URL` | publiczny adres landingu (`metadataBase`, linki `hreflang`) |
| `NEXT_PUBLIC_PRIVACY_CONTROLLER` | administrator danych w klauzuli i stopce |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | e-mail kontaktowy administratora danych |

## 7. Fazy (propozycja)

1. **Fundament:** monorepo, backend skeleton z Modulith, CI, docker-compose, design tokens.
2. **Konta i profile:** identity, artist, venue, media, location.
3. **Dostępność i ogłoszenia:** availability, listing, search z mapą.
4. **Booking i kontakt:** booking (maszyna stanów), messaging, notification (e-mail + web push).
5. **Landing + publiczne profile, PWA** → start MVP.
6. **Mobile (Expo)**, później reviews, payments, subscription.

## 8. Decyzje (zaakceptowane 2026-10-04)

1. Mobile: React Native + Expo, w MVP web client jako PWA.
2. Web i landing: Next.js.
3. Jedno monorepo, backend w `apps/backend`.
4. Spring Modulith pilnuje granic modułów.
5. Nazwa repo `spot-on-slot`, pakiet `pl.spotonslot`.
