# B0 Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared, tested building blocks in `pl.spotonslot.shared` (RFC 9457 errors, PL/EN messages, paging, audited base entity with UUID v7, request ID, CORS, profiles, test conventions) for every phase 2 module.

**Architecture:** Everything lives in the open Spring Modulith module `pl.spotonslot.shared`, split into packages `error`, `i18n`, `paging`, `persistence`, `web`, `security`, `system`. Behaviour is exercised through `@Hidden` test controllers and a test entity in `src/test`, never through production-only test code.

**Tech Stack:** Java 21, Spring Boot 3.5.16, Spring Modulith 1.4.13, Hibernate 6.6, springdoc 2.8.17, PostgreSQL 16 + PostGIS (Testcontainers), JUnit 5, MockMvc, AssertJ.

**Spec:** `docs/superpowers/specs/2026-10-04-b0-backend-foundation-design.md`

## Global Constraints

- All backend paths below are relative to `apps/backend/`. Base package `pl.spotonslot`; new code only in `pl.spotonslot.shared.*`.
- Error responses: `application/problem+json`, `type` = `about:blank`, `instance` = request path, extension properties exactly `code`, `requestId`, `errors` (validation only, items `{field, code, message}`).
- Error codes (UPPER_SNAKE_CASE): `VALIDATION_FAILED` 400, `MALFORMED_REQUEST` 400, `INVALID_SORT` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `METHOD_NOT_ALLOWED` 405, `CONFLICT` 409, `CONCURRENT_MODIFICATION` 409, `UNSUPPORTED_MEDIA_TYPE` 415, `BUSINESS_RULE_VIOLATED` 422, `INTERNAL_ERROR` 500.
- Message keys `error.<CODE>.title` / `error.<CODE>.detail`; files `messages_pl.properties`, `messages_en.properties` (UTF-8); locales `pl`, `en`; default and fallback `pl`.
- Paging: 0-based `page`, default `size` 20, max 100, `sort` = `field,asc|desc`.
- Request ID: header `X-Request-Id`, accepted pattern `^[A-Za-z0-9._-]{1,64}$`, MDC key `requestId`.
- CORS property `spotonslot.cors.allowed-origins`; methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`; exposed header `X-Request-Id`; credentials allowed; max age 3600 s.
- Test-only controllers carry `@io.swagger.v3.oas.annotations.Hidden`.
- No new runtime dependencies.
- Every task ends with `./gradlew test` green, including `ModularityTest`.

## Review Focus

1. **Error thrown inside the security filter chain (401/403) loses `requestId`** — `RequestIdFilter` must run before Spring Security; Task 5 test asserts `requestId` on a 401.
2. **`Accept-Language` with an unsupported or malformed value (`de`, `*`, `xx-YY;q=abc`)** — must fall back to Polish, never 500; Task 3 test covers `de` and `*`.
3. **Module-specific code with no translation (`ARTIST_NOT_FOUND`)** — must fall back to the generic text for its status, not show a raw key; Task 3 test.
4. **`sort` with no direction (`nickname`) or garbage (`,desc`, `a,b,c`)** — `nickname` means ascending; garbage gives 400 `INVALID_SORT`; Task 7 tests.
5. **Unexpected exception message leaking internals (SQL, stack trace)** — 500 must carry only the generic detail; Task 4 test asserts the exception message is absent from the body.

---

### Task 1: Test conventions (`@IntegrationTest`, test profile, test migrations)

**Files:**
- Create: `src/test/java/pl/spotonslot/support/IntegrationTest.java`
- Create: `src/test/resources/application-test.yml`
- Create: `src/test/resources/db/testmigration/V9000__test_tables.sql`
- Modify: `src/test/java/pl/spotonslot/SpotOnSlotApplicationTests.java` (use `@IntegrationTest`)
- Modify: `src/test/java/pl/spotonslot/TestcontainersConfiguration.java` → move to `pl.spotonslot.support`

**Interfaces:**
- Produces: `@IntegrationTest` (type annotation = `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")` + `@Import(TestcontainersConfiguration.class)`); table `test_note(id uuid primary key, title varchar(200) not null, created_at timestamptz not null, updated_at timestamptz not null, version bigint not null)`.

