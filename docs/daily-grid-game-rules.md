# Daily F1 grid game rules

Purpose: define the player rules, category semantics, board-quality gates, and
product decisions for the Lapwise daily Formula 1 grid. This is the canonical
rule record; implementation plans should link here rather than restating it.

## Status

| Decision area | State | Current decision or exit gate |
|---|---|---|
| Core 3×3 format | Decided | Nine intersections and nine total submissions |
| Answer uniqueness | Decided | A driver may be used once per board |
| Standard cell depth | Decided | At least three valid answers |
| Signature singleton | Decided | One reviewed, famous/iconic singleton may appear per board |
| Constructor semantics | Decided | Exact constructor identities at launch; lineage deferred |
| Category foundation | Decided | Predicates below are enabled individually when data-ready |
| Historical eligibility floor | Open | Choose all-history, 1990+, or board-specific eligibility before launch scheduling |
| Rarity scoring | Open | Decide whether to add it after enough real guesses exist |
| Archive behavior | Open | Decide whether prior boards remain playable |

## Core player rules

- Each daily puzzle is a 3×3 board with three row and three column headers.
- A cell accepts a driver who satisfies both intersecting headers.
- The player has nine total submissions for the entire board.
- A correct submission fills and locks the cell.
- An incorrect submission consumes one submission and leaves the cell empty.
- A driver may be used only once per board, even when eligible for several
  cells.
- The board ends when all nine cells are correct or all submissions are used.
- Search returns canonical drivers and reviewed aliases. A player must select a
  driver record before submitting; an incomplete search does not consume a
  submission.
- The server validates guesses and does not send complete answer sets to the
  client.
- One global puzzle is published daily at 00:00 UTC.
- MVP progress, streak, and share state are local. An account is not required.
- Sharing produces a spoiler-free 3×3 emoji grid, puzzle number, and score.

## Universal answer semantics

### Race participation

Unless a category says otherwise, Formula 1 participation means appearing in
an official World Championship `race` session result. Practice, qualifying, and
sprint participation do not establish an ordinary race answer.

The application must distinguish a race entry/result from a true start.
Categories requiring a start exclude did-not-start and withdrawn statuses
through one shared predicate.

### Sprints

Sprint results count only when a category explicitly mentions sprints. They do
not establish ordinary constructor participation, race wins, podiums, starts,
or venue wins.

### Constructors

Launch categories use exact canonical constructor identities. Rebrands and
franchise successors are not automatically combined.

Examples:

- Renault and Alpine are separate.
- Sauber, BMW Sauber, Alfa Romeo, and Audi are separate.
- Jordan, Force India, Racing Point, and Aston Martin are separate.
- Minardi, Toro Rosso, AlphaTauri, RB, and Racing Bulls are separate.

Lineage categories may be added only after reviewed relationships exist. Their
labels must say that a franchise, rather than an exact constructor, is tested.

### Circuits and venues

Venue categories use the canonical venue, not an individual layout. A win on
any reviewed Silverstone layout satisfies “Won at Silverstone.” A
layout-specific category must say so explicitly.

### Historical snapshots

Each published puzzle stores its category versions and accepted driver IDs.
Later corrections can be annotated, but an old puzzle must not silently change
under completed results.

## Board-quality rules

### Standard cells

The default minimum is three valid drivers per cell after applying the board's
eligibility policy.

A two-answer cell is rejected. It offers neither the flexibility of a standard
cell nor the deliberate reveal of a signature singleton.

### Signature singleton

At most one cell per board may have exactly one accepted driver. It is manually
approved; the generator cannot allow it merely because an intersection is
sparse.

The unique answer must pass at least one recognition gate:

- world champion;
- at least 10 Formula 1 race wins; or
- a manually documented iconic driver or moment.

Driver fame alone is insufficient. The relationship expressed by the headers
must also be fair and discoverable.

The puzzle stores the featured driver, a short reason, reviewer, review time,
and immutable answer snapshot. Singletons cannot depend on a changing
current-season fact and should be play-tested before publication.

### Repetition and difficulty

- Do not repeat an exact row/column intersection within 30 published days.
- Avoid repeating a header within approximately five to seven days.
- Reject boards whose answer sets are near-identical to a recent board.
- Difficulty considers answer counts, name recognition, era, and predicate
  complexity.
