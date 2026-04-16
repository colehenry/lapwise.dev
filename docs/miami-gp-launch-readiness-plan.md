# Miami GP Launch Readiness Plan

Target launch window: Miami Grand Prix weekend, May 1-3, 2026.

Current planning date: April 15, 2026.

Goal: get Lapwise ready for real social traffic, new accounts, mobile-first users, and public beta usage before Miami GP.

## Launch Verdict

- [ ] Treat the Miami GP push as a public beta launch, not a fully hardened v1 launch.
- [ ] Make the homepage and mobile experience point users toward current race-weekend jobs.
- [ ] Harden account, API, AI, moderation, monitoring, and backup paths before starting larger social promotion.
- [ ] Position the product around explainable F1 data: race arguments answered with charts, replay, AI, and receipts.

## Verified Baseline

- [x] Frontend production build passes with `npm run build` in `frontend/`.
- [x] Backend test suite passes with `./venv/bin/python -m pytest -q` in `backend/`.
- [x] Account flows exist: register, login, refresh tokens, logout, email verification, password reset.
- [x] Passwords are hashed and access tokens are short-lived.
- [x] Refresh tokens are stored as hashes and rotated.
- [x] Admin-only backend dependencies exist for protected admin endpoints.
- [x] Mobile bottom dock exists and gives the site a usable mobile navigation foundation.

## P0: Security And Abuse Controls

These should be handled before public marketing begins.

- [x] Stop treating `NEXT_PUBLIC_API_KEY` as a secret in code/docs.
  - Acceptance: document that the public API key is only a light traffic filter.
  - Acceptance: expensive endpoints have real rate limits, auth gates, caching, or server-side controls.
  - Relevant files:
    - `frontend/lib/api.ts`
    - `backend/app/security.py`

- [ ] Configure production-grade shared rate limiting.
  - [ ] Acceptance: `RATE_LIMIT_STORAGE_URL` is set in production to a shared backend such as Redis.
  - [x] Acceptance: backend limiter uses the configured shared storage when present.
  - [x] Acceptance: login, registration, password reset, resend verification, discussions, votes, and AI routes have appropriate limits.
  - Relevant files:
    - `backend/app/limiter.py`
    - `backend/app/routers/auth.py`
    - `backend/app/routers/posts.py`

- [x] Fix trusted client IP handling.
  - Acceptance: the app uses one trusted proxy-aware client IP helper.
  - Acceptance: raw user-controlled `x-forwarded-for` is not trusted unless added by known infra.
  - Acceptance: rate limiting and login-history tracking use the same canonical IP.
  - Relevant files:
    - `backend/app/routers/auth.py`
    - `backend/app/limiter.py`

- [ ] Harden AI usage limits before promoting Clutch.
  - [x] Acceptance: AI query counters update atomically.
  - [ ] Acceptance: limits reset on an intentional schedule or are renamed to reflect total lifetime limits.
  - [x] Acceptance: per-user and per-IP throttles exist.
  - [ ] Acceptance: monthly AI spend cap and alerting exist.
  - [x] Acceptance: users see clear remaining usage.
  - Relevant files:
    - `frontend/app/api/ai/ask/route.ts`
    - `frontend/app/ask/AskContent.tsx`

- [ ] Harden AI database query execution.
  - [ ] Acceptance: AI DB role is read-only and cannot access user/auth/community tables.
  - [x] Acceptance: query timeout is set for AI queries.
  - [x] Acceptance: SQL row limits cannot be bypassed with expensive queries.
  - [x] Acceptance: schema access is limited to approved F1 data tables.
  - [x] Acceptance: failed or timed-out queries produce friendly answers.
  - Relevant files:
    - `frontend/lib/ai/db.ts`
    - `frontend/lib/ai/tools.ts`

- [ ] Add basic bot and abuse controls for account creation.
  - [x] Acceptance: registration has a captcha, turnstile, email reputation check, or equivalent friction.
  - [x] Acceptance: duplicate account bursts from one IP are slowed.
  - [ ] Acceptance: disposable email handling is considered or documented.
  - Relevant files:
    - `backend/app/routers/auth.py`
    - `frontend/app/register/page.tsx`