- [ ] **Step 1:** Change `SpotOnSlotApplicationTests` to `@IntegrationTest` and add test `appliesTestMigrations()` asserting `SELECT count(*) FROM test_note` returns 0.
- [ ] **Step 2:** Run `./gradlew test --tests '*SpotOnSlotApplicationTests'` → FAIL (annotation missing).
- [ ] **Step 3:** Create the annotation, move `TestcontainersConfiguration`, add `application-test.yml` with `spring.flyway.locations: classpath:db/migration,classpath:db/testmigration`, create the migration.
- [ ] **Step 4:** Run `./gradlew test` → PASS.
- [ ] **Step 5:** Commit `test: add IntegrationTest convention and test migrations`.

### Task 2: `UuidV7`

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/persistence/UuidV7.java`
- Test: `src/test/java/pl/spotonslot/shared/persistence/UuidV7Test.java`

**Interfaces:**
- Produces: `public final class UuidV7 { public static UUID generate(); }`

- [ ] **Step 1: Write failing tests**
  - `hasVersion7AndRfcVariant()`: `generate().version() == 7`, `variant() == 2`.
  - `embedsCurrentTimestamp()`: `uuid.getMostSignificantBits() >>> 16` is within `[before, after]` of `System.currentTimeMillis()` taken around the call.
  - `isUniqueAndMonotonic()`: 10 000 consecutive ids are distinct and each `compareTo` of its predecessor as unsigned 128-bit (compare `toString()` lexicographically) is > 0.
- [ ] **Step 2:** Run `./gradlew test --tests '*UuidV7Test'` → FAIL (class missing).
- [ ] **Step 3:** Implement per RFC 9562: 48-bit ms timestamp, version nibble 7, 12-bit `rand_a` used as a counter that increments within the same millisecond (on overflow, advance the timestamp by 1 ms), 62 random bits from a static `SecureRandom`; `synchronized` generate.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(shared): add UUID v7 generator`.

### Task 3: Error messages PL/EN

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/i18n/LocaleConfig.java`
- Create: `src/main/java/pl/spotonslot/shared/error/ErrorMessages.java`
- Create: `src/main/resources/messages_pl.properties`, `src/main/resources/messages_en.properties`
- Modify: `src/main/resources/application.yml` (`spring.messages.basename: messages`, `encoding: UTF-8`, `fallback-to-system-locale: false`)
- Test: `src/test/java/pl/spotonslot/shared/error/ErrorMessagesTest.java` (`@IntegrationTest`)

**Interfaces:**
- Produces: `LocaleResolver` bean = `AcceptHeaderLocaleResolver` with supported `[pl, en]`, default `pl`.
- Produces: `@Component ErrorMessages { ErrorText resolve(String code, HttpStatus status, Object[] args, Locale locale); }` with `public record ErrorText(String title, String detail)` nested in `ErrorMessages`.
- Fallback chain: `error.<code>.*` → generic code for the status → never a raw key. Generic codes: 400 `VALIDATION_FAILED`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 409 `CONFLICT`, 415 `UNSUPPORTED_MEDIA_TYPE`, 422 `BUSINESS_RULE_VIOLATED`, any other status `INTERNAL_ERROR`.

- [ ] **Step 1: Write failing tests**
  - `resolvesPolishByDefault()`: `resolve("NOT_FOUND", NOT_FOUND, [], pl).title()` equals `"Nie znaleziono"`.
  - `resolvesEnglish()`: same with `en` → `"Not found"`.
  - `fallsBackToGenericForUnknownModuleCode()`: `resolve("ARTIST_NOT_FOUND", NOT_FOUND, [], pl)` equals the `NOT_FOUND` text.
  - `fallsBackToPolishForUnsupportedLocale()`: `Locale.GERMAN` → Polish text.
  - `localeResolverHandlesWildcardAndUnsupported()`: `MockHttpServletRequest` with `Accept-Language: *` and `de` resolve to `pl`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; write title + detail for every code in Global Constraints in both files (Polish e.g. `VALIDATION_FAILED` → "Nieprawidłowe dane" / "Żądanie zawiera nieprawidłowe pola.", `NOT_FOUND` → "Nie znaleziono" / "Szukany zasób nie istnieje.", `INTERNAL_ERROR` → "Błąd serwera" / "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.").
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(shared): add PL/EN error messages and locale resolution`.

