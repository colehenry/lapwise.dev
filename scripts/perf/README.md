# Performance measurement runbook

Step 0 of `docs/performance-optimization-execution-plan.md`. Every measurement
here is read-only and repeatable, so the same commands establish the baseline
and verify each later step.

Record the deployed commit and the Alembic revision (`alembic current`) with
every run. The numbers below were captured against production at `10b4b6d`
with revision `e91f6b7c2a10` applied.

## Command set

| What | Command |
| --- | --- |
| API latency and payload | `npm run perf:api` |
| Route and shared bundle sizes | `npm run perf:bundle` |
| Backend SQL statement counts | `npm run perf:queries` |
| Browser request inventory | `npm run perf:requests` |

### API latency and payload

```bash
PERF_API_KEY=... npm run perf:api -- --base https://api.lapwise.dev --runs 3
PERF_API_KEY=... npm run perf:api -- --season 2026 --round 11 --include-replay
```

Issues GET requests only. Reports median, slowest, and cold values across runs
so no single sample becomes a threshold. Wire size is the compressed byte count
observed on the socket; decoded size is the payload after gzip/brotli.

### Bundle sizes

```bash
npm run perf:bundle                                   # runs the production build
npm run perf:bundle -- --log build.log --json out.json
npm run perf:bundle -- --log build.log --budget scripts/perf/bundle-budget.json
```

`--budget` exits non-zero when shared or per-route first-load JavaScript grows
past the recorded budget. Budgets are introduced with Step 9.

### SQL statement counts

```bash
npm run perf:queries
```

`backend/tests/perf` runs the real services against whatever `DATABASE_URL`
points at and asserts an upper bound on statements per call. With no ingested
sessions — the CI database — the tests skip instead of failing. Budgets live in
`backend/tests/perf/test_query_budgets.py`; lower them in the PR that earns the
reduction, never raise them.

### Browser request inventory

```bash
npm run perf:requests
```

`frontend/test` mounts real client components against a recording `fetch` stub
and asserts which endpoints a route requests before any interaction. These are
the assertions that catch a page silently re-adding an eager request.

## Baseline — 2026-08-03, commit `10b4b6d`

### Shared and route JavaScript

| Measure | First load |
| --- | ---: |
| Shared by all routes | 222 kB |
| `/` | 382 kB |
| `/results/[season]` | 378 kB |
| `/results/[season]/[round]` | 395 kB |
| `/drivers/[driverCode]` | 379 kB |
| `/constructors/[teamName]` | 378 kB |
| `/circuits/[id]` | 372 kB |
| Middleware | 103 kB |

Largest shared chunks: 126 kB, 54.4 kB, and 37.9 kB (Sentry Replay).

### API, production, three runs

| Endpoint | Median | Slowest | Wire | Decoded |
| --- | ---: | ---: | ---: | ---: |
| `/api/results/seasons` | 114 ms | 123 ms | 0.1 KiB | 0.4 KiB |
| `/api/results/latest` | 141 ms | 148 ms | 0.5 KiB | 1.3 KiB |
| `/api/results/2026/standings` | 410 ms | 428 ms | 3.0 KiB | 18.8 KiB |
| `/api/results/2026` | 135 ms | 136 ms | 1.6 KiB | 24.8 KiB |
| `/api/results/2026/1/lap-times` | 235 ms | 254 ms | 42.3 KiB | 480.0 KiB |
| `/api/drivers/` | 244 ms | 264 ms | 35.1 KiB | 314.4 KiB |
| `/api/constructors/` | **1535 ms** | 1549 ms | 7.5 KiB | 64.7 KiB |
| `/api/constructors/Ferrari` | 469 ms | 498 ms | 0.2 KiB | 0.4 KiB |
| `/api/constructors/Ferrari/season-history` | 242 ms | 319 ms | 1.4 KiB | 18.0 KiB |
| `/api/circuits/` | 127 ms | 129 ms | 3.0 KiB | 17.4 KiB |

Every JSON response is gzip encoded at the edge. No public endpoint sends a
`cache-control` header yet.

### SQL statements per uncached service call

| Service call | Statements | After Step 3–4 | Latency | After |
| --- | ---: | ---: | ---: | ---: |
| `CanonicalStandingsService.get_season_standings(2026)` | 31 | **4** | 6.0 s | 2.8 s |
| `ConstructorService.get_all_constructors()` | 204 | **1** | 18.5 s | 0.6 s |
| `ConstructorService.get_constructor_profile("Ferrari")` | 8 | **2** | 2.0 s | 0.8 s |
| `ConstructorService.get_season_history("Ferrari")` | 11 | **4** | 1.8 s | 1.1 s |
| `DriverService.get_all_drivers()` | 1 | 1 | 0.7 s | 0.8 s |
| `DriverService.get_driver_profile("VER")` | 6 | 6 | 1.4 s | 1.4 s |
| `DriverService.get_season_history("VER")` | 7 | 7 | 1.3 s | 1.3 s |
| `CircuitService.get_all_circuits()` | 1 | 1 | 0.5 s | 0.6 s |

Direct-call latency is measured from a development machine to Neon, so it
exaggerates round trips relative to the deployed API. The statement counts are
the durable evidence.

The audit did not cover the constructor list endpoint. It ran one
latest-team-branding query per constructor, which made `/constructors` the
slowest public endpoint at over 1.5 s. Step 3–4 replaced it with a single
`DISTINCT ON` join.

### Home request inventory before any interaction

1. `/api/results/latest`
2. `/api/results/seasons`
3. `/api/results/{season}` (rounds for the selected season)
4. `/api/replay/seasons`
5. `/api/replay/available?season={season}`
6. `/api/replay/{season}/{round}` — full replay blob, 7.95 MiB compressed
7. `/api/results/{year}/standings` — entity link colors
8. `/api/circuits/`
9. `/api/events/upcoming?limit=10`

The current-season standings response is additionally requested a second time
by `useTeamColors` once the AI preview chart becomes visible; the two color
hooks use different query keys for the same resource.

## What is not covered

- No browser automation. Request inventories are asserted in jsdom against real
  client components, not against a live page, so they do not capture Next.js
  prefetch traffic, static asset weight, or Core Web Vitals.
- No staging load test or CDN measurement (Steps 12–14 of the plan).
