# Agent essentials

- Preserve unrelated working-tree changes. Do not commit, push, merge, or
  rewrite history unless explicitly asked.
- Direct commits and pushes to `dev` are allowed. Production changes reach
  `main` only through a PR with green CI; never push directly to `main`.
- Frontend: routes in `frontend/app`, shared UI in `frontend/components`, and
  reusable data logic in `frontend/lib` or `frontend/hooks`. Reuse UI/chart
  primitives and semantic color tokens.
- Backend: routers handle HTTP; services own database access and business logic.
  Raw ingested data is canonical; schema changes use reviewed Alembic migrations.
- Size limits: frontend routes/components target 400 and cap at 600 lines;
  frontend `lib`/`hooks` and backend routers cap at 300; backend services cap at
  600. Grandfathered files must not grow—extract a real responsibility.
- Never raise `scripts/guardrails-baseline.json`. Run `npm run guardrails:update`
  only after guardrails pass, to lock in reductions.
- No `print()` in `backend/app`, frontend debug `console.*`, hardcoded UI hex,
  secrets, dead code, or AI attribution in git history.
- Run focused checks while working and `npm run check` before push-ready handoff.
  Report anything that could not run. The user owns commit-message wording.

Consult only the relevant section of `CONVENTIONS.md` for database/ingestion,
AI/SQL, auth/security, deployment, or governance work; this file is sufficient
for routine changes.