### Task 4: RFC 9457 errors (domain exceptions + handler)

**Files:**
- Create in `src/main/java/pl/spotonslot/shared/error/`: `DomainException.java`, `NotFoundException.java`, `ConflictException.java`, `BusinessRuleException.java`, `InvalidRequestException.java`, `ProblemDetailsExceptionHandler.java`, `ProblemDetails.java`
- Delete: `src/main/java/pl/spotonslot/shared/web/ApiError.java`, `GlobalExceptionHandler.java`, `NotFoundException.java`
- Modify: `application.yml` (`spring.mvc.problemdetails.enabled: true`, `server.error.whitelabel.enabled: false`)
- Test: `src/test/java/pl/spotonslot/shared/error/ErrorTestController.java` (`@Hidden`, `@RestController`, `/test/errors/**`), `ProblemDetailsIntegrationTest.java` (`@IntegrationTest`, `@WithMockUser`)

**Interfaces:**
- Consumes: `ErrorMessages.resolve(...)` (Task 3), MDC key `requestId` (Task 5 fills it; until then `requestId` may be null and the test for it lives in Task 5).
- Produces:
  - `public abstract class DomainException extends RuntimeException { protected DomainException(String code, HttpStatus status, Object... detailArgs); String code(); HttpStatus status(); Object[] detailArgs(); }`
  - `NotFoundException()` / `NotFoundException(String code, Object... detailArgs)` → 404 default `NOT_FOUND`; same shape for `ConflictException` (409 `CONFLICT`); `BusinessRuleException(String code, Object... detailArgs)` → 422; `InvalidRequestException(String code, Object... detailArgs)` → 400.
  - `final class ProblemDetails { static ProblemDetail of(HttpStatus status, String code, ErrorText text, HttpServletRequest request); }` sets title, detail, instance, `code`, `requestId` (from MDC).
  - `ProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler` overriding `handleExceptionInternal` to rewrite every built-in body via `ProblemDetails.of` with the status' generic code (`HttpMessageNotReadableException` → `MALFORMED_REQUEST`).
- `ErrorTestController` endpoints: `GET /test/errors/not-found` (throws `new NotFoundException("ARTIST_NOT_FOUND", "x")`), `GET /test/errors/business` (`BusinessRuleException("BOOKING_SLOT_TAKEN")`), `GET /test/errors/optimistic` (`ObjectOptimisticLockingFailureException(Object.class, "id")`), `GET /test/errors/boom` (`IllegalStateException("SELECT secret FROM users")`), `POST /test/errors/validated` with body record `{ @NotBlank String nickname; @Size(max=5) String city }`.