- [x] Add community write-path rate limits.
  - Acceptance: post creation is rate-limited.
  - Acceptance: comment creation is rate-limited.
  - Acceptance: vote toggling is rate-limited.
  - Acceptance: edit/delete endpoints are protected from spam bursts.
  - Relevant files:
    - `backend/app/routers/posts.py`

## P0: Production Operations

- [ ] Add error monitoring.
  - Acceptance: frontend runtime errors are captured.
  - Acceptance: backend exceptions are captured.
  - Acceptance: source maps are configured safely.
  - Acceptance: alerts route somewhere the maintainer will see quickly.

- [ ] Add uptime monitoring.
  - Acceptance: `/health` is checked externally.
  - Acceptance: login and registration smoke checks exist.
  - Acceptance: latest race data endpoint is checked.
  - Acceptance: AI route health or quota-safe smoke check exists.

- [ ] Verify database backups.
  - Acceptance: automated backups are enabled.
  - Acceptance: one restore test has been completed.
  - Acceptance: restore steps are documented.
  - Acceptance: migration rollback policy is documented.

- [ ] Add deployment checklist.
  - Acceptance: production env vars are listed without secret values.
  - Acceptance: migration order is documented.
  - Acceptance: build and backend test commands are documented.
  - Acceptance: rollback steps are documented.

- [ ] Add launch dashboard.
  - Acceptance: active users, signups, API errors, AI queries, and DB CPU/connections are visible.
  - Acceptance: 429s and 5xxs can be monitored during Miami weekend.

## P1: Account And Trust

- [ ] Run full production account smoke test.
  - Acceptance: create account with email/password.
  - Acceptance: receive verification email.
  - Acceptance: verify email.
  - Acceptance: log in.
  - Acceptance: refresh session after page reload.
  - Acceptance: reset password.
  - Acceptance: log out.
  - Acceptance: delete or deactivate test account.

- [ ] Run full Google OAuth production smoke test.
  - Acceptance: sign up with Google.
  - Acceptance: login with Google.
  - Acceptance: link Google to an existing account.
  - Acceptance: handle username picker flow.
  - Acceptance: verify correct redirect after auth.

- [ ] Add Terms and Privacy pages.
  - Acceptance: footer links exist.
  - Acceptance: registration links to terms/privacy.
  - Acceptance: privacy page covers account data, analytics, AI usage, cookies, and contact.

- [ ] Add user support path.
  - Acceptance: support email or contact form exists.
  - Acceptance: users can report account/login issues.
  - Acceptance: support contact appears in auth-related error pages.

- [ ] Improve protected route UX.
  - Acceptance: unauthenticated protected pages clearly ask users to log in.
  - Acceptance: logged-in cookie middleware is documented as UX only, not security.
  - Acceptance: admin pages do not reveal sensitive data before backend authorization.
  - Relevant file:
    - `frontend/middleware.ts`

## P1: Moderation And Community Safety

- [ ] Add report/flag flow for posts and comments.
  - Acceptance: users can report a post.
  - Acceptance: users can report a comment.
  - Acceptance: reports are visible to admins.
  - Acceptance: admins can resolve or dismiss reports.

- [ ] Add admin moderation controls.
  - Acceptance: admins can hide posts.
  - Acceptance: admins can hide comments.
  - Acceptance: admins can deactivate abusive users.
  - Acceptance: moderation actions are auditable.

- [ ] Add public community rules.
  - Acceptance: rules page or pinned post exists.
  - Acceptance: post composer links to rules.
  - Acceptance: rules cover spam, harassment, spoilers, self-promotion, and data/source expectations.

- [ ] Seed high-quality launch discussions.
  - Acceptance: at least 10 strong posts exist before public launch.
  - Acceptance: several posts include embedded charts or tables.
  - Acceptance: at least one pinned Miami GP thread exists.

## P1: Mobile First-Time User Experience

- [ ] Reframe homepage around current race-weekend jobs.
  - Acceptance: mobile first screen answers "what should I do here?"
  - Acceptance: primary actions include Latest Race, Miami GP Hub, Ask Clutch, Replay, and Driver comparison.
  - Acceptance: "Explore the archive" is still available but not the primary mobile story.
  - Relevant file:
    - `frontend/app/page.tsx`

