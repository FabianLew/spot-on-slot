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
4. Backend, baza i Photon w Coolify (jeden docker compose)
5. Vercel: web i landing
6. DNS i sprawdzenie

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

## 3. SMTP

Dowolny dostawca z SMTP na porcie 587 (np. Brevo, Postmark, Resend, Amazon SES). Zweryfikuj domenę nadawcy (`MAIL_FROM`, np. `no-reply@spotonslot.com`) i dodaj rekordy **SPF i DKIM** (oraz DMARC) w DNS, inaczej maile z linkami aktywacyjnymi wpadną do spamu.

## 4. Backend, baza i Photon w Coolify (docker compose)

Cały serwerowy stos jest w jednym pliku `deploy/docker-compose.yml`: `backend` (z `apps/backend/Dockerfile`), `postgres` (`postgis/postgis:16-3.5`, ten sam obraz co lokalnie) i `photon` (z `deploy/photon`). Baza i Photon nie mają domen ani portów na zewnątrz; backend łączy się z nimi po nazwach usług.

**New Resource → Application → GitHub** (najlepiej przez Coolify GitHub App, wtedy push do `main` sam wdraża):

- Build Pack **Docker Compose**, Base Directory `/`, Docker Compose Location `/deploy/docker-compose.yml`
- Watch Paths `apps/backend/**` i `deploy/**` (zmiany frontu nie przebudowują stosu)
- Domena tylko przy usłudze **backend**: `https://api.spotonslot.com:8080` (`:8080` mówi proxy, na który port kontenera kierować; adres publiczny zostaje bez portu). Proxy Coolify (Traefik) przepuszcza WebSocket (`/ws`) bez dodatkowej konfiguracji.
- **Environment Variables**: Coolify pokaże zmienne z pliku. Hasło bazy (`SERVICE_PASSWORD_POSTGRES`) i klucz JWT (`SERVICE_PASSWORD_64_JWT`) wygeneruje sam, nie wpisuj ich. Uzupełnij wymagane:

  | Zmienna | Wartość |
  |---|---|
  | `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD` | dane SMTP (port domyślnie 587) |
  | `MEDIA_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
  | `MEDIA_ACCESS_KEY`, `MEDIA_SECRET_KEY` | klucze tokenu R2 |
  | `PHOTON_DUMP_URL` | zrzut JSON dla Polski w wersji 1.0: `https://download1.graphhopper.com/public/europe/poland/photon-dump-poland-1.0-latest.jsonl.zst` (ok. 850 MB; gotowej bazy `.tar.bz2` dla samej Polski nie ma, planeta ma 63 GB) |

  Reszta ma domyślne wartości dla `spotonslot.com` (adresy, `MAIL_FROM=no-reply@spotonslot.com`, bucket `spotonslot-media`, geokoder `http://photon:2322`); nadpisz je tylko, gdy coś się zmieni. Opcjonalnie `MAIL_CONTACT` (kontakt w mailach o koncie) i `PHOTON_JAVA_OPTS` (domyślnie `-Xmx2g`). Zmiennym z sekretami odznacz "Available at Buildtime".

Pierwszy start Photona pobiera zrzut i importuje go do własnej bazy (to trwa, rzędu kwadransa do godziny; kolejne starty biorą dane z wolumenu `photon-data`, a aktualizacja danych to wyczyszczenie wolumenu i restart). Do tego czasu wyszukiwanie miejscowości zwraca błąd 503, reszta aplikacji działa. Na sam test można ustawić `LOCATION_GEOCODER_URL=https://photon.komoot.io` (tylko na chwilę, to publiczny serwer z limitem „fair use”), ale `PHOTON_DUMP_URL` i tak trzeba podać.

Flyway wykonuje migracje przy starcie backendu, więc pierwszy deploy zakłada pustą bazę. Skryptu `pnpm seed:demo` nie uruchamiaj na produkcji (tworzy konta demo ze wspólnym hasłem).

Po scaleniu panelu moderacji (B13) dojdą `ADMIN_EMAIL` i `ADMIN_PASSWORD` dla pierwszego administratora (trzeba je wtedy dopisać do `deploy/docker-compose.yml`).

### Kopie bazy

Baza z docker compose nie jest osobnym zasobem Coolify, więc jego zakładka *Backups* może jej nie obejmować (zależy od wersji Coolify; jeśli ją widzisz przy usłudze `postgres`, ustaw tam codzienny harmonogram i S3 Storage z R2). W przeciwnym razie:

- **Scheduled Tasks** zasobu: codziennie (`0 3 * * *`), kontener `postgres`, polecenie

  ```sh
  sh -c 'pg_dump -U spotonslot -Fc spotonslot > /backups/spotonslot-$(date +%F).dump && find /backups -name "*.dump" -mtime +14 -delete'
  ```

  (zrzuty z 14 dni w wolumenie `postgres-backups`).
- **Backups serwera w Hetzner Cloud** (płatna opcja, codzienne kopie całego dysku), żeby kopie były też poza samym serwerem.

Raz sprawdź odtworzenie: `pg_restore -U spotonslot -d <pusta_baza> /backups/<plik>.dump`.

## 5. Vercel

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

## 6. DNS

| Rekord | Cel |
|---|---|
| `spotonslot.com` (A) i `www` (CNAME) | według instrukcji Vercel dla domeny |
| `app` (CNAME) | według instrukcji Vercel |
| `api` (A) | IP serwera Hetzner |
| `coolify` (A, opcjonalnie) | IP serwera Hetzner |
| `media` | ustawia Cloudflare przy podpięciu domeny do R2 |
| SPF / DKIM / DMARC | według dostawcy SMTP |

Jeśli DNS jest w Cloudflare: rekordy `api`, `coolify` i te dla Vercel ustaw jako **DNS only** (szara chmurka). Certyfikaty wystawiają wtedy Coolify (Let's Encrypt) i Vercel bez kombinacji.

## 7. Sprawdzenie po wdrożeniu

1. `https://api.spotonslot.com/actuator/health` zwraca `{"status":"UP"}`.
2. Landing: zapis na listę oczekujących, mail potwierdzający dochodzi, link otwiera landing.
3. Aplikacja: rejestracja, mail aktywacyjny z linkiem do `app.spotonslot.com`, logowanie, odświeżenie strony nie wylogowuje (ciasteczko działa).
4. Profil artysty: wgranie zdjęcia (R2 + CORS), zdjęcie ładuje się z `media.spotonslot.com`, wyszukanie miejscowości (geokoder), mapa w wyszukiwarce.
5. Dwa konta (artysta i lokal): wiadomość dochodzi na żywo bez odświeżania (WebSocket przez proxy).
6. Publiczny profil `/a/<slug>` otwiera się bez logowania.

## Później (B16)

Rate limiting, monitoring i alerty (np. Sentry, uptime check na `/actuator/health`), skalowanie poza jedną instancję (dziś licznik prób hasła, broker STOMP i limity są w pamięci jednej instancji, więc backend ma działać w **jednej** replice).