- [ ] **Step 1: Write failing tests** (all assert content type `application/problem+json`, `$.status`, `$.code`, `$.instance`):
  - `notFound` → 404 `ARTIST_NOT_FOUND`, `$.title` "Nie znaleziono".
  - `notFoundInEnglish` (`Accept-Language: en`) → `$.title` "Not found".
  - `businessRule` → 422 `BOOKING_SLOT_TAKEN`.
  - `optimisticLock` → 409 `CONCURRENT_MODIFICATION`.
  - `unexpected` → 500 `INTERNAL_ERROR`, body string does not contain `"secret"`.
  - `validation` (`{"nickname":"","city":"Warszawa"}`) → 400 `VALIDATION_FAILED`, `$.errors[*].field` contains `nickname` and `city`, `$.errors[?(@.field=='nickname')].code` = `NotBlank`.
  - `malformedJson` (`{"nickname":`) → 400 `MALFORMED_REQUEST`.
  - `unknownPath` (`GET /api/v1/does-not-exist`) → 404 `NOT_FOUND`.
  - `wrongMethod` (`DELETE /test/errors/not-found`) → 405 `METHOD_NOT_ALLOWED`.
  - `unsupportedMediaType` (`POST /test/errors/validated` as `text/plain`) → 415 `UNSUPPORTED_MEDIA_TYPE`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; log 5xx at ERROR with the exception, 4xx at DEBUG. Field error message via `MessageSource` with the request locale; `code` = `FieldError.getCode()`.
- [ ] **Step 4:** Run `./gradlew test` → PASS.
- [ ] **Step 5:** Commit `feat(shared): RFC 9457 problem details for all errors`.

### Task 5: Request ID + security errors

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/web/RequestIdFilter.java`
- Create: `src/main/java/pl/spotonslot/shared/security/ProblemDetailsAuthenticationEntryPoint.java`, `ProblemDetailsAccessDeniedHandler.java`
- Modify: `src/main/java/pl/spotonslot/shared/security/SecurityConfig.java` (use the two handlers instead of `HttpStatusEntryPoint`)
- Modify: `src/main/java/pl/spotonslot/shared/error/ProblemDetailsExceptionHandler.java` (add `AuthenticationException` → 401 `UNAUTHORIZED`, `AccessDeniedException` → 403 `FORBIDDEN`)
- Modify: `application.yml` (`logging.pattern.level: "%5p [%X{requestId:-}]"`)
- Test: `src/test/java/pl/spotonslot/shared/web/RequestIdIntegrationTest.java`, extend `ErrorTestController` with `GET /test/errors/admin-only` (`@PreAuthorize("hasRole('ADMIN')")`, enable method security in `SecurityConfig`)

**Interfaces:**
- Produces: `RequestIdFilter` with `public static final String HEADER = "X-Request-Id"`, `MDC_KEY = "requestId"`; `@Order(Ordered.HIGHEST_PRECEDENCE)`.
- Entry point and access-denied handler delegate to the `handlerExceptionResolver` bean, where the extended handler maps `AuthenticationException` → 401 `UNAUTHORIZED`, `AccessDeniedException` → 403 `FORBIDDEN`.

- [ ] **Step 1: Write failing tests**
  - `generatesRequestIdWhenMissing`: `GET /api/v1/system/info` → header `X-Request-Id` matches UUID regex.
  - `keepsValidIncomingRequestId`: send `abc-123` → same header back.
  - `replacesInvalidIncomingRequestId`: send `bad id!` (and a 65-char value) → header is a UUID.
  - `unauthorizedIsProblemWithRequestId`: unauthenticated `GET /api/v1/bookings` with `X-Request-Id: req-1` → 401, `$.code` `UNAUTHORIZED`, `$.requestId` `req-1`.
  - `forbiddenIsProblem`: `@WithMockUser(roles="ARTIST")` `GET /test/errors/admin-only` → 403 `FORBIDDEN`.
  - `errorBodyCarriesRequestId`: `/test/errors/not-found` with `X-Request-Id: req-2` → `$.requestId` `req-2`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; clear MDC in `finally`.
- [ ] **Step 4:** Run `./gradlew test` → PASS (update the existing `securesOtherEndpoints` test to also assert `$.code`).
- [ ] **Step 5:** Commit `feat(shared): request id propagation and problem details for 401/403`.

### Task 6: `BaseEntity` with auditing and optimistic locking

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/persistence/BaseEntity.java`, `JpaAuditingConfig.java`
- Create: `src/main/java/pl/spotonslot/shared/system/ClockConfig.java`
- Test: `src/test/java/pl/spotonslot/shared/persistence/TestNote.java` (entity on table `test_note`, field `String title`), `TestNoteRepository.java` (`JpaRepository<TestNote, UUID>`), `BaseEntityIntegrationTest.java`