- Pre-generate a rolling reviewed schedule so a source outage cannot stop the
  daily puzzle.

## Accepted category predicates

Every predicate is versioned in the backend category service and remains
disabled until its coverage and tests pass.

### Available from current results data

- **Exact constructor:** appeared in at least one race result for that canonical
  constructor.
- **Named teammate:** both drivers appeared for the same exact constructor in
  the same race session.
- **Used car number N:** `driver_seasons.driver_number = N` in at least one
  season. This does not imply a permanent career number.
- **Debuted in decade:** decade of the driver's earliest World Championship
  race result.
- **World champion:** position 1 in canonical final driver standings.
- **Race winner:** finished position 1 in a race session.
- **Podium finisher:** finished position 1, 2, or 3 in a race session.
- **Pole sitter:** finished position 1 in qualifying; race-grid P1 is not a
  substitute.
- **Won with multiple constructors:** race wins for at least two exact canonical
  constructors.
- **Raced across regulation eras:** race results in at least two named,
  versioned era ranges. Boundaries must be approved before enabling it.
- **Sprint winner:** finished position 1 in a `sprint_race` session.
- **Won from outside the top five:** won with `grid_position >= 6`.
- **Won at venue:** won a race at the canonical venue.
- **Raced at a currently defunct venue:** raced at a venue absent from the
  puzzle publication season's scheduled race calendar.
- **Raced in decade:** has a race result during the named decade.
- **100+ race entries:** has at least 100 rows under the shared race-entry
  predicate.

### Available from enriched driver data

- **Nationality:** `drivers.country_code` equals the canonical nationality
  code. A missing value makes a driver ineligible for that category, not a
  negative answer. The reviewed backfill completed on 2026-08-05 with full
  coverage of the post-1990 and post-2000 game pools.

### Deferred enrichment

- **Constructor franchise/lineage:** FastF1 constructor IDs do not provide
  predecessor/successor history.
- Season-specific sporting nationality.
- Historical fastest laps, because the current flag has no pre-2018 coverage.
- All-era telemetry, tyre, pit-stop, and race-control categories because those
  sources begin later than race results.

## Dynamic categories

“Currently defunct venue” uses the full scheduled race calendar for the
puzzle's publication season, including future rounds. The value is frozen with
the puzzle. A later return does not invalidate an old answer.

Other current-season categories must declare when their answers freeze. Do not
publish them before the relevant session or championship fact is final.

## Search and aliases

- Search keys are canonical driver ID/slug and full name.
- Reviewed aliases may include nicknames, common short names, diacritic-free
  forms, and historical display names.
- Driver abbreviations and car numbers assist search but never resolve identity.
- Ambiguous aliases display candidates rather than selecting automatically.
- Selecting an already-used driver is blocked before submission and does not
  consume a guess.

## Scoring and sharing

MVP score is correct cells out of nine. The share grid distinguishes correct
and missed cells without revealing driver names.

Rarity scoring is deferred until enough real submissions exist to avoid noisy
or manipulated percentages. If added, anonymous duplicate play must be
controlled and percentages use the frozen answer set.

## Data-readiness gates

Framework development may begin with exact-constructor, decade, achievement,
venue, teammate, and car-number predicates.

Before any production board is generated or frozen:

- repair the Jack Doohan/Robert Doornbos identity misassignment and add a
  regression check;
- run canonical identity and database audits;
- make every enabled category report coverage and source boundaries;
- prove each standard cell has at least three accepted answers;
- manually review every singleton; and
- freeze category versions and answer IDs.

Nationality headers are enabled from the canonical driver field after the
completed backfill. Constructor lineage and owned driver photos are not launch
blockers.

## Open decisions

- Choose the default historical eligibility policy. A 1990 floor gives a
  205-driver pool; all-history enables more legends but raises difficulty. The
  policy may instead be explicit per board.
- Decide whether prior puzzles remain playable.
- Decide whether completion reveals every accepted answer or only popular ones.
- Decide whether a missed singleton gets a special reveal.
- Define and name regulation-era boundaries.
- Decide when rarity scoring and server-side anonymous play records begin.

## Completion gate

The rules are launch-ready when open launch decisions are resolved, enabled
predicates have tested canonical definitions, search and duplicate rules are
consistent, board validation enforces the three-answer default and reviewed
singleton exception, and published puzzles preserve immutable answer snapshots.
