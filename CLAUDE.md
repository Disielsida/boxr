# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a two-app monorepo (no workspace tooling — each app has its own `package.json` / `node_modules`):

- **`boxr/`** — React 19 + Vite + TypeScript SPA (frontend).
- **`boxr-api/`** — NestJS 10 + Prisma 5 + PostgreSQL backend.
- `assets/`, `index.html`, `docs/` at the root are unrelated static/diploma material; production code lives only in the two app directories above.

The two apps run together: backend on `:3000` exposing `/api/v1`, frontend dev server on `:5173` (Vite) reading `VITE_API_URL`. Playwright e2e in `boxr/` boots both.

UI strings, error messages, and many comments are in Russian — preserve language when editing user-facing text or matching against existing copy.

## Common commands

### Backend (`boxr-api/`)

```bash
docker compose up -d          # Postgres 16 on host port 5433 (data volume: pgdata)
cp .env.example .env          # then fill JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (≥32 chars; openssl rand -hex 64)
npm install
npm run prisma:generate
npm run prisma:migrate        # applies migrations under prisma/migrations
npm run start:dev             # nest start --watch (port from PORT env, default 3000)
npm run start:prod            # node dist/main.js (used by Playwright webServer)
npm run lint                  # eslint --fix on src/** and test/**
npm test                      # jest, picks up *.spec.ts under src/
npm test -- path/to/file.spec.ts   # run a single jest file
npm run prisma:studio         # GUI for the dev DB
```

Three bash smoke scripts under `boxr-api/scripts/` (`test-applications.sh`, `test-boxers.sh`, `test-tournaments.sh`) hit a running API with `curl` and assert HTTP codes. They expect `API=http://localhost:3000/api/v1` and a clean DB.

### Frontend (`boxr/`)

```bash
npm install
npm run dev                   # Vite dev server (port 5173)
npm run build                 # tsc -b && vite build
npm run lint                  # eslint .
npm run test:e2e              # Playwright; auto-starts both `vite dev` and `boxr-api` start:prod
npm run test:e2e:ui           # Playwright UI mode
npx playwright test e2e/tournaments.spec.ts                # single file
npx playwright test -g "creates a draft tournament"        # by title
```

Playwright config (`boxr/playwright.config.ts`) launches the API via `npm run start:prod` in `../boxr-api`. The API must already have its `.env` and a running Postgres (`docker compose up -d` from `boxr-api/`) before running e2e — the config only manages the Node processes, not the database.

Path alias: imports use `@/...` → `boxr/src/...` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Architecture

### Backend domain model (Prisma → `boxr-api/prisma/schema.prisma`)

Five core models with these relationships:

- `User` — `role: ORGANIZER | TRAINER | JUDGE`, owns `Tournament[]` (as organizer), `Boxer[]` (as trainer), and `RefreshToken[]`.
- `Tournament` — owned by an organizer; has `status: DRAFT | PUBLISHED | CANCELLED` with a `publishedAt` timestamp set on publish; carries `categories: Float[]` (weight classes), rounds config, and date range.
- `Boxer` — owned by a trainer; has `rank` enum and `weight`.
- `Application` — links a `Boxer` to a `Tournament` for a given `category` weight; status flow `PENDING → APPROVED | REJECTED | WITHDRAWN`. Unique `(boxerId, tournamentId)`.
- `RefreshToken` — server-side store for refresh JWTs (hashed, with `expiresAt`, `revokedAt`, `userAgent`, `ipAddress`).

When changing the schema, always create a migration via `npm run prisma:migrate` (don't hand-edit a migration directory or `db push`).

### Backend module structure (`boxr-api/src/`)

NestJS, one module per bounded context: `auth`, `users`, `boxers`, `tournaments`, `applications`, plus shared `prisma` and `common`. `app.module.ts` wires them all and validates `process.env` with a `Joi` schema (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `BCRYPT_ROUNDS`, `PORT`, `CORS_ORIGIN`) — boot fails if any are missing/invalid.

Global setup in `main.ts`:

- Prefix `api/v1` on every route.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — DTOs **strip unknown fields and 400 on extras**, so add `class-validator` decorators on every accepted property.
- Global `HttpExceptionFilter` (`common/filters/http-exception.filter.ts`) returns a uniform envelope `{ statusCode, message, error, timestamp, path, errors? }`. Frontend's `ApiError` reads `message` from this shape.
- CORS origin list comes from comma-separated `CORS_ORIGIN`; credentials are enabled.

Auth pattern (used across controllers):

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)              // from auth/decorators/roles.decorator
@Get(':id')
findOne(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { ... }
```

`RolesGuard` reads metadata via `Reflector` and 403s when the JWT user's role isn't in the list. UUID params should always go through `ParseUUIDPipe`. Resource ownership (e.g., organizer can only mutate their own tournament) is enforced inside services, not guards.

### Frontend structure (`boxr/src/`)

Feature-Sliced Design layers — keep imports flowing **downward only**:

```
app/        providers (AuthProvider), router (AppRouter + guards), global styles
pages/      route-level screens (one per URL)
widgets/    composite UI blocks reused across pages (sidebar, topbar, ai-assistant)
features/   user-facing actions/flows (auth, tournament-create, applications-submit, ...)
entities/   domain models with their `model/` (state) and `ui/` (presentational)
shared/     api client, ui kit, types, lib helpers
```

`shared/api/client.ts` is the single fetch entry point. It:

- Reads `VITE_API_URL` (default `http://localhost:3000/api/v1`).
- Attaches `Authorization: Bearer <access>` from `tokenStorage` unless `auth: false`.
- On 401 with a stored refresh token, calls `/auth/refresh` exactly once (via a shared in-flight promise to dedupe concurrent 401s), retries the original request, and clears tokens on failure.
- Throws `ApiError(status, message, payload)` for non-2xx; UI code catches by `instanceof ApiError`.

Tokens live in `localStorage` under keys `boxr.access` and `boxr.refresh` — these exact keys are referenced by Playwright helpers (`boxr/e2e/helpers.ts`) and must not be renamed without updating tests.

Routing (`app/router/AppRouter.tsx`) wraps protected routes in `<RequireAuth>` or `<RequireRole role="organizer" | "trainer" | ...>`. Roles in the frontend use lowercase strings (`'organizer'`, `'trainer'`, `'judge'`); the API returns uppercase enum values — translate at the API-client boundary, not in components.

### E2E test pattern

Playwright tests register fresh users via the **API** (`registerUser` → `/auth/register`), seed tokens directly into `localStorage`, then drive the UI. They never go through the login form — keep this pattern when adding new specs so tests stay independent of login UI changes.