**Interfaces:**
- Consumes: `UuidV7.generate()` (Task 2), table `test_note` (Task 1).
- Produces: `@MappedSuperclass public abstract class BaseEntity { protected BaseEntity(); UUID getId(); Instant getCreatedAt(); Instant getUpdatedAt(); Long getVersion(); }`; bean `Clock clock()` = `Clock.systemUTC()`; `@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")` with provider from `Clock`.

- [ ] **Step 1: Write failing tests** (`@IntegrationTest`, `@MockitoBean Clock` returning fixed instants)
  - `assignsUuidV7OnCreation`: `new TestNote("a").getId().version() == 7` before save.
  - `fillsAuditFieldsOnInsert`: save + flush at `2026-01-01T10:00:00Z` → `createdAt` = `updatedAt` = that instant, `version` = 0.
  - `updatesAuditFieldsOnChange`: change title at `2026-01-01T11:00:00Z`, flush → `updatedAt` 11:00, `createdAt` unchanged, `version` = 1.
  - `rejectsStaleUpdate`: load the same row in two transactions (`TransactionTemplate`), update and commit the first, then the second → `ObjectOptimisticLockingFailureException`.
  - `equalityById`: two instances loaded separately with the same id are `equals` and have the same `hashCode`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; `id` column `updatable = false`, `createdAt` `updatable = false`; `equals` uses `Hibernate.getClass(...)`; `hashCode` = `getClass().hashCode()`.
- [ ] **Step 4:** Run `./gradlew test` → PASS.
- [ ] **Step 5:** Commit `feat(shared): base entity with UUID v7, auditing and optimistic locking`.

### Task 7: Paging (`PageQuery`, `PageResponse`)

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/paging/PageQuery.java`, `PageResponse.java`
- Test: `src/test/java/pl/spotonslot/shared/paging/PageQueryTest.java` (unit), `PagingTestController.java` (`@Hidden`, `GET /test/paging` taking `@Valid @ParameterObject PageQuery`, allowed sort `title`, `createdAt`, default `createdAt,desc`, returns `PageResponse.from(repository.findAll(pageable))` over `TestNoteRepository`), `PagingIntegrationTest.java`

**Interfaces:**
- Consumes: `InvalidRequestException` (Task 4), `TestNoteRepository` (Task 6).
- Produces: `public record PageQuery(@Min(0) Integer page, @Min(1) @Max(100) Integer size, String sort) { Pageable toPageable(Set<String> allowedSortFields, Sort defaultSort); }`; `public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) { static <T> PageResponse<T> from(Page<T> page); static <T> PageResponse<T> from(Page<?> page, List<T> content); }`.

- [ ] **Step 1: Write failing tests**
  - Unit: defaults → `PageRequest.of(0, 20, defaultSort)`; `sort="title"` → ascending `title`; `sort="title,desc"` → descending; `sort="password,asc"`, `",desc"`, `"a,b,c"`, `"title,sideways"` → `InvalidRequestException` with code `INVALID_SORT`.
  - Integration (`@WithMockUser`, 3 saved notes): `GET /test/paging?size=2` → `$.content.length()` 2, `$.page` 0, `$.size` 2, `$.totalElements` 3, `$.totalPages` 2; `size=101` → 400 `VALIDATION_FAILED`; `page=-1` → 400 `VALIDATION_FAILED`; `sort=secret` → 400 `INVALID_SORT`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `./gradlew test` → PASS.
- [ ] **Step 5:** Commit `feat(shared): paging query and response`.

### Task 8: CORS and environment profiles

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/web/CorsConfig.java`, `CorsProperties.java` (`@ConfigurationProperties("spotonslot.cors")`, `List<String> allowedOrigins`)
- Create: `src/main/resources/application-dev.yml`, `application-prod.yml`
- Modify: `application.yml` (move docker-compose block to dev, add `spring.profiles.default: dev`), `SecurityConfig.java` (`cors(withDefaults())` uses the new source), `apps/backend/Dockerfile` (`ENV SPRING_PROFILES_ACTIVE=prod`), `application-test.yml` (`spotonslot.cors.allowed-origins: http://localhost:3000`)
- Test: `src/test/java/pl/spotonslot/shared/web/CorsIntegrationTest.java`, `src/test/java/pl/spotonslot/ProdProfileIntegrationTest.java`

