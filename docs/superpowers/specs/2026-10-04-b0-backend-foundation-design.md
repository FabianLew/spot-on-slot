# B0: fundament backendu (design)

Data: 2026-10-04 · Status: do przeglądu · Segment: B0 z `docs/architecture.md`

## Cel

Dać każdemu modułowi z fazy 2 (identity, artist, venue, location, media) gotowe, przetestowane elementy wspólne, żeby nie wymyślał ich sam: jeden format błędów, komunikaty PL/EN, paginację, bazową encję z audytem, request ID w logach, CORS i profile środowisk oraz konwencje testów.

Sukces: moduł fazy 2 tworzy encję, endpoint z listą i własny błąd biznesowy, używając tylko elementów z `pl.spotonslot.shared`, a klient web/mobile dostaje błędy w jednym, otypowanym formacie.

## Decyzje (z brainstormingu)

- Zakres: standardowy (bez JWT, rate limitingu, Sentry i tracingu).
- Format błędów: RFC 9457 (`ProblemDetail`).
- Identyfikatory encji: UUID v7 nadawane w aplikacji.

## Poza zakresem

JWT i uwierzytelnianie (B1), rate limiting i Sentry (B16), rozproszony tracing (Micrometer Tracing), storage plików (B2), jakiekolwiek endpointy biznesowe.

## Lokalizacja

Wszystko w otwartym module `pl.spotonslot.shared`, podzielone na pakiety: `error`, `i18n`, `paging`, `persistence`, `web` (request ID, CORS), `security`, `system`. Obecne `shared/web/ApiError`, `GlobalExceptionHandler` i `NotFoundException` zostają zastąpione.

## 1. Błędy (RFC 9457)

**Format odpowiedzi.** Content-Type `application/problem+json`. Pola standardowe: `type` (`about:blank`), `title`, `status`, `detail`, `instance` (ścieżka żądania). Pola rozszerzeń:
- `code`: stabilny kod błędu w UPPER_SNAKE_CASE, np. `VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_ERROR`, oraz kody modułów, np. `BOOKING_SLOT_TAKEN`.
- `requestId`: identyfikator żądania (sekcja 5).
- `errors`: tylko przy walidacji; lista obiektów `{ field, code, message }`, gdzie `code` to nazwa ograniczenia (`NotBlank`, `Size`, `Email`…), a `message` to przetłumaczony komunikat.

Przykład:
```json
{
  "type": "about:blank",
  "title": "Nieprawidłowe dane",
  "status": 400,
  "detail": "Żądanie zawiera nieprawidłowe pola.",
  "instance": "/api/v1/artists",
  "code": "VALIDATION_FAILED",
  "requestId": "4f1c2a9e-…",
  "errors": [{ "field": "nickname", "code": "NotBlank", "message": "nie może być puste" }]
}
```

**Wyjątki domenowe.** Abstrakcyjny `DomainException extends RuntimeException` z `String code()`, `HttpStatus status()` i argumentami komunikatu. Gotowe podklasy:
- `NotFoundException` → 404, domyślny kod `NOT_FOUND`
- `ConflictException` → 409, domyślny kod `CONFLICT`
- `BusinessRuleException` → 422, kod podawany przez moduł
- `InvalidRequestException` → 400, kod podawany przez wywołującego (np. `INVALID_SORT`)

Każda podklasa przyjmuje opcjonalnie własny kod (np. `new NotFoundException("ARTIST_NOT_FOUND", artistId)`).

**Handler.** `ProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler` (`@RestControllerAdvice`):
- obsługuje wbudowane wyjątki Springa (404 braku handlera, 405, 415, nieczytelne JSON → 400 `MALFORMED_REQUEST`) przez mechanizm bazowej klasy i dokłada `code` + `requestId`;
- `MethodArgumentNotValidException` i `HandlerMethodValidationException` → 400 `VALIDATION_FAILED` z `errors`;
- `DomainException` → status i kod z wyjątku;
- `ObjectOptimisticLockingFailureException` → 409 `CONCURRENT_MODIFICATION`;
- każdy inny wyjątek → 500 `INTERNAL_ERROR`, bez szczegółów w odpowiedzi, z pełnym logiem na poziomie ERROR.

Ustawiamy `spring.mvc.problemdetails.enabled: true` oraz `server.error.whitelabel.enabled: false`.

**Spring Security.** `AuthenticationEntryPoint` i `AccessDeniedHandler` delegują do `HandlerExceptionResolver`, więc 401 (`UNAUTHORIZED`) i 403 (`FORBIDDEN`) mają ten sam format.

**OpenAPI.** Customizer springdoc rejestruje schemat `ProblemDetail` (z polami rozszerzeń) i dokłada do każdej operacji odpowiedzi `400`, `401`, `403`, `404`, `500` z `application/problem+json`, żeby `packages/api-client` miał otypowane błędy.

## 2. Komunikaty PL/EN

- `MessageSource` z plików `messages_pl.properties` i `messages_en.properties` (UTF-8), klucze: `error.<CODE>.title` i `error.<CODE>.detail` (detail może mieć argumenty `{0}`).
- Brak tłumaczenia dla kodu modułu → `title` i `detail` z kodu ogólnego dla danego statusu (np. `error.NOT_FOUND.*`), bez wyjątku.
- Język: `AcceptHeaderLocaleResolver`, obsługiwane `pl` i `en`, domyślnie `pl`. Nieobsługiwany język → `pl`.
- Komunikaty walidacji Bean Validation tłumaczone w tym samym języku.

## 3. Paginacja

