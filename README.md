# Spot On Slot

Marketplace connecting artists, bookers and clubs/venues: profiles, availability calendars, "I'm free" announcements, bookings and messaging. Long term: a platform for the whole event industry.

Architecture and decisions: [docs/architecture.md](docs/architecture.md) (Polish).

## Structure

```
spot-on-slot/
├── apps/
│   ├── backend/          # Spring Boot 3.5, modular monolith (Spring Modulith), Gradle
│   ├── web/              # Next.js 16: app for artists, bookers and venues (PWA)
│   └── landing/          # Next.js 16: marketing site, later public SEO profiles
│   # mobile/            # phase 2: Expo / React Native
├── packages/
│   ├── api-client/       # typed client generated from the backend OpenAPI spec (openapi-fetch)
│   ├── shared/           # domain types, zod schemas, i18n constants
│   ├── ui/               # shared React components (Tailwind)
│   └── design-tokens/    # colors, spacing, typography for web and mobile
├── docs/                 # architecture
├── ai-development/       # stories and prompts (story-based workflow)
└── docker-compose.yml    # PostgreSQL + PostGIS, Mailpit
```

## Prerequisites

- Java 21
- Node.js 22+ and pnpm 10 (`corepack enable`)
- Docker (local services and Testcontainers)

## Getting started

```bash
pnpm install
cp .env.example .env

# Backend: starts docker-compose services automatically, http://localhost:8080
cd apps/backend && ./gradlew bootRun

# Frontends (from the repo root)
pnpm dev:web        # http://localhost:3000
pnpm dev:landing    # http://localhost:3001
```

Swagger UI: http://localhost:8080/swagger-ui.html · Mailpit: http://localhost:8025

## Common tasks

| Task | Command |
|---|---|
| Backend tests (incl. module boundary check) | `cd apps/backend && ./gradlew test` |
| Regenerate API client after backend API changes | `cd apps/backend && ./gradlew test` then `pnpm api:generate` |
| Lint / typecheck / build all frontends | `pnpm lint`, `pnpm typecheck`, `pnpm build` |

Backend tests write the OpenAPI spec to `apps/backend/build/openapi/openapi.json` and module diagrams to `apps/backend/build/spring-modulith-docs/`. CI fails when `packages/api-client/src/schema.d.ts` is stale.
