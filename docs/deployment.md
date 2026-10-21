# Wdrożenie produkcyjne

Frontendy (`apps/web`, `apps/landing`) stoją na **Vercel**, backend, baza i geokoder na serwerze **Hetzner** zarządzanym przez **Coolify**. Pliki trzyma **Cloudflare R2**, e-maile wysyła zewnętrzny dostawca **SMTP**.

Docelowa domena: `spotonslot.com`.

| Adres | Co | Gdzie |
|---|---|---|
| `https://spotonslot.com` (+ `www`) | landing | Vercel, projekt `apps/landing` |
| `https://app.spotonslot.com` | aplikacja | Vercel, projekt `apps/web` |
| `https://api.spotonslot.com` | backend (REST + WebSocket `/ws`) | Coolify na Hetzner |
| `https://media.spotonslot.com` | zdjęcia | Cloudflare R2 (publiczna domena bucketu) |
| (brak) | PostgreSQL 16 + PostGIS, Photon | Coolify, tylko sieć wewnętrzna |

Aplikacja i API muszą być **subdomenami tej samej domeny**: ciasteczko odświeżania sesji (`sos_refresh`, `SameSite=Lax`) przeglądarka wysyła tylko w obrębie jednej witryny. Na adresach `*.vercel.app` (np. preview deploymenty) logowanie zadziała do wygaśnięcia access tokenu (15 min), a CORS ich nie wpuści, więc preview służą tylko do oglądania stron publicznych.

## Kolejność

1. Serwer Hetzner + Coolify
2. Cloudflare R2 (bucket, domena, CORS, klucze)
3. Dostawca SMTP (domena nadawcy, SPF/DKIM)
4. PostgreSQL w Coolify
5. Photon w Coolify (można odłożyć, patrz niżej)
6. Backend w Coolify
7. Vercel: web i landing
8. DNS i sprawdzenie

## 1. Serwer Hetzner + Coolify

