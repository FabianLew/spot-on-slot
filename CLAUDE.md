@AGENTS.md

# Spot On Slot: working rules

Read `docs/architecture.md` before larger changes. Decisions there are agreed with the product owner; do not change the stack without asking.

## Backend (`apps/backend`)
- Base package `pl.spotonslot`; each top-level package is a Spring Modulith application module with a `package-info.java`.
- Module layout: `api` (controllers, DTOs), `application` (services/use cases), `domain` (entities, rules), `infrastructure` (repositories, integrations).
- Other modules may use only a module's root package (facade, public types) and its events. Cross-module side effects go through application events (`@ApplicationModuleListener`), not direct calls into internals.
- `shared` is an open module for cross-cutting code only (security, errors, web config). No business logic there.
- Schema changes only through Flyway migrations in `src/main/resources/db/migration`; JPA runs with `ddl-auto: validate`. Store times as `timestamptz` (UTC).
- `./gradlew test` must pass, including `ModularityTest`. Integration tests use Testcontainers (`TestcontainersConfiguration`, PostGIS image).
- REST endpoints live under `/api/v1/...`.
- Errors (`shared.error`): throw `DomainException` subclasses (`NotFoundException`, `ConflictException`, `BusinessRuleException`, `InvalidRequestException`) with a module-specific UPPER_SNAKE `code`. Responses are RFC 9457 `application/problem+json` with `code`, `requestId`, `errors` (validation only). Texts live in `messages_pl/en.properties` as `error.<CODE>.title|detail`; untranslated codes fall back to the generic text for the status.
- Database constraint violations: catch `DataIntegrityViolationException` in the module and rethrow a `ConflictException` with a module code; left untranslated, the shared handler renders it as a generic 500. Anonymous callers get 401 (not 404) for unknown paths: security runs before routing, by design.
- Paging (`shared.paging`): `PageQuery` + `PageResponse`, 0-based, `size` <= 100, `sort=field,asc|desc` checked against a per-endpoint allowlist.
- Entities (`shared.persistence`): extend `BaseEntity` (UUID v7 `id`, `createdAt`, `updatedAt`, `version`). Migration columns: `id uuid primary key, created_at timestamptz not null, updated_at timestamptz not null, version bigint not null`.
- Web (`shared.web`): `RequestIdFilter` (`X-Request-Id`, echoed in logs and errors); CORS via `spotonslot.cors.allowed-origins`. OpenAPI documents the problem schema automatically.
- Lombok for boilerplate: `@Getter`/`@Setter`, `@RequiredArgsConstructor` for constructor injection, `@NoArgsConstructor(access = PROTECTED)` on entities, `@Slf4j` for loggers. Don't hand-write getters, setters or plain constructors. Entities never use `@Data`, `@EqualsAndHashCode` or `@ToString` (lazy loading); DTOs stay Java `record`s. `lombok.config` copies `@Qualifier`/`@Value` from fields to generated constructors.
- Profiles: `dev` (default), `prod`, `test`.
- Tests: use `@IntegrationTest`; test-only tables go in `src/test/resources/db/testmigration`; test controllers under `/test/...` must be `@Hidden`.

## Frontend (`apps/web`, `apps/landing`, `packages/*`)
- pnpm workspaces + Turborepo. Internal packages are consumed as TypeScript source (`transpilePackages`).
- Call the backend only through `@spot-on-slot/api-client`; never hand-write request/response types. After API changes run backend tests, then `pnpm api:generate`, and commit `schema.d.ts`.
- Colors/spacing come from `@spot-on-slot/design-tokens`; keep `src/index.ts` and `src/theme.css` in sync.
- UI copy is Polish by default; keep i18n in mind (`SUPPORTED_LOCALES`).
- Navigation: `apps/web/src/components/navigation/nav-items.ts` is the single source for the sidebar, bottom tabs and the "Więcej" sheet. Entries are plain serializable data: `icon` is a `NavIconName` string resolved client-side in `nav-icons.ts`; never put components or functions in them. Adding a section = an entry in `nav-items.ts` + (new icon → `NavIconName` + `nav-icons.ts`) + a page under `src/app/(app)/` + `nav.*` keys in both message files.
- i18n (`apps/web`): next-intl without routing; locale from cookie `NEXT_LOCALE` → Accept-Language → `pl`. Copy lives only in `apps/web/messages/{pl,en}.json` (key parity test, typed keys). Switch locale with the `setLocale` server action.
- Theme: next-themes, class-based; light/dark tokens in `@spot-on-slot/design-tokens` (`index.ts` and `theme.css` are kept in sync by a test). Palette is black/gray + red accent, a placeholder until the brand book; danger text always comes with an icon.
- `packages/ui`: shadcn-style components; no `next-intl`/`next` imports, text comes via props; files using hooks/context need `"use client"`.
- API in `apps/web`: use `api` from `src/lib/api.ts` (wraps `@spot-on-slot/api-client`, sends Accept-Language); `unwrap` + `toApiProblem` + `ApiProblemError`; show query errors with `ApiErrorState`; mutation errors toast automatically unless the mutation sets `meta: { handlesErrors: true }`.
- Forms: `Form` from `@spot-on-slot/ui` + a zod schema whose messages are `validation.*` keys (translated via `translateFormError`); `applyServerErrors(form, problem)` maps backend `errors[]` to fields or `root.server`.
- Tests: Vitest + Testing Library in `packages/ui`, `packages/design-tokens`, `packages/api-client`, `apps/web`.
- Before pushing: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Workflow
- Story-based development in `ai-development/` (see its README), same as ecommerce-flow.
