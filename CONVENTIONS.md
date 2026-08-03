# Engineering conventions

Durable rules for lapwise.dev. `[CI]` is machine-blocking; `[review]` requires
review judgment; `[agent]` governs coding agents. Keep this file and `AGENTS.md`
aligned.

## Principles and workflow

- **G-1 `[review]`** The database is the source of truth and the API is the
  product. Clients do not hardcode changing domain data.
- **G-2 `[review]`** Raw ingested tables are canonical and never hand-edited;
  derived data must be rebuildable.
- **G-3 `[review]`** Prefer simple, intentional solutions for the product's real
  scale. Delete dead code and document deliberate exceptions.
- **WF-1 `[review]`** Direct commits and pushes to `dev` are allowed; `main`
  deploys to production.
- **WF-2 `[CI]`** Changes reach protected `main` only through a PR with green CI.
- **WF-3 `[agent]`** Preserve unrelated work. The user owns commit wording; add
  no AI attribution. Keep one logical change per PR.
- **WF-4 `[review]`** Never commit secrets, environment files, dumps, keys, or
  tokens. `NEXT_PUBLIC_*` values are intentionally public.

## Frontend

- **FE-1 `[review]`** Use the App Router. Default to Server Components; add
  `"use client"` only for client APIs, hooks, events, or React Query.
- **FE-2 `[CI]`** Route/component files target 400 and cap at 600 lines;
  `lib`/`hooks` cap at 300. Existing oversized files may not grow. Extract by
  responsibility, not formatting tricks.
- **FE-3 `[review]`** Reuse `components/ui`, `chart-primitives.tsx`, and
  `chart-utils.ts` rather than duplicating primitives or chart behavior.
- **FE-4 `[CI]`** UI chrome uses semantic tokens—no inline hex. F1 domain colors
  come from shared constants or database-backed team colors.
- **FE-5 `[review]`** API access uses `lib/api`, React Query, and `X-API-Key`.
  Keep API response types centralized and separate from view-model types.
- **FE-6 `[review]`** Images require `alt`; SVGs require accessible titles.

## Backend

- **BE-1 `[review]`** Routers handle HTTP only; services own queries and business
  logic; models and Pydantic schemas stay in their respective layers.
- **BE-2 `[review]`** Database request paths are async. Every endpoint is
  server-authenticated; admin routes use the admin dependency. Only `/` and
  `/health` may be public.
- **BE-3 `[CI]`** Services cap at 600 lines and routers at 300.
- **BE-4 `[review]`** Functions target 60 and should not exceed 100 lines.
- **BE-5 `[review]`** Request/response bodies use Pydantic schemas. Services take
  explicit dependencies and remain independently testable.

## Data and ingestion

- **DB-1 `[review]`** Schema changes use reviewed Alembic migrations. Use
  `snake_case`, `*_at` timestamps, `is_*`/`has_*` booleans, and `agg_*` for
  derived tables. Neon connections use the pooler plus `?sslmode=require`.
- **DB-2 `[review]`** Add `agg_*` only for expensive, frequent, slow-changing
  queries. Aggregates are fully rebuildable, never hand-edited, refreshed after
  ingestion, carry `refreshed_at`, and are read directly in hot paths.
- **DB-3 `[review]`** Changing F1 data—lineups, media URLs, availability—belongs
  in the database. Small stable references may live in one shared constant.

## AI and security

- **AI-1 `[review]`** Clutch/text-to-SQL runs in Next.js; race summaries run in
  the backend. Do not add a third AI boundary without documenting it.
- **AI-2 `[review]`** AI database access is read-only and cannot reach community
  or auth tables. Generated SQL always passes validation, row limits, and query
  timeouts. Schema knowledge has one maintained source.
- **AI-3 `[review]`** Preserve AI spend caps and user/IP throttles.
- **SEC-1 `[review]`** Frontend middleware is UX-only; authentication is enforced
  server-side. Preserve rate limits, CSP/HSTS/frame protections, and Sentry error
  reporting. New external origins require explicit CSP updates.

## Quality, documentation, and operations

- **T-1 `[CI]`** Backend pytest, frontend Vitest, Biome, Ruff, migrations, and
  the production frontend build must pass. Bug fixes and extracted pure logic
  get regression tests; visual tests are added only where valuable.
- **OBS-1 `[CI]`** Use structured logging: no `print()` in `backend/app` and no
  committed `console.log`/`warn`/`error` in frontend source.
- **DOC-1 `[review]`** Comments capture non-obvious constraints, not narration or
  change history. Add standalone docs only when requested and keep governance
  docs current.
- **OPS-1 `[review]`** Backend deploys to Railway and frontend to Netlify from
  `main`. Validate migrations before dependent code and retain rollback paths.

## Enforcement and existing debt

GitHub CI blocks on three jobs: frontend lint/tests/build; backend
Ruff/migrations/pytest; and repository guardrails plus their tests. Branch
protection applies to `main` and administrators; force pushes and deletions are
disabled. `dev` intentionally permits direct pushes.

`npm run guardrails` blocks new/increased size debt, unapproved hex, backend
`print()`, and frontend debug consoles. `npm run guardrails:update` is
downward-only. Existing oversized files and the 400-line frontend target remain
report-only; the refactor sequence is in
`docs/oversized-components-refactor-plan.md`.

Endpoint-auth coverage, function length, generated API-type staleness, derived
table rebuild coverage, secret scanning, and attribution are review-enforced
until automated.