- `PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages)` ze statyczną fabryką `from(Page<?> page, List<T> content)` oraz `from(Page<T> page)`.
- `PageQuery(Integer page, Integer size, String sort)` wiązany z parametrami zapytania; numeracja od 0; domyślnie `page=0`, `size=20`; `size` max 100; `sort` w formacie `pole,asc|desc`.
- `PageQuery.toPageable(Set<String> allowedSortFields, Sort defaultSort)`: pole spoza listy → 400 `INVALID_SORT`; `page < 0`, `size < 1` lub `size > 100` → 400 `VALIDATION_FAILED`.

## 4. Bazowa encja

`@MappedSuperclass BaseEntity` z `@EntityListeners(AuditingEntityListener.class)`:
- `UUID id`: nadawany w konstruktorze przez `UuidV7.generate()`, kolumna `uuid`, niezmienny.
- `Instant createdAt` (`@CreatedDate`, niezmienny), `Instant updatedAt` (`@LastModifiedDate`), kolumny `timestamptz`.
- `Long version` (`@Version`): `null` dla nowej encji, dzięki czemu Spring Data poprawnie rozpoznaje nowe rekordy mimo przypisanego id.
- `equals`/`hashCode` po `id` i klasie (z obsługą proxy Hibernate).

`UuidV7`: własna klasa (RFC 9562), bez nowej biblioteki: 48 bitów czasu w ms, wersja 7, wariant RFC, reszta losowa z `SecureRandom`; identyfikatory generowane w tej samej milisekundzie są rosnące (licznik w bitach `rand_a`).

`@EnableJpaAuditing` z `DateTimeProvider` opartym na beanie `Clock` (UTC), żeby testy mogły ustawić czas.

Konwencja migracji dla tabel encji: `id uuid primary key, created_at timestamptz not null, updated_at timestamptz not null, version bigint not null`.

## 5. Request ID

- `RequestIdFilter` (`OncePerRequestFilter`, najwyższy priorytet): bierze `X-Request-Id` z żądania, jeśli pasuje do `^[A-Za-z0-9._-]{1,64}$`; w przeciwnym razie generuje UUID.
- Wstawia go do MDC pod kluczem `requestId` (czyszczonym po żądaniu), dodaje nagłówek `X-Request-Id` do odpowiedzi i udostępnia handlerowi błędów.
- Wzorzec logów w konsoli zawiera `[%X{requestId:-}]`; w logach JSON (prod) MDC trafia automatycznie.

## 6. CORS i profile

**CORS.** `spotonslot.cors.allowed-origins` (lista), metody `GET, POST, PUT, PATCH, DELETE, OPTIONS`, dowolne nagłówki żądania, eksponowany `X-Request-Id`, `allowCredentials: true` (pod refresh token w cookie w B1), `maxAge` 1 h. Bez skonfigurowanych domen żądania cross-origin są odrzucane.

**Profile.**
- `application.yml`: wspólne ustawienia.
- `dev` (domyślny przy `bootRun`, `spring.profiles.default: dev`): docker-compose, Swagger, CORS dla `http://localhost:3000` i `http://localhost:3001`, czytelne logi.
- `prod`: logi strukturalne JSON (`logging.structured.format.console: ecs`), Swagger i `/v3/api-docs` wyłączone, CORS z `CORS_ALLOWED_ORIGINS`. Dockerfile ustawia `SPRING_PROFILES_ACTIVE=prod`.
- `test`: Testcontainers, dodatkowa lokalizacja migracji testowych `classpath:db/testmigration`.

## 7. Konwencje testów

- `@IntegrationTest`: meta-adnotacja (`@SpringBootTest`, `@AutoConfigureMockMvc`, `@ActiveProfiles("test")`, import konfiguracji Testcontainers). Jeden kontener PostGIS na kontekst, współdzielony dzięki cache kontekstu.
- Testy kontrolerów jako `@WebMvcTest` tam, gdzie nie potrzeba bazy; testy modułów przez `@ApplicationModuleTest`.
- Funkcje `shared` testowane przez testowy kontroler i testową encję w `src/test` (tabela z `db/testmigration`), bez dokładania kodu produkcyjnego tylko dla testów. Testowe kontrolery mają `@Hidden`, żeby nie trafiły do specu OpenAPI i `schema.d.ts`.
- `ModularityTest` dalej musi przechodzić.
- Opis konwencji trafia do `CLAUDE.md`.

## Kryteria akceptacji

1. Nieistniejący endpoint, zły JSON, zła metoda, brak uprawnień, walidacja, `NotFoundException`, konflikt wersji i nieoczekiwany wyjątek zwracają `application/problem+json` z poprawnym `status`, `code` i `requestId`.
2. Ten sam błąd zwraca polski tekst bez nagłówka lub z `Accept-Language: pl` i angielski z `Accept-Language: en`.
3. `PageQuery` odrzuca niedozwolone sortowanie i rozmiar strony > 100; `PageResponse` ma podane pola.
4. Zapis testowej encji nadaje UUID v7, `createdAt`, `updatedAt` i `version = 0`; aktualizacja zmienia `updatedAt` i `version`; równoległa aktualizacja kończy się 409.
5. `UuidV7` generuje poprawną wersję i wariant, a 10 000 kolejnych id jest unikalnych i rosnących.
6. Każda odpowiedź ma nagłówek `X-Request-Id`; poprawny przychodzący jest zachowany, niepoprawny zastąpiony.
7. Żądanie preflight z dozwolonej domeny dostaje nagłówki CORS, z niedozwolonej nie.
8. Spec OpenAPI zawiera schemat `ProblemDetail`, a wygenerowany `schema.d.ts` go typuje.
9. `./gradlew test` przechodzi, łącznie z `ModularityTest`; CI zielone.