- Serwer x86 z **Ubuntu 24.04**, co najmniej **8 GB RAM** i 80 GB dysku, lokalizacja w UE (Falkenstein, Norymberga lub Helsinki). Backend (JVM), Postgres i Photon (wbudowany OpenSearch) razem nie zmieszczą się wygodnie w 4 GB.
- Firewall w Hetzner Cloud: wejście tylko **22, 80, 443** (i 8000 do pierwszej konfiguracji Coolify, potem zamknij, gdy panel dostanie własną domenę, np. `coolify.spotonslot.com`).
- Instalacja Coolify według oficjalnej instrukcji (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`), potem konto admina w panelu i włączone 2FA.
- **Logi max 90 dni** (obiecane w polityce prywatności): Docker trzyma logi kontenerów w `/var/lib/docker/containers`. Sprawdź `/etc/docker/daemon.json`; jeśli nie ma tam rotacji, dodaj i zrestartuj Dockera:

  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "5" } }
  ```

  Rotacja po rozmiarze przy tym ruchu trzyma logi znacznie krócej niż 90 dni; nie wysyłaj ich do zewnętrznych usług bez aktualizacji polityki.
- Hetzner na nowych kontach blokuje wychodzące porty **25 i 465**, dlatego backend wysyła pocztę przez **587 + STARTTLS** (ustawione w `application-prod.yml`).

## 2. Cloudflare R2

1. Utwórz bucket `spotonslot-media` (lokalizacja: Europa / EU jurisdiction).
2. **Settings → Custom Domains**: podłącz `media.spotonslot.com` (domena musi być w Cloudflare DNS). Domeny `r2.dev` nie używaj na produkcji (limitowana).
3. **Settings → CORS Policy**, żeby przeglądarka mogła wgrywać zdjęcia bezpośrednio do bucketu:

   ```json
   [
     {
       "AllowedOrigins": ["https://app.spotonslot.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **R2 → Manage API tokens**: token typu *Object Read & Write* ograniczony do tego bucketu. Access Key ID i Secret trafiają do `MEDIA_ACCESS_KEY` / `MEDIA_SECRET_KEY`, endpoint `https://<account-id>.r2.cloudflarestorage.com` do `MEDIA_ENDPOINT`.

Ten sam R2 (osobny bucket, np. `spotonslot-backups`, z osobnym tokenem) nadaje się na kopie bazy z Coolify.

## 3. SMTP

Dowolny dostawca z SMTP na porcie 587 (np. Brevo, Postmark, Resend, Amazon SES). Zweryfikuj domenę nadawcy (`MAIL_FROM`, np. `no-reply@spotonslot.com`) i dodaj rekordy **SPF i DKIM** (oraz DMARC) w DNS, inaczej maile z linkami aktywacyjnymi wpadną do spamu.

## 4. PostgreSQL w Coolify

**New Resource → Database → PostgreSQL**, potem przed pierwszym startem w konfiguracji:

- **Image**: `postgis/postgis:16-3.5` (ten sam obraz co lokalnie; zwykły Postgres nie ma PostGIS i migracja `V1` się nie wykona)
- nazwa bazy `spotonslot`, użytkownik `spotonslot`, hasło wygenerowane przez Coolify
- **bez** "Make it publicly available"
- **Backups**: harmonogram codzienny + S3 Storage (bucket backupów z R2, dodany w *Settings → S3 Storages*). Raz sprawdź odtworzenie kopii.

Z karty bazy weź wewnętrzny host (nazwa kontenera) do `DB_URL` backendu: `jdbc:postgresql://<host>:5432/spotonslot`.

## 5. Photon (geokoder)

Publiczne `photon.komoot.io` jest tylko do developmentu. Własny Photon ma obraz w `deploy/photon`:

- **New Resource → Application → GitHub** (repo `FabianLew/spot-on-slot`, gałąź `main`), Build Pack **Dockerfile**, Base Directory `/deploy/photon`, Watch Paths `deploy/photon/**`.
- Bez domeny (tylko sieć wewnętrzna), port 2322.
- **Persistent Storage**: wolumen zamontowany w `/photon/data` (baza przetrwa redeploy).
- Zmienne: `PHOTON_DUMP_URL` = zrzut bazy dla Polski **zgodny z wersją Photona 1.0** ze strony <https://download1.graphhopper.com/public/> (wybierz plik `.tar.bz2` dla Polski w katalogu wersji 1.0); opcjonalnie `JAVA_OPTS` (domyślnie `-Xmx2g`).
- Pierwszy start pobiera i rozpakowuje zrzut, co trwa; healthcheck ma na to godzinę. Kolejne starty używają danych z wolumenu. Aktualizacja danych: usuń zawartość wolumenu i zrestartuj.

Na start (test, zamknięta beta) można pominąć ten krok i ustawić w backendzie `LOCATION_GEOCODER_URL=https://photon.komoot.io`; przy publicznym starcie przełącz na własny Photon.

## 6. Backend w Coolify

**New Resource → Application → GitHub** (najlepiej przez Coolify GitHub App, wtedy push do `main` sam wdraża):

- Build Pack **Dockerfile**, Base Directory `/apps/backend`, Dockerfile `/Dockerfile`
- Watch Paths `apps/backend/**` (zmiany frontu nie przebudowują backendu)
- Domena `https://api.spotonslot.com`, port **8080**. Proxy Coolify (Traefik) przepuszcza WebSocket (`/ws`) bez dodatkowej konfiguracji.
- Healthcheck: obraz ma własny (`/actuator/health`); możesz go też ustawić w Coolify na ścieżkę `/actuator/health`, port 8080.
- Limit pamięci w *Resource Limits* (np. 2 GB): JVM bierze 75% limitu kontenera.
- **Environment Variables → Developer view**: wklej `deploy/backend.env.example` i podmień `<...>`. Zmiennym z sekretami odznacz "Available at Buildtime" (build ich nie potrzebuje). `JWT_SECRET` wygeneruj u siebie: `openssl rand -base64 48`.

Flyway wykonuje migracje przy starcie, więc pierwszy deploy zakłada pustą bazę. Skryptu `pnpm seed:demo` nie uruchamiaj na produkcji (tworzy konta demo ze wspólnym hasłem).

Po scaleniu panelu moderacji (B13) dojdą `ADMIN_EMAIL` i `ADMIN_PASSWORD` dla pierwszego administratora.

## 7. Vercel

Dwa projekty z tego samego repo (**Add New → Project → Import** `FabianLew/spot-on-slot`):

| | web | landing |
|---|---|---|
| Root Directory | `apps/web` | `apps/landing` |
| Framework | Next.js | Next.js |
| Node.js Version | 22.x | 22.x |
| Domena | `app.spotonslot.com` | `spotonslot.com` + `www.spotonslot.com` (przekierowanie na główną) |

Install i build Vercel wykryje sam (pnpm z `pnpm-lock.yaml`, skrypt `build` aplikacji). Opcja "Include files outside of the Root Directory" musi zostać włączona (domyślnie jest), bo aplikacje biorą pakiety z `packages/*`. Gdyby instalacja użyła złej wersji pnpm, dodaj zmienną `ENABLE_EXPERIMENTAL_COREPACK=1` (wersja z `packageManager` w `package.json`).

Opcjonalnie, żeby commity tylko w backendzie nie budowały frontów: *Settings → Git → Ignored Build Step* = `npx turbo-ignore`.

**Zmienne web** (Production):

| Zmienna | Wartość |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.spotonslot.com` |
| `NEXT_PUBLIC_LANDING_URL` | `https://spotonslot.com` |
| `API_URL` | pomiń (na Vercel serwer i tak idzie publicznym adresem) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | pomiń, chyba że zmieniasz styl mapy (domyślnie OpenFreeMap) |

**Zmienne landing** (Production, wzór w `apps/landing/.env.example`):

| Zmienna | Wartość |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.spotonslot.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://spotonslot.com` |
| `NEXT_PUBLIC_PRIVACY_CONTROLLER` | administrator danych (firma / imię i nazwisko, adres) |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | e-mail kontaktowy administratora |
| `LANDING_ENV` | **zostaw puste** do czasu przeglądu regulaminu i polityki przez prawnika (do tego czasu strony prawne pokazują notkę "projekt") |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | po założeniu konta Umami; bez niej analityka się nie ładuje |

Zmienne `NEXT_PUBLIC_*` wchodzą do builda: po ich zmianie zrób redeploy.

## 8. DNS

| Rekord | Cel |
|---|---|
| `spotonslot.com` (A) i `www` (CNAME) | według instrukcji Vercel dla domeny |
| `app` (CNAME) | według instrukcji Vercel |
| `api` (A) | IP serwera Hetzner |
| `coolify` (A, opcjonalnie) | IP serwera Hetzner |
| `media` | ustawia Cloudflare przy podpięciu domeny do R2 |
| SPF / DKIM / DMARC | według dostawcy SMTP |

Jeśli DNS jest w Cloudflare: rekordy `api`, `coolify` i te dla Vercel ustaw jako **DNS only** (szara chmurka). Certyfikaty wystawiają wtedy Coolify (Let's Encrypt) i Vercel bez kombinacji.

## 9. Sprawdzenie po wdrożeniu

1. `https://api.spotonslot.com/actuator/health` zwraca `{"status":"UP"}`.
2. Landing: zapis na listę oczekujących, mail potwierdzający dochodzi, link otwiera landing.
3. Aplikacja: rejestracja, mail aktywacyjny z linkiem do `app.spotonslot.com`, logowanie, odświeżenie strony nie wylogowuje (ciasteczko działa).
4. Profil artysty: wgranie zdjęcia (R2 + CORS), zdjęcie ładuje się z `media.spotonslot.com`, wyszukanie miejscowości (geokoder), mapa w wyszukiwarce.
5. Dwa konta (artysta i lokal): wiadomość dochodzi na żywo bez odświeżania (WebSocket przez proxy).
6. Publiczny profil `/a/<slug>` otwiera się bez logowania.

## Później (B16)

Rate limiting, monitoring i alerty (np. Sentry, uptime check na `/actuator/health`), skalowanie poza jedną instancję (dziś licznik prób hasła, broker STOMP i limity są w pamięci jednej instancji, więc backend ma działać w **jednej** replice).