- [ ] Create a Miami GP hub.
  - Acceptance: page includes schedule.
  - Acceptance: page includes track map and circuit profile.
  - Acceptance: page includes 2025 Miami recap.
  - Acceptance: page includes current driver/team form.
  - Acceptance: page includes strategy, tire, overtaking, and safety car history if data is available.
  - Acceptance: page includes discussion and Ask Clutch prompts.

- [ ] Make mobile navigation race-weekend biased during launch.
  - Acceptance: one-tap path to Miami GP Hub or Latest Race exists.
  - Acceptance: bottom dock labels are understandable to first-time users.
  - Acceptance: account/login is easy to find from mobile.
  - Relevant file:
    - `frontend/components/Navigation.tsx`

- [ ] Audit mobile layouts on real widths.
  - Acceptance: iPhone Safari works at 375px.
  - Acceptance: Android Chrome works at 360px.
  - Acceptance: no horizontal overflow on key pages.
  - Acceptance: bottom dock does not cover critical buttons.
  - Acceptance: long driver/team names do not break layouts.

- [ ] Improve loading and error states.
  - Acceptance: homepage modules have stable skeletons.
  - Acceptance: failed data modules show useful fallback states.
  - Acceptance: API errors do not leave blank sections.

## P1: Product Positioning

- [ ] Adopt a sharper launch message.
  - Proposed message: "Turn F1 race arguments into answers with charts, replay, AI, and receipts."
  - Acceptance: homepage copy reflects the data-and-explanation advantage.
  - Acceptance: social bio and pinned post use the same message.

- [ ] Define the main launch use cases.
  - [ ] Latest race aftermath: "What actually happened?"
  - [ ] Driver/team comparisons: "Who is faster, and where?"
  - [ ] Shareable social graphics from charts.
  - [ ] Replay of key battles.
  - [ ] Natural-language F1 questions through Clutch.

- [ ] Make account creation valuable.
  - Acceptance: signup has a clear reason beyond "join discussion."
  - Acceptance: users can set favorite driver/team/circuit.
  - Acceptance: favorite selections personalize a page or prompt.
  - Acceptance: account benefits mention saved chats, discussions, favorites, and higher AI limits if applicable.

## P1: Social And Shareability

- [ ] Add shareable chart cards.
  - Acceptance: key charts have a share/export path.
  - Acceptance: exported visuals include Lapwise branding.
  - Acceptance: chart cards are readable on mobile social feeds.

- [ ] Add Open Graph images and metadata for key pages.
  - Acceptance: homepage has a strong OG image.
  - Acceptance: Miami GP hub has a strong OG image.
  - Acceptance: driver pages have meaningful metadata.
  - Acceptance: latest race pages have meaningful metadata.

- [ ] Prepare social launch content.
  - Acceptance: 10 chart-based posts are drafted.
  - Acceptance: 5 Miami-specific posts are drafted.
  - Acceptance: 5 Clutch question examples are drafted.
  - Acceptance: every post links to a relevant page, not just the homepage.

- [ ] Create landing paths for social posts.
  - Acceptance: posts about Miami link to Miami GP Hub.
  - Acceptance: posts about a driver link to driver page or comparison.
  - Acceptance: posts about race strategy link to result/replay/AI prompt.

## P2: SEO And Discoverability

- [ ] Add canonical pages for race weekend content.
  - Acceptance: Miami GP page has stable URL.
  - Acceptance: latest race recap has stable URL.
  - Acceptance: sitemap includes key public pages.
  - Acceptance: robots settings are intentional.

- [ ] Improve metadata.
  - Acceptance: page titles are specific.
  - Acceptance: descriptions are user-facing and search-friendly.
  - Acceptance: social previews work in link preview tools.

- [ ] Add structured content for archive pages.
  - Acceptance: driver pages include clear career summaries.
  - Acceptance: constructor pages include clear summaries.
  - Acceptance: circuit pages include clear summaries and latest event links.

## P2: Data Freshness And Race Weekend Workflow

- [ ] Define data ingestion timing.
  - Acceptance: known process for ingesting practice, qualifying, sprint, and race data.
  - Acceptance: expected delay after each session is documented.
  - Acceptance: failed ingestion alert exists.