**Interfaces:**
- Produces: `CorsConfigurationSource corsConfigurationSource(CorsProperties)` with the Global Constraints values.
- `application-dev.yml`: docker compose (file `../../docker-compose.yml`, `start-only`), CORS `http://localhost:3000`, `http://localhost:3001`. `application-prod.yml`: `logging.structured.format.console: ecs`, `springdoc.api-docs.enabled: false`, `springdoc.swagger-ui.enabled: false`, `spotonslot.cors.allowed-origins: ${CORS_ALLOWED_ORIGINS}`.

- [ ] **Step 1: Write failing tests**
  - `allowsConfiguredOriginPreflight`: `OPTIONS /api/v1/system/info`, `Origin: http://localhost:3000`, `Access-Control-Request-Method: GET` → 200, `Access-Control-Allow-Origin` = origin, `Access-Control-Allow-Credentials` = `true`.
  - `exposesRequestIdHeader`: `GET /api/v1/system/info` with that origin → `Access-Control-Expose-Headers` contains `X-Request-Id`.
  - `rejectsUnknownOrigin`: `Origin: https://evil.example` preflight → 403 and no `Access-Control-Allow-Origin`.
  - `ProdProfileIntegrationTest` (`@IntegrationTest` + `@ActiveProfiles({"test","prod"})`, property `CORS_ALLOWED_ORIGINS=https://app.spotonslot.pl`): `GET /v3/api-docs` → 404 `NOT_FOUND`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `./gradlew test` → PASS; also `./gradlew bootRun` locally starts with profile `dev` (log line `The following 1 profile is active: "dev"`), then stop it.
- [ ] **Step 5:** Commit `feat(shared): CORS configuration and dev/prod profiles`.

### Task 9: OpenAPI problem schema, API client and docs

**Files:**
- Create: `src/main/java/pl/spotonslot/shared/web/ProblemDetailOpenApiCustomizer.java`
- Modify: `src/test/java/pl/spotonslot/SpotOnSlotApplicationTests.java` (assertions below)
- Regenerate: `packages/api-client/src/schema.d.ts` (repo root: `pnpm api:generate` after backend tests)
- Modify: `CLAUDE.md` (backend section: error, paging, entity, request-id and test conventions), `docs/architecture.md` (one line under section 5 linking this spec)

**Interfaces:**
- Produces: `OpenApiCustomizer` bean registering component schema `ProblemDetail` with properties `type, title, status, detail, instance, code, requestId, errors[{field, code, message}]` and adding responses `400, 401, 403, 404, 500` with `application/problem+json` → `#/components/schemas/ProblemDetail` to every operation that does not define them.

- [ ] **Step 1: Write failing test** in `exposesOpenApiSpec`: `$.components.schemas.ProblemDetail.properties.code` exists; `$.paths['/api/v1/system/info'].get.responses['500'].content['application/problem+json']` exists; `$.paths` has no key starting with `/test/`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; run backend tests to export the spec, then `pnpm api:generate`; `pnpm typecheck` passes.
- [ ] **Step 4:** Run `./gradlew test` and, from the repo root, `pnpm lint && pnpm typecheck && pnpm build` → all PASS.
- [ ] **Step 5:** Commit `feat(shared): document problem details in OpenAPI; update docs`.
