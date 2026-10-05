# Landing + Waitlist (L1, B15, L2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PL/EN landing (`apps/landing`) with the cursor-spotlight hero from Fabian's prompt, the sections from the spec, and a waitlist form backed by a new `waitlist` backend module with double opt-in e-mail confirmation.

**Architecture:** Backend gets a Spring Modulith module `pl.spotonslot.waitlist` (signup + confirmation + daily cleanup) that publishes `WaitlistConfirmationRequested`; the existing `notification` module listens and sends the e-mail via `spring-boot-starter-mail` (Mailpit in dev). Landing becomes a next-intl app with `[locale]` routing (`/pl`, `/en`), a client-only hero component, static sections, a react-hook-form + zod waitlist form calling the generated `@spot-on-slot/api-client`, and a confirmation page. Shared form/API helpers move out of `apps/web` into packages so both apps use one implementation.

**Tech Stack:** Spring Boot 3.5.16 (Modulith 1.4, JPA, Flyway, Mail), Java 21 + Lombok; Next.js 16.3.8, React 19.2.8, Tailwind 4, next-intl ^4.14 (with routing), next-themes, react-hook-form + zod 4, lucide-react, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-05-landing-waitlist-design.md` (sections 1–7, hero in 3a, copy in 3a + 6).

## Global Constraints

- Read the repo `CLAUDE.md` first (module layout, error codes, Lombok, i18n, forms rules). Next.js 16 differs from older versions: read `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `13-fonts.md`, `14-metadata-and-og-images.md` and `02-guides/internationalization.md` before writing routing, proxy, fonts or metadata code.
- Backend: all schema changes via Flyway `V2__waitlist.sql`; entities extend `BaseEntity`; errors are `DomainException` subclasses with codes `WAITLIST_TOKEN_INVALID` (404) and `WAITLIST_TOKEN_EXPIRED` (422), texts in `messages_pl/en.properties`; endpoints under `/api/v1/waitlist/...` and added to `PUBLIC_PATHS`; `ModularityTest` must stay green (cross-module only via the root package types and events).
- Backend tests need Docker (`dockerd &` if not running). Run `./gradlew test` from `apps/backend`; after API changes run `pnpm api:generate` from the repo root and commit `packages/api-client/src/schema.d.ts`.
- All user-visible landing copy comes from `apps/landing/messages/{pl,en}.json`, exactly the texts in spec sections 3a and 6. No invented copy, numbers or testimonials.
- Hero: reproduce the prompt exactly (classes, animation names/timings/delays, spotlight mechanic) except the adaptations listed in spec 3a. Palette stays black/gray + red (`#dc2626`, hover `#b91c1c`).
- `packages/ui` never imports `next-intl` or `next/*`.
- Data-controller values: `NEXT_PUBLIC_PRIVACY_CONTROLLER`, `NEXT_PUBLIC_PRIVACY_EMAIL`; placeholders `[administrator danych]` / `[e-mail kontaktowy]` when missing; `LANDING_ENV=production` without them fails the build. API base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`).
- Every task ends with the relevant checks green: backend `./gradlew test`; frontend `pnpm lint && pnpm typecheck && pnpm test && pnpm build` from the repo root.
- Commits end with the session's attribution trailer lines (given by the controller).

## Review Focus

1. Signup never leaks membership: the same `202` (no body) for new, pending, confirmed and honeypot requests, and for the unique-violation race. Tests in Task 1.
2. Token handling: only the SHA-256 hash is stored; a confirmed signup's token cannot be reused to change state; expired → 422, unknown → 404, confirmed again → 200. Tests in Task 2.
3. E-mail goes out only after the signup transaction commits (`@ApplicationModuleListener`), in the signup's locale, with the link `{base-url}/{locale}/waitlist/confirm?token=...`. Test in Task 3.
4. `/` and unknown-locale paths: `/` → `/pl` or `/en` by `Accept-Language`; `/de` → 404; `/pl/x` → localized 404. Tests in Task 5.
5. Spotlight: listener and RAF are cleaned up on unmount; mask is updated whenever cursor position changes; nothing is revealed before the first mouse move (cursor at −999). Tests in Task 6.
6. Form: server `errors[]` land on fields; `consent` unchecked blocks submit client-side; honeypot filled still shows success; network error shows the retry text with an icon. Tests in Task 8.

---

### Task 1: `waitlist` module — schema, domain and signup endpoint

**Files:**
- Create: `apps/backend/src/main/resources/db/migration/V2__waitlist.sql`
- Create: `apps/backend/src/main/java/pl/spotonslot/waitlist/package-info.java`, `.../waitlist/WaitlistConfirmationRequested.java` (record: `String email, String locale, String token`), `.../waitlist/domain/{WaitlistSignup,WaitlistRole,WaitlistStatus,ConfirmationToken}.java`, `.../waitlist/infrastructure/WaitlistSignupRepository.java`, `.../waitlist/application/WaitlistService.java`, `.../waitlist/api/{WaitlistController,SignupRequest}.java`, `.../waitlist/WaitlistProperties.java` (`spotonslot.waitlist.token-ttl` default `PT48H`, `resend-interval` default `PT10M`, `pending-retention` default `P7D`)
- Modify: `apps/backend/src/main/java/pl/spotonslot/shared/security/SecurityConfig.java` (`/api/v1/waitlist/**` in `PUBLIC_PATHS`)
- Create: `apps/backend/src/test/java/pl/spotonslot/waitlist/WaitlistSignupIntegrationTest.java`, `.../waitlist/ConfirmationTokenTest.java`

**Interfaces:**
- `POST /api/v1/waitlist/signups` body `SignupRequest(@Email @NotBlank @Size(max=254) email, @NotNull WaitlistRole role, @NotBlank @Size(min=2,max=100) city, @NotNull Locale locale ∈ {pl,en} (validate with a custom `@SupportedLocale` or `@Pattern("pl|en")`), @AssertTrue consent, String website)` → `202` no body, always.
- `WaitlistSignup` columns: `email` (lowercased, unique), `role`, `city`, `locale`, `status`, `token_hash` (unique), `token_expires_at`, `token_sent_at`, `consent_at`, `confirmed_at`. Static factory `WaitlistSignup.pending(email, role, city, locale, tokenHash, expiresAt, now)`; methods `refresh(role, city, locale)`, `issueToken(hash, expiresAt, now)`, `canResend(now, interval)`, `confirm(now)`.
- `ConfirmationToken.generate()` → 32 random bytes base64url (no padding); `ConfirmationToken.hash(String)` → hex SHA-256.
- `WaitlistService.signUp(SignupCommand)`: honeypot filled → return; `findByEmail` → new: save pending + publish event; pending: `refresh`, if `canResend` issue token + publish; confirmed: no-op. Wrap `save` of a new signup in `try/catch DataIntegrityViolationException` → treat as "already exists" (return silently). `@Transactional`.
- Events published through `ApplicationEventPublisher`.

- [ ] **Step 1: Write the failing tests.** `ConfirmationTokenTest`: generated tokens are 43 chars base64url and unique; `hash` is 64 hex chars and deterministic. `WaitlistSignupIntegrationTest` (`@IntegrationTest`, MockMvc, `@MockitoBean ApplicationEventPublisher`? — no: use Modulith `Scenario`/`PublishedEvents` from `spring-modulith-starter-test`, or simpler: inject the repository and an `@TestConfiguration` `@EventListener` recorder): new e-mail → 202, row `PENDING` with lowercase email, `token_hash` set, `consent_at` set, one `WaitlistConfirmationRequested` with the right locale; second request for the same e-mail 1 minute later → 202, no new row, no second event; same with `token_sent_at` moved 11 minutes back (update the row in the test) → new event and a changed `token_hash`; `CONFIRMED` row → 202, nothing changes, no event; honeypot `website="x"` → 202, no row; invalid body (bad email, city "a", consent false, locale "de") → 400 `VALIDATION_FAILED` with `errors[]` naming each field; uppercase `Foo@Bar.PL` stored as `foo@bar.pl`.
- [ ] **Step 2: Run** `./gradlew test --tests 'pl.spotonslot.waitlist.*'` — FAIL (compilation).
- [ ] **Step 3: Implement** migration (uuid pk + base columns, `status`/`role` as `varchar` with check constraints, unique indexes on `lower(email)`→ store lowercase and plain unique on `email`, unique on `token_hash`), entity with Lombok (`@Getter`, `@NoArgsConstructor(access = PROTECTED)`), repository, service, controller, properties (`@ConfigurationProperties`, enable with `@EnableConfigurationProperties` in the module config), security path.
- [ ] **Step 4: Run** the module tests and `ModularityTest` — PASS.
- [ ] **Step 5: Commit** `feat(waitlist): signup endpoint with double opt-in tokens`

### Task 2: Confirmation endpoint and pending cleanup

**Files:**
- Modify: `.../waitlist/application/WaitlistService.java`, `.../waitlist/api/WaitlistController.java`
- Create: `.../waitlist/api/{ConfirmationRequest,ConfirmationResponse}.java`, `.../waitlist/domain/{WaitlistTokenInvalidException,WaitlistTokenExpiredException}.java` (extend `NotFoundException("WAITLIST_TOKEN_INVALID")` / `BusinessRuleException("WAITLIST_TOKEN_EXPIRED")`), `.../waitlist/application/WaitlistCleanupJob.java` (`@Scheduled(cron = "0 0 3 * * *")`, `@EnableScheduling` in a module config class), `apps/backend/src/test/java/pl/spotonslot/waitlist/WaitlistConfirmationIntegrationTest.java`
- Modify: `apps/backend/src/main/resources/messages_pl.properties`, `messages_en.properties` (texts from spec 6 "Błędy API")

**Interfaces:**
- `POST /api/v1/waitlist/confirmations` body `{ token }` (`@NotBlank`) → `200 { "status": "CONFIRMED" }`; `404 WAITLIST_TOKEN_INVALID`; `422 WAITLIST_TOKEN_EXPIRED`.
- `WaitlistService.confirm(token)`: hash → `findByTokenHash` → missing: invalid; `CONFIRMED`: return; expired (`token_expires_at < now`): expired; else `confirm(now)`.
- `WaitlistService.deleteStalePending(now)`: delete `PENDING` with `created_at < now - pending-retention`; returns count; job logs it.

- [ ] **Step 1: Write the failing tests:** valid token → 200 + row `CONFIRMED` with `confirmed_at`; same token again → 200; unknown token → 404 problem with `code: WAITLIST_TOKEN_INVALID` and Polish title "Nieprawidłowy link" (and English with `Accept-Language: en`); expired (set `token_expires_at` in the past) → 422 `WAITLIST_TOKEN_EXPIRED`; blank token → 400; `deleteStalePending` removes a pending row created 8 days ago (set `created_at` via JDBC) and keeps a pending row from yesterday and a confirmed row from 30 days ago.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** all backend tests — PASS.
- [ ] **Step 5: Commit** `feat(waitlist): token confirmation and stale signup cleanup`

### Task 3: Confirmation e-mail in `notification`, mail config, API client

**Files:**
- Modify: `apps/backend/build.gradle` (`implementation 'org.springframework.boot:spring-boot-starter-mail'`)
- Create: `.../notification/application/WaitlistConfirmationMailer.java` (`@ApplicationModuleListener` on `WaitlistConfirmationRequested`), `.../notification/infrastructure/MailSender.java` (wraps `JavaMailSender`, builds `MimeMessage` with text + HTML parts), `.../notification/NotificationProperties.java` (`spotonslot.mail.from`, `spotonslot.landing.base-url`)
- Modify: `application.yml` (`spring.mail.host: ${MAIL_HOST:localhost}`, `port: ${MAIL_PORT:1025}`, `username/password` from env, `spotonslot.mail.from: ${MAIL_FROM:no-reply@spotonslot.local}`, `spotonslot.landing.base-url: ${LANDING_BASE_URL:http://localhost:3001}`), `application-prod.yml` (no defaults for host/from/base-url — required), `messages_pl/en.properties` (`mail.waitlist.confirm.subject|greeting|body|validity|button|ignore` from spec 6)
- Create: `apps/backend/src/test/java/pl/spotonslot/notification/WaitlistConfirmationMailerIntegrationTest.java` (`@MockitoBean JavaMailSender`, publish the event inside a transaction via Modulith `Scenario` or `TransactionTemplate` + `ApplicationEventPublisher`, assert the captured `MimeMessage`: `To`, subject in `pl` and `en`, body contains `http://localhost:3001/pl/waitlist/confirm?token=<token>`)
- Modify: `apps/backend/src/test/resources/application-test.yml` if a mail property needs a test value
- Run `pnpm api:generate` → Modify: `packages/api-client/src/schema.d.ts`

**Interfaces:**
- Event → one e-mail; link `${base-url}/${locale}/waitlist/confirm?token=${token}` (token is URL-safe already). Listener failures are logged; Modulith's event registry retries on restart (`republish-outstanding-events-on-restart: true`).
- `ModularityTest` stays green: `notification` depends only on `pl.spotonslot.waitlist.WaitlistConfirmationRequested`.

- [ ] **Step 1: Write the failing test.** **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `./gradlew test` — PASS; `pnpm api:generate`; verify `schema.d.ts` has `/api/v1/waitlist/signups` and `/confirmations`.
- [ ] **Step 5: Commit** `feat(notification): waitlist confirmation e-mail; regenerate API client`

### Task 4: Move shared API/form helpers into packages

**Files:**
- Modify: `packages/api-client/src/index.ts` (add `ApiProblem`, `ApiProblemError`, `toApiProblem`, `unwrap` — moved from `apps/web/src/lib/api-error.ts`), `packages/api-client/src/index.test.ts` (move the relevant tests from `apps/web/src/lib/api-error.test.ts`)
- Modify: `packages/ui/src/form.tsx` or create `packages/ui/src/form-errors.ts` (add `applyServerErrors(form, problem: { title?: string; detail?: string; errors?: { field: string; message: string }[] })` and `translateFormError(t: { (key: string): string; has(key: string): boolean })` — moved from `apps/web/src/lib/forms.ts`), `packages/ui/src/index.ts`, move `apps/web/src/lib/forms.test.tsx` → `packages/ui/src/form-errors.test.tsx`
- Modify: `apps/web/src/lib/api-error.ts` and `apps/web/src/lib/forms.ts` become re-exports (keep import paths in `apps/web` working) or update the web imports and delete the files — pick the delete + update-imports route if under ~10 call sites.

**Interfaces:** unchanged signatures; `ApiProblem` stays `ApiSchemas["ProblemDetail"]`. `packages/ui` gets no new runtime dependency (structural problem type).

- [ ] **Step 1: Move the tests first** and run `pnpm test` — FAIL in the new locations. **Step 2: Move the code**, fix imports. **Step 3: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — PASS (web behaviour unchanged).
- [ ] **Step 4: Commit** `refactor: share API problem and form error helpers via packages`

### Task 5: Landing i18n routing, fonts, layout, config

**Files:**
- Modify: `apps/landing/package.json` (deps `next-intl`, `next-themes`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `zod`; devDeps as in `apps/web`: vitest, testing-library, jsdom, `@vitejs/plugin-react`; script `"test": "vitest run"`), `apps/landing/next.config.ts` (wrap with `createNextIntlPlugin`; production env guard: `if (process.env.LANDING_ENV === "production" && (!process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER || !process.env.NEXT_PUBLIC_PRIVACY_EMAIL)) throw new Error(...)`), `apps/landing/tsconfig.json` if needed
- Create: `apps/landing/src/i18n/{routing.ts,request.ts,navigation.ts,global.d.ts}` (next-intl `defineRouting({ locales: SUPPORTED_LOCALES, defaultLocale: "pl", localePrefix: "always" })`), `apps/landing/src/proxy.ts` (next-intl middleware; matcher excludes `_next`, `hero`, files with extensions), `apps/landing/messages/{pl,en}.json` (all keys from spec 3a + 6, grouped `nav`, `hero`, `audiences`, `howItWorks`, `waitlist`, `privacy`, `faq`, `confirm`, `footer`, `validation`, `common`), `apps/landing/src/lib/privacy-config.ts` (reads the two env vars, falls back to placeholders), `apps/landing/src/lib/api.ts` (`createApiClient({ baseUrl: NEXT_PUBLIC_API_URL, getLocale })`), `apps/landing/src/app/[locale]/layout.tsx` (fonts via `next/font/google`: `Inter` 300–700 → `--font-inter`, `Playfair_Display` italic 400–600 → `--font-playfair`; `NextIntlClientProvider`; `ThemeProvider` from next-themes with `attribute="class" defaultTheme="system"`; `<html lang={locale} suppressHydrationWarning>`; `generateStaticParams`; `generateMetadata` with title/description from messages and `alternates.languages` for `pl`/`en`), `apps/landing/src/app/[locale]/page.tsx` (placeholder sections filled by Tasks 6–8), `apps/landing/src/app/[locale]/not-found.tsx`, `apps/landing/src/app/not-found.tsx` (root, for `/de`), `apps/landing/vitest.config.mts`, `apps/landing/vitest.setup.ts`, tests: `apps/landing/src/i18n/messages.test.ts` (key parity), `apps/landing/src/proxy.test.ts` (`/` with `Accept-Language: en-US` → redirect `/en`; `de` → `/pl`; no header → `/pl`), `apps/landing/src/lib/privacy-config.test.ts`
- Modify: `apps/landing/src/app/globals.css` (`@import "tailwindcss"`, tokens theme.css, `--font-sans`/`--font-playfair` mapping, `@custom-variant dark`, the hero keyframes block from the prompt verbatim, `.font-playfair`), remove old `apps/landing/src/app/{layout,page}.tsx`

**Interfaces:** routes `/{pl|en}` and `/{pl|en}/waitlist/confirm`; `Link`/`useRouter` from `src/i18n/navigation.ts`; `t = useTranslations()` with typed keys (`AppConfig` declaration from `pl.json`).

- [ ] **Step 1: Write the failing tests** (messages parity, proxy redirects, privacy fallback). **Step 2: Run** `pnpm --filter landing test` — FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — PASS; `pnpm dev:landing` + `curl -I -H 'Accept-Language: en' localhost:3001/` → 307 to `/en`.
- [ ] **Step 5: Commit** `feat(landing): locale routing, fonts, layout and messages`

### Task 6: Hero with cursor spotlight and navigation

**Files:**
- Create: `apps/landing/src/components/hero/hero.config.ts` (constants from spec 3a), `apps/landing/src/components/hero/reveal-layer.tsx` (`"use client"`, `RevealLayer({ image, cursorX, cursorY })` exactly as in the prompt: hidden canvas sized on mount + resize, reveal div `absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none`, mask rebuilt in an effect on `[cursorX, cursorY]` with the exact gradient stops, `toDataURL()` → `maskImage`/`WebkitMaskImage`, `maskSize: '100% 100%'`), `apps/landing/src/components/hero/hero.tsx` (`"use client"`; `SPOTLIGHT_R`, refs `mouse`/`smooth`/`rafRef`, state `cursorPos` init `{x:-999,y:-999}`, `mousemove` listener + RAF lerp 0.1 + cleanup; `<section className="relative w-full overflow-hidden h-screen bg-black" style={{height:'100dvh'}}>`; base image div `absolute inset-0 bg-center bg-cover bg-no-repeat hero-zoom` z-10; `RevealLayer`; heading block `absolute top-[14%] ...` with the two spans (classes, letterSpacing and delays verbatim); bottom-left paragraph; bottom-right block with CTA `<a href="#waitlist">` styled per prompt with `backgroundColor: HERO_CTA_COLOR` and hover via CSS variable `--hero-cta-hover`), `apps/landing/src/components/hero/hero-nav.tsx` (`"use client"`; `fixed top-0 ... z-[100]`; logo SVG from the prompt + wordmark `font-playfair italic`; center pill `hidden md:flex ...` with anchors from `NAV_ITEMS` (`#audiences`, `#how-it-works`, `#waitlist`, `#faq`) and active style for `ACTIVE_NAV_ITEM`; right desktop CTA `hidden md:block ...` → `#waitlist`; locale switch (link to the same path in the other locale, text "EN"/"PL"); `md:hidden` `Menu` button opening a `Sheet` from `@spot-on-slot/ui` with the nav links and the locale switch), tests `hero.test.tsx`, `reveal-layer.test.tsx`, `hero-nav.test.tsx`
- Modify: `apps/landing/src/app/[locale]/page.tsx` (render `HeroNav` + `Hero`)
- Convert: `apps/landing/public/hero/reveal.png` → `reveal.jpg` (quality ~85, same width; use `sharp` via `pnpm dlx` or ImageMagick if present; delete the PNG); confirm `base.jpg` < 300 kB

**Interfaces:** all texts via `useTranslations("hero")` / `("nav")`; images and colors from `hero.config.ts`. jsdom has no canvas: in tests stub `HTMLCanvasElement.prototype.getContext` to return a recording fake and `toDataURL` → `"data:mask"`; stub `requestAnimationFrame`.

- [ ] **Step 1: Write the failing tests:** headline lines and both paragraphs render from messages; CTA links to `#waitlist`; active nav item has `bg-white`; the `Menu` button opens the sheet with 4 links and the locale link (`/en` ↔ `/pl`); `RevealLayer` sets `maskImage` to the canvas data URL after a cursor change and draws a gradient with 6 stops at radius 260; `Hero` adds a `mousemove` listener on mount and removes it + cancels RAF on unmount; before any mouse move the mask is centred at (−999, −999).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** per the prompt. **Step 4: Run** tests, typecheck, lint, build — PASS. Manual: `pnpm dev:landing`, Playwright screenshot at 1440×900 after moving the mouse to (700, 450) shows the red reveal circle; at 390×844 the hamburger is visible and the pill hidden.
- [ ] **Step 5: Commit** `feat(landing): spotlight hero and floating navigation`

### Task 7: Sections below the hero

**Files:**
- Create: `apps/landing/src/components/sections/{audiences,how-it-works,faq,footer,privacy-notice}.tsx`, `apps/landing/src/components/sections/sections.test.tsx`
- Modify: `apps/landing/src/app/[locale]/page.tsx` (order: HeroNav, Hero, Audiences `#audiences`, HowItWorks `#how-it-works`, Waitlist `#waitlist` (Task 8), Faq `#faq`, Footer)

**Interfaces:** sections are server components using `getTranslations`; `Card` from `@spot-on-slot/ui` for audiences; FAQ with native `<details>/<summary>`; `PrivacyNotice({ controller, email })` renders the clause with `t.rich`/interpolation; footer shows `Spot On Slot · {year}` and the controller e-mail. Section headings are `<h2>` with `id`s and `scroll-mt-20`.

- [ ] **Step 1: Write the failing tests:** each section renders its heading and all items from messages (3 audiences, 3 steps, 6 FAQ entries); FAQ answers are inside `<details>`; privacy notice shows the controller and e-mail passed in; footer contains the current year.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** `feat(landing): audiences, how it works, FAQ and footer`

### Task 8: Waitlist form

**Files:**
- Create: `apps/landing/src/components/waitlist/waitlist-schema.ts` (`z.object({ email: z.email("validation.email"), role: z.enum(["ARTIST","BOOKER","VENUE"], "validation.role"), city: z.string().trim().min(2,"validation.city").max(100), consent: z.literal(true, "validation.consent"), website: z.string().optional() })`), `apps/landing/src/components/waitlist/waitlist-form.tsx` (`"use client"`; `Form`, `Input`, `Select`, `Checkbox`, `Button` from ui; honeypot input `tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]"`; submit → `api.POST("/api/v1/waitlist/signups", { body: { ...values, locale } })` → `unwrap`; on success render the "Sprawdź skrzynkę" block with the e-mail; on error `applyServerErrors(form, toApiProblem(error))` and `FormRootError` with `CircleAlert` icon; fallback text `waitlist.error`), `apps/landing/src/components/waitlist/waitlist-section.tsx` (server wrapper with heading, description, form, `PrivacyNotice`), tests `waitlist-form.test.tsx`
- Modify: `apps/landing/src/app/[locale]/page.tsx`

**Interfaces:** request/response types only from `@spot-on-slot/api-client` (`paths["/api/v1/waitlist/signups"]["post"]`). Mock `fetch` in tests (`vi.stubGlobal`).

- [ ] **Step 1: Write the failing tests:** empty submit shows the four validation messages (Polish) and does not call `fetch`; valid submit posts JSON with `locale: "pl"` and the lowercase role enum, then shows the success block with the e-mail; a `400 VALIDATION_FAILED` problem with `errors: [{field:"city",...}]` lands under the city field; `fetch` rejecting (`TypeError`) shows `waitlist.error` with an icon and keeps the form; filled honeypot is sent as-is and shows success.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. Manual with backend + Mailpit: sign up on `/pl`, open `localhost:8025`, see the Polish e-mail.
- [ ] **Step 5: Commit** `feat(landing): waitlist signup form`

### Task 9: Confirmation page

**Files:**
- Create: `apps/landing/src/app/[locale]/waitlist/confirm/page.tsx` (`robots: { index: false }`; reads `searchParams.token`; renders `ConfirmStatus`), `apps/landing/src/components/waitlist/confirm-status.tsx` (`"use client"`; on mount `POST /api/v1/waitlist/confirmations`; states `loading | confirmed | expired | invalid | network` — `network` shows the invalid text plus a "Spróbuj ponownie" button; no token → `invalid` without a request; `expired` offers a link to `/#waitlist`), `confirm-status.test.tsx`

- [ ] **Step 1: Write the failing tests** for the five states (mock `fetch`: 200, 422 `WAITLIST_TOKEN_EXPIRED`, 404 `WAITLIST_TOKEN_INVALID`, rejection; and missing token → no fetch call). **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; manual: click the Mailpit link → "Gotowe, jesteś na liście".
- [ ] **Step 5: Commit** `feat(landing): waitlist confirmation page`

### Task 10: Docs, CI and full verification

**Files:**
- Modify: `CLAUDE.md` (Landing bullets: locale routing with prefix via `src/i18n/routing.ts` + `proxy.ts`; copy only in `apps/landing/messages`; hero config in `hero.config.ts`, prompt-derived — don't restyle; privacy env vars and the production guard; shared helpers now in `@spot-on-slot/api-client` (`unwrap`, `toApiProblem`) and `@spot-on-slot/ui` (`applyServerErrors`, `translateFormError`)), `docs/architecture.md` (link to the spec; waitlist module in the module list; mail in the infrastructure list), `.env.example` or `apps/landing/.env.example` (the three `NEXT_PUBLIC_*` vars + `LANDING_ENV`), `apps/backend` README/env notes if one exists (`MAIL_*`, `LANDING_BASE_URL`)
- Verify `.github/workflows/ci.yml` needs no change (landing `test` script is picked up by `turbo run test`).

- [ ] **Step 1:** Update docs. **Step 2: Run** `./gradlew test` and, from root, `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — all PASS.
- [ ] **Step 3: Manual end-to-end** with `dockerd`, backend (`./gradlew bootRun`), `pnpm dev:landing`: sign up on `/en`, confirm via the Mailpit link, check the row in Postgres is `CONFIRMED`. Screenshots (Playwright) to `/mnt/project-files/landing-screens/`: hero desktop with spotlight, hero mobile, sections light and dark, form success, confirm page.
- [ ] **Step 4: Commit** `docs: landing and waitlist conventions`