- [ ] Add admin data freshness indicators.
  - Acceptance: admin can see latest ingested session.
  - Acceptance: admin can see missing sessions.
  - Acceptance: admin can trigger or document ingestion steps.

- [ ] Prepare Miami weekend operating checklist.
  - Acceptance: FP1/FP2/FP3 post-session tasks listed.
  - Acceptance: qualifying post-session tasks listed.
  - Acceptance: race post-session tasks listed.
  - Acceptance: social publish checklist listed.

## P2: Monetization Planning

Do not block Miami launch on this, but start designing the product so monetization feels natural later.

- [ ] Define free vs paid boundaries.
  - Possible free: archive, latest race, limited AI, public discussions.
  - Possible paid: more AI queries, saved dashboards, advanced telemetry, export tools, race weekend data packs.

- [ ] Explore creator tools.
  - Acceptance: roadmap includes branded chart export.
  - Acceptance: roadmap includes embeddable charts or widgets.
  - Acceptance: roadmap includes share templates for newsletters/social creators.

- [ ] Explore paid Race Weekend Pro.
  - Possible features:
    - advanced telemetry comparisons
    - strategy reports
    - downloadable charts
    - personalized favorite-driver recaps
    - post-race data pack

- [ ] Explore API/data access.
  - Acceptance: document which data could be exposed commercially.
  - Acceptance: document rate limits and licensing concerns.
  - Acceptance: separate public frontend API needs from future paid API design.

## Suggested Timeline

### April 15-18: Security And Reliability

- [ ] Public API key assumptions documented and mitigated.
- [ ] Shared rate limiting configured.
- [ ] Trusted IP handling fixed.
- [ ] AI quotas and spend controls hardened.
- [ ] Monitoring and uptime checks configured.
- [ ] Database backups verified.

### April 19-22: Accounts, Trust, Moderation

- [ ] Production auth smoke tests complete.
- [ ] Google OAuth smoke tests complete.
- [ ] Terms and Privacy pages added.
- [ ] Support path added.
- [ ] Report/flag flow added or minimally scoped.
- [ ] Admin moderation controls added or minimally scoped.
- [ ] Launch discussions seeded.

### April 23-26: Mobile And Product Experience

- [ ] Homepage reframed around race-weekend use.
- [ ] Miami GP hub shipped.
- [ ] Mobile navigation reviewed.
- [ ] Mobile layout audit complete.
- [ ] Loading and error states improved.
- [ ] Account onboarding value clarified.

### April 27-30: Content And Launch Assets

- [ ] Social posts drafted.
- [ ] Shareable chart cards or screenshots prepared.
- [ ] OG metadata checked.
- [ ] Miami-specific Clutch prompts prepared.
- [ ] Race weekend operating checklist finalized.

### May 1-3: Miami GP Weekend

- [ ] Pin Miami GP Hub.
- [ ] Publish session recaps quickly after each session.
- [ ] Promote Ask Clutch prompts tied to live storylines.
- [ ] Watch errors, rate limits, signup conversion, AI spend, and DB load.
- [ ] Capture user feedback and bug reports.

## Key Product Bet

- [ ] Build toward Race Rooms for each Grand Prix.
  - Before race: track history, tire degradation, safety car history, overtaking, form.
  - During weekend: session results, quick charts, discussion prompts.
  - After race: recap, replay, biggest movers, strategy winners and losers.
  - Share: chart cards and links that make social posts useful.

## Launch Decision Checklist

Use this before turning on serious marketing.

- [ ] Can a new user sign up, verify email, log in, and use the site without help?
- [ ] Can a mobile user understand the site in the first 10 seconds?
- [ ] Can the site survive a social traffic spike without expensive endpoint abuse?
- [ ] Can AI costs be capped before they become painful?
- [ ] Can abusive posts/comments/users be handled quickly?
- [ ] Can errors be seen without manually checking logs?
- [ ] Can the database be restored if something goes wrong?
- [ ] Does every social post send users to a relevant destination?
- [ ] Does the product clearly communicate why it is different from stats archives, news sites, and Reddit?
