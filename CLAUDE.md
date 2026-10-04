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
- REST endpoints live under `/api/v1/...`; errors use `ApiError`.

## Frontend (`apps/web`, `apps/landing`, `packages/*`)
- pnpm workspaces + Turborepo. Internal packages are consumed as TypeScript source (`transpilePackages`).
- Call the backend only through `@spot-on-slot/api-client`; never hand-write request/response types. After API changes run backend tests, then `pnpm api:generate`, and commit `schema.d.ts`.
- Colors/spacing come from `@spot-on-slot/design-tokens`; keep `src/index.ts` and `src/theme.css` in sync.
- UI copy is Polish by default; keep i18n in mind (`SUPPORTED_LOCALES`).
- Before pushing: `pnpm lint && pnpm typecheck && pnpm build`.

## Workflow
- Story-based development in `ai-development/` (see its README), same as ecommerce-flow.
