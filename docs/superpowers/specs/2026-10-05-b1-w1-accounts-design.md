# B1 + W1: konta (rejestracja, logowanie, weryfikacja e-maila, reset hasła)

Status: zaakceptowany przez Fabiana 2026-10-05. Etap według `architektura/segmenty-mvp.md`: B1 (moduł `identity`) i W1 (ekrany w `apps/web`). Design: styl arcade z D1, ekran wyboru roli z makiet.

## 1. Co użytkownik dostaje

1. **Rejestracja** w dwóch krokach: wybór roli na ekranie z makiet („Mam slot” = artysta, „Mam miejsce” = lokal), potem formularz: e-mail, hasło, powtórzenie hasła, akceptacja informacji o przetwarzaniu danych.
2. **Weryfikacja e-maila**: link w mailu, ważny 48 godzin, możliwość wysłania ponownie. Bez potwierdzenia nie da się zalogować (komunikat z przyciskiem „Wyślij link ponownie”).
3. **Logowanie** e-mailem i hasłem; po zalogowaniu powrót na stronę, z której przyszedł użytkownik, albo na pulpit.
4. **Reset hasła**: „Nie pamiętam hasła” → mail z linkiem ważnym 1 godzinę → nowe hasło. Reset wylogowuje wszystkie urządzenia.
5. **Wylogowanie** z menu użytkownika.
6. **Ochrona tras**: strony aplikacji wymagają zalogowania; strony kont są dostępne bez niego.

Poza zakresem: profil artysty i lokalu (B4/B5, W2–W4), logowanie Google/Apple, limity prób logowania (B16), zmiana e-maila i usunięcie konta (B14/W14), rola booker.

## 2. Role

- Przy rejestracji: `ARTIST` albo `VENUE` (Fabian wybrał 2026-10-05).
- `BOOKER` zostaje w enumie na później (B6/W5), `ADMIN` nadawany tylko ręcznie (B13).
- Jedno konto = jedna rola. Zmiana roli nie jest w MVP.

## 3. Backend (`identity`)

### Dane (migracja Flyway)
- `identity_user`: `email` (unikalny, zapisany małymi literami), `password_hash` (BCrypt, koszt 12, przez `DelegatingPasswordEncoder`), `role`, `status` (`PENDING_VERIFICATION`, `ACTIVE`, `BLOCKED`), `email_verified_at`, `locale`, `privacy_notice_accepted_at` + kolumny `BaseEntity`.
- `identity_token`: jednorazowe tokeny weryfikacji i resetu (`type`, `user_id`, `token_hash` SHA-256, `expires_at`, `used_at`). Surowy token tylko w mailu.
- `identity_refresh_token`: `user_id`, `token_hash`, `family_id`, `expires_at`, `revoked_at`, `replaced_by`.

### Tokeny
- **Access token**: JWT HS256 (Spring Security OAuth2 Resource Server + Nimbus), ważny 15 minut, claimy `sub` (id użytkownika), `role`, `iss`. Sekret z env `JWT_SECRET` (min. 32 bajty); w `dev`/`test` stały sekret z konfiguracji, w `prod` brak sekretu = aplikacja nie startuje.
- **Refresh token**: losowe 32 bajty w ciasteczku `sos_refresh` (`HttpOnly`, `Secure` poza dev, `SameSite=Lax`, `Path=/api/v1/auth`), ważny 30 dni. Każde odświeżenie wydaje nowy i unieważnia stary (rotacja). Użycie już zrotowanego tokenu unieważnia całą rodzinę (ochrona przed kradzieżą).
- Ciasteczko działa, bo web i API są pod tą samą domeną (lokalnie `localhost`, na produkcji np. `app.` i `api.` jednej domeny). CORS dostaje `allowCredentials`.

### Endpointy (`/api/v1/auth/...`, publiczne)
| Metoda | Ścieżka | Działanie |
|---|---|---|
| POST | `/register` | `{email, password, role, locale, privacyNoticeAccepted}` → zawsze `202`, bez ujawniania, czy e-mail istnieje (istniejący dostaje mail „masz już konto” z linkiem do logowania i resetu) |
| POST | `/verify-email` | `{token}` → konto `ACTIVE` |
| POST | `/verify-email/resend` | `{email}` → zawsze `202` |
| POST | `/login` | `{email, password}` → `{accessToken, expiresIn}` + ciasteczko |
| POST | `/refresh` | ciasteczko → nowy access token + nowe ciasteczko |
| POST | `/logout` | unieważnia bieżący refresh token, czyści ciasteczko |
| POST | `/password-reset` | `{email}` → zawsze `202` |
| POST | `/password-reset/confirm` | `{token, password}` → nowe hasło, wszystkie refresh tokeny unieważnione |

Chroniony: `GET /api/v1/me` → `{id, email, role, locale}`.

### Reguły
- Hasło: 10–128 znaków, bez wymogów typu „cyfra i znak specjalny” (zalecenie NIST); nie może być równe e-mailowi.
- Błędne logowanie: jeden komunikat dla złego e-maila i złego hasła (`IDENTITY_INVALID_CREDENTIALS`, 401). Inne kody: `IDENTITY_EMAIL_NOT_VERIFIED` (403), `IDENTITY_ACCOUNT_BLOCKED` (403), `IDENTITY_TOKEN_INVALID` (400, zły lub wygasły link), `IDENTITY_REFRESH_INVALID` (401). Teksty PL/EN w `messages_*.properties`.
- Wyścig przy rejestracji tego samego e-maila: `DataIntegrityViolationException` → ta sama odpowiedź `202`.
- Niepotwierdzone konta usuwane po 7 dniach (jak lista oczekujących).

### Zdarzenia i maile
- `identity` publikuje `EmailVerificationRequested`, `AccountAlreadyExists`, `PasswordResetRequested` (z surowym tokenem, jak `WaitlistConfirmationRequested`) i `UserRegistered(userId, role)` pod przyszłe moduły `artist`/`venue`.
- `notification` wysyła maile PL/EN przez ten sam mechanizm co lista oczekujących. Linki: `WEB_BASE_URL` (nowa zmienna env, lokalnie `http://localhost:3000`).

## 4. Web (`apps/web`)

### Ekrany (poza powłoką aplikacji, styl arcade, PL/EN)
- `/register`: krok 1 to ekran wyboru roli z makiety (przenoszę go z `/design/role`), krok 2 formularz. Po wysłaniu ekran „Sprawdź skrzynkę”.
- `/verify-email?token=…`: potwierdza automatycznie, potem „Konto aktywne, zaloguj się”; przy złym linku formularz ponownej wysyłki.
- `/login`, `/forgot-password`, `/reset-password?token=…`.
- Pod formularzem rejestracji krótka klauzula informacyjna (administrator danych, cel, kontakt), tak jak na landingu. Regulamin i polityka prywatności to osobne dokumenty z etapu L3; gdy powstaną, dojdzie do nich checkbox z linkami.

### Sesja
- Access token tylko w pamięci przeglądarki (nie w `localStorage`). Przy starcie aplikacja woła `/auth/refresh`; jeśli się uda, pobiera `/me`.
- `@spot-on-slot/api-client` dostaje middleware: dokleja `Authorization: Bearer`, przy 401 raz odświeża token (jedno odświeżenie naraz dla wszystkich zapytań) i powtarza zapytanie; zapytania do `/auth/*` idą z `credentials: "include"`.
- Ochrona tras po stronie klienta: `AuthGate` w layoucie `(app)` pokazuje ekran ładowania, a bez sesji przekierowuje na `/login?next=…`. Ochrona po stronie serwera Next nie jest możliwa, bo ciasteczko należy do domeny API; dane i tak są pobierane po stronie klienta, więc nic nie wycieka.
- Wylogowanie: pozycja w menu użytkownika i w arkuszu „Więcej”.
- Formularze: `Form` + zod z kluczami `validation.*`, błędy z backendu przez `applyServerErrors`.

## 5. Testy

- Backend: testy integracyjne (`@IntegrationTest`, Testcontainers) dla każdego endpointu i ścieżek błędów, rotacja i wykrycie ponownego użycia refresh tokenu, wygasanie tokenów (sterowany `Clock`), maile w testach przez przechwycenie zdarzeń; `ModularityTest` zielony.
- Web: Vitest + Testing Library dla formularzy, `AuthGate` i middleware odświeżania w `api-client`.
- `pnpm api:generate` po zmianach API, `schema.d.ts` w commicie.

## 6. Decyzje domyślne (do zmiany jednym słowem)

1. Logowanie zablokowane do potwierdzenia e-maila.
2. Access 15 min, refresh 30 dni z rotacją.
3. Ochrona tras po stronie klienta.
4. Limity prób logowania dopiero w B16 (wpisane na listę wdrożeniową).
