# Daily F1 grid game rules

Purpose: define the player rules, category semantics, board-quality gates, and
product decisions for the Lapwise daily Formula 1 grid. This is the canonical
rule record; implementation plans should link here rather than restating it.

## Status

| Decision area | State | Current decision or exit gate |
|---|---|---|
| Core 3×3 format | Decided | Nine intersections and twelve total submissions |
| Answer uniqueness | Decided | A correctly placed driver may be used once per board |
| Standard cell depth | Decided | Three answers by default; two allowed when both clear the recognition floor |
| Signature singleton | Decided | One reviewed, famous/iconic singleton may appear per board |
| Constructor semantics | Decided | Exact constructor identities at launch; lineage deferred |
| Category foundation | Decided | Predicates below are enabled individually when data-ready |
| Historical eligibility floor | Decided | 1990+ by default, overridable per board |
| Rarity scoring | Open | Add once session records hold enough real guesses |
| Archive behavior | Decided | Prior boards remain playable with previous/next navigation |
| Rookie Mode | Decided | Eight options per cell; a decoy fails exactly one header |
| Category evidence | Decided | Predicates return resolved facts, shown only after a guess |
| Timed play | Decided | Server-authoritative clock; headers hidden until the start sequence |
| Guess reversal | Decided | Rejected; a placement is final |
| Board exits | Decided | Nine correct, twelve submissions used, or voluntary retirement |
| Race time | Decided | Elapsed wall clock plus five seconds per miss |
| Classification | Decided | Only a nine-cell board is classified; all others are DNF |
| Leaderboards | Decided | One per puzzle per mode, daily, ranked among signed-in players |
| Championship | Decided | Daily race, monthly season, percentile points frozen at 07:00 UTC |
| Play session records | Decided | Server-side; supersedes the local-only MVP progress model |
| Publication cadence | Decided | Daily year-round; race weekends themed, not exclusive |
| Board approval | Decided | Human approves and dates a board; the date gate publishes it |

## Core player rules

- Each daily puzzle is a 3×3 board with three row and three column headers.
- A cell accepts a driver who satisfies both intersecting headers.
- The headers are concealed until the player starts the board. Starting runs a
  five-light sequence; the headers appear and the clock starts at lights out.
- The player has twelve total submissions for the entire board.
- A correct submission fills and locks the cell permanently. A placement cannot
  be reversed, and no mechanism trades a submission for an empty cell.
- An incorrect submission consumes one submission, adds a five-second penalty,
  and leaves the cell empty.
- An incorrect cell shakes, and hovering it lists the drivers already tried for
  that intersection.
- A correctly placed driver may be used only once per board, even when eligible
  for several cells. An incorrect guess remains available for another cell.
- The board ends on one of three exits: all nine cells correct, all twelve
  submissions used, or voluntary retirement.
- Search returns canonical drivers and reviewed aliases. A player must select a
  driver record before submitting; an incomplete search does not consume a
  submission.
- The server validates guesses and does not send complete answer sets to the
  client.
- One global puzzle is published daily at 07:00 UTC.
- An account is not required to play, to be timed, or to share. It is required
  to appear on a leaderboard and to score championship points.
- The server records a play session per board and mode. Local storage keeps the
  board state the player sees; the server holds the clock and the result.
- Previous and next links move between published grids. Completed links are
  marked, and a restart control clears only the active grid's local progress.
- Sharing is spoiler-free and never contains a driver name.

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

### Eligibility policy

A board's eligibility floor is 1990 by default: only drivers with a World
Championship race result from 1990 onward are accepted answers or decoys. That
is a 205-driver pool, and it is the era the site's own lap data now covers
after the 1996–2017 backfill, so a revealed driver leads to a populated page
rather than an empty one.

The floor is a per-board value, not a global constant. A board may set an
earlier floor to run a deliberate classics grid. The floor is frozen with the
board and applied before every answer set is materialized, so a later change to
the default cannot alter a published board.

The five sandbox boards predate this decision and were authored with no floor.
Re-materialized at 1990 they keep at least three answers everywhere except
grid-004, which gains two two-answer cells. Both clear the two-answer gate
below, so all five boards remain valid at the 1990 floor and are re-frozen
there rather than kept as all-history.

Re-freezing is not optional bookkeeping. A board whose stored floor does not
match the answers frozen under it is lying about its own contents, and its
Rookie option lists would be drawn from a pool the board no longer uses.

### Standard cells

The default minimum is three valid drivers per cell after applying the board's
eligibility policy. Aim for three; the exceptions below are exceptions.

### Two-answer cells

A two-answer cell is allowed when both of its answers are recognisable. Depth
is a proxy for fairness, not the thing itself: a cell offering Prost or Alesi
is kinder than one offering three drivers nobody can name.

Both answers must clear the **recognition floor**:

- world champion; or
- at least 5 Formula 1 race wins; or
- at least 100 race entries.

At least one answer must additionally clear the **anchor gate**:

- world champion; or
- at least 10 Formula 1 race wins.

The floor is what stops a two-answer cell being two obscure names. The anchor
is what guarantees a route in for a player who knows only the famous era of
that intersection. All three floor tests are already shipped predicates, so
this needs no new category work.

At most two two-answer cells per board. A board carrying a signature singleton
may carry none, because one deliberately thin cell per board is the budget.

Where two thin cells share an answer, the board is tighter than its depths
suggest: spending the shared driver in one cell narrows the other. This is
legal and is part of the planning the board is testing, but the validator must
report it, because a board can pass every depth check and still play as though
it has a singleton.

Board solvability is a separate requirement from depth. Under the
one-driver-per-board rule, a board is only completable if a distinct driver can
be assigned to all nine cells at once. The validator checks that a perfect
assignment exists rather than inferring it from cell counts.

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

- Every board includes at least one secondary category beyond constructor,
  nationality, and raced-in-decade.
- Do not repeat the same structural template on consecutive boards. Constructor
  headers may appear on rows or columns, and a board may use zero, one, or two.
- Flag identical or near-identical answer sets within the same board for manual
  review.
- Do not repeat an exact row/column intersection within 30 published days.
- Avoid repeating a header within approximately five to seven days.
- Reject boards whose answer sets are near-identical to a recent board.
- Difficulty considers answer counts, name recognition, era, and predicate
  complexity.
- Pre-generate a rolling reviewed schedule so a source outage cannot stop the
  daily puzzle.

Six headers a board against a five-to-seven-day no-repeat window means at least
42 distinct headers must be usable in any week, and two to three times that
before the schedule stops feeling repetitive. The predicate resolvers are what
answer how many headers actually clear a three-deep intersection at the board's
eligibility floor. If the usable count is tight, themed boards are the relief
rather than the strain: they draw on venue and nationality headers that
otherwise sit idle.

## Publication cadence

One board a day, every day, including the off-season. The daily habit is the
product. A weekly puzzle cannot build one, and a puzzle that runs only on race
weekends trains players to forget it in the gap and goes dark for the months
between seasons.

### Rollover hour

Boards turn over at 07:00 UTC, worldwide and simultaneously.

The rollover is one fixed hour rather than each viewer's local midnight, which
is what Wordle and the NYT puzzles use. Local midnight is better for a purely
solitary puzzle, but a leaderboard needs one field racing one board over one
window, and a locally-rolling board spreads a single day's field across some
fifty hours and leaks results across time zones.

07:00 UTC rather than 00:00 UTC because midnight UTC lands in the middle of the
American evening — the board would change under a player at 8pm Eastern, and a
board labelled the 8th would appear on the 7th for most of the Americas. At
07:00 UTC the change falls in Europe's early morning, between late evening and
the small hours across the Americas, and only Asia-Pacific sees it mid-
afternoon. No large market has the board swap mid-session.

This is a single constant, `PUZZLE_ROLLOVER_UTC_HOUR`, and the decision should
be revisited once analytics show where players actually are. It is a guess
until then; the point of keeping it in one place is that the guess is cheap to
correct.

Race weekends are themed rather than exclusive. Friday, Saturday and Sunday of
a Grand Prix weekend carry at least one header tied to that race — its venue,
its country, or a constructor with a history there. This needs no new
predicate: won-at-venue and nationality already exist, so a theme is a
constraint on the generator and a tag on the scheduled board.

The Sunday board publishes alongside the race and its completion screen links
to that race's page, which is the intended route from the game into the rest of
the site.

Between seasons the same mechanism carries themed weeks — champions, one-hit
wonders, a decade in review. A theme is a header constraint, so it costs
scheduling attention rather than new code, and it is what keeps February from
being dead air.

A theme never overrides board quality. A themed board that cannot meet the
three-answer floor or the repetition windows is rejected like any other.

## Approval and scheduling

A board holds one of three states. `draft` is a generator proposal. `approved`
is reviewed but not yet dated. `published` is approved and carries the date it
runs on.

A board is served when it is published and its date has arrived. A published
board dated in the future is scheduled, not live.

That gate is the whole publication mechanism. Approving a board with tomorrow's
date is what schedules it, and it becomes playable at 07:00 UTC on its date
with nothing running to make that happen. There is no publish job to fail, and
the queue can sit thirty days ahead without exposing anything.

One board may be published per date. A second board claiming a taken date fails
at approval rather than producing two grids for the same day.

The reviewer sees, for each proposal, a preview of the grid, the answer depth
of every cell, weak-cell flags, and a difficulty score, and orders the queue by
hand. A generator proposes; it never publishes.

## Accepted category predicates

Every predicate is versioned in the backend category service and remains
disabled until its coverage and tests pass.

### Available from current results data

- **Exact constructor:** appeared in at least one race result for that canonical
  constructor.
- **Named teammate:** both drivers appeared for the same exact constructor in
  the same race session.
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

- Car-number categories are excluded from the game; historical allocations are
  technically available but feel arbitrary and create thin intersections.
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
- Selecting a driver already placed correctly is blocked before submission and
  does not consume a guess. Incorrectly guessed drivers remain selectable.
- Selecting a cell opens the driver search directly over the board. Clicking
  outside it, choosing another cell, or pressing Escape dismisses it.

## Rookie Mode

An alternative to typing a driver name, for players who do not know the
history. It changes how a driver is chosen and what a guess teaches. It does
not change the board, the answer sets, the twelve-submission budget, or the
one-driver-per-board rule.

### Option lists

- Selecting a cell offers eight drivers for that intersection. One to three are
  correct and the rest are decoys.
- Every list on a board is the same length, so list size never signals cell
  depth. The number of correct options is not shown.
- A decoy satisfies exactly one of the cell's two headers. Satisfying both
  makes a driver a correct answer for that intersection, so no other kind of
  decoy exists.
- Decoys are drawn from both axes where both exist. Where one header implies
  the other, only single-axis decoys are possible; the board is still valid and
  the validator reports the cell as weak.
- Decoys are ranked by career race entries, because a decoy nobody recognises
  is eliminated on sight rather than considered.
- Correct options are pairwise disjoint across the nine cells. A correct
  placement can therefore never consume the only listed answer for another
  cell.
- Option lists are frozen with the board and derive from its answer sets, not
  from live queries.

### Category evidence

- A guess result carries the resolved facts proving or disproving each header:
  constructor years, a first win and its race, an actual entry count.
- Evidence is shown only after a guess is committed — on a placed cell, on a
  miss, and never in an option list. Proof attached to an unplayed option is
  the answer.
- The unsatisfied arm reports the driver's real value rather than a cross.
  A win from P4 against a "Won from P6+" header is the near miss that teaches
  the category.
- Evidence is stored as facts and formatted at render time, so wording can
  change without rewriting a snapshot and a career total cannot drift under a
  completed board.
- Evidence is optional per category kind. A kind without an evidence builder
  still plays, and the correct/incorrect result is the floor.
- A driver is never their own teammate. Seat-sharing tests must exclude the
  named driver.

### Mode and progress

- Progress is stored per mode, so both modes hold independent state on the same
  board and switching cannot import a half-solved grid.
- A board counts as played once either mode has finished it.
- The mode is offered only on boards that carry frozen option lists.
- Switching mode is free and needs no confirmation: separate storage means
  there is no progress to lose on either side.

## Timing

### The clock

The clock is server-authoritative. The server stamps the start, stamps every
guess, and stamps the exit. A client-side timer over local progress is
editable and cannot support a leaderboard.

The clock runs on wall time and does not pause. A clock that pauses when the
tab is hidden makes research in a second tab free, which is the opposite of
the intent.

Concealing the headers until the start is what makes the clock meaningful. The
only route to the categories runs through a running clock, so there is no
window in which a player can read the board and prepare before being timed.

The clock display can be hidden by the player. Hiding the display does not stop
the clock.

### Race time

Race time is elapsed wall time plus five seconds for each incorrect
submission. It is formatted as a lap time: `1:24.318` above a minute,
`47.203` below one. Milliseconds are shown because the server measures them.

Sector times split the board by row and are derived from the guess stamps
already recorded. They are reported on the finish screen only.

### Exits

| Exit | Trigger | Clock | Result |
|---|---|---|---|
| Chequered flag | Nine cells correct | Stops | Classified |
| DNF | Twelve submissions used | Stops | Not classified |
| Retirement | Player retires the board | Stops | Not classified |

Retirement exists because the clock does not stop for a stuck player. Without
it the only exit from an unsolvable cell is spending submissions on names the
player knows are wrong. Retiring records the board as it stands and releases
the completion screen.

All three exits reveal the accepted answers for unsolved cells. Each revealed
driver links to their Lapwise driver page.

## Classification and leaderboards

Only a nine-cell board is classified. Every other board is a DNF and is ordered
below all classified results, first by cells solved and then by race time. A
time-only ranking would place a fast six-cell board above a slow nine, which
inverts the object of the puzzle.

A leaderboard exists per puzzle per mode. Standard and Rookie times are never
shown against each other: one mode is typing and the other is clicking, so the
times are not comparable.

- The daily leaderboard covers the puzzle published that day and closes at
  07:00 UTC with the next publication.
- Archive boards are timed and the time is shown, but they are never ranked.
  Unlimited preparation makes an archive time meaningless.
- One session per puzzle, per mode, per player is eligible for ranking. A
  restart produces an unranked practice session, and the interface must say so
  before the restart happens.
- Only signed-in players appear on a leaderboard. Anonymous sessions still
  count toward the field size and the percentile bands.
- The board shows the top ten and pins the player's own row.

A finish screen reports a provisional position, because the field is
incomplete until the puzzle closes. Final classification is published at
07:00 UTC.

### Implausible results

The server clock removes local tampering. It does not remove scripted play or
duplicate accounts.

- A guess is rejected unless it carries a session token issued by a start call.
- Results below a plausible completion floor are flagged for review rather than
  published.
- Duplicate accounts are not solvable without verified identity and are
  accepted as a known limit at current scale.

## Championship

The competition structure follows the sport's own.

| Unit | Maps to | Behavior |
|---|---|---|
| One day's grid | Race | Points awarded once, after the field closes |
| One calendar month | Season | Standings reset on the 1st |
| Trailing seven days | Form | An indicator, not a title |
| Year and all-time | Career | Titles, wins, podiums, poles, best race time |

### Points

Points are awarded at 07:00 UTC on the day after publication, against the
complete field for that puzzle. Points are never awarded live. A percentile
measured against the twelve players who have finished at 00:05 UTC is noise,
and a score that moves after the player has seen it breaks the result.

Awarding against a closed field also removes every timezone advantage, which
is why no bonus is attached to playing early. An early-play bonus cannot be
earned by an Australian and a Californian on the same day.

| Result | Points |
|---|---|
| P1 | 25 |
| Top 1% | 18 |
| Top 5% | 15 |
| Top 10% | 12 |
| Top 25% | 10 |
| Top 50% | 8 |
| Top 75% | 6 |
| Classified | 4 |
| DNF | 1 |

Percentile bands are computed over classified results only. A DNF scores for
attendance, which keeps the habit intact without rewarding an unfinished
board.

The lowest five daily scores in a month are dropped from the season total. A
missed day should not end a title challenge; that anxiety is what ends daily
play. For the same reason there is no streak multiplier, which would compound
an early lead and make one missed day decisive.

### Sprint grids

On a weekend carrying a real Formula 1 sprint, a Saturday sprint board is
published alongside the daily grid: a smaller board with a smaller submission
budget, scoring 8-7-6-5-4-3-2-1 for the top eight and nothing below.

### Streaks

A streak counts days on which the player reached any exit, not days on which
they solved nine. A streak gated on a perfect board breaks within days at a
realistic nine-cell rate and takes the daily habit with it.

Perfect boards, best race time, and championship points are tracked separately,
so a stronger player has different numbers to pursue without the streak
becoming a skill test.

One streak spans both modes. The mode is marked in the share text so a Rookie
nine does not read as a Standard nine.

Streak state syncs to the account once the player signs in. A local-only streak
dies when a browser is cleared, and that ends the habit loop it exists to
create.

## Scoring and sharing

The board score is correct cells out of nine. The result grid distinguishes
three states rather than two:

- purple — solved on the first submission for that cell;
- green — solved after a miss in that cell;
- red — unsolved.

The colours follow sector timing rather than a plain correct/incorrect split,
which carries the same information plus the cost of each cell.

Sharing produces the puzzle number, the mode, the race time and gap, the
spoiler-free colour grid, and the score. Driver names never appear.

Rarity scoring is deferred until enough real submissions exist to avoid noisy
or manipulated percentages. Server-side session records are the source it
waits on. If added, anonymous duplicate play must be controlled and
percentages use the frozen answer set.

## Data-readiness gates

Framework development may begin with exact-constructor, decade, achievement,
venue, teammate, and car-number predicates.

Before any production board is generated or frozen:

- ~~repair the Jack Doohan/Robert Doornbos identity misassignment~~ — done
  2026-08-07. Doohan's 2023 Abu Dhabi practice outing, his 2024 Abu Dhabi
  debut, and his 2025 Chinese sprint qualifying were all filed under
  Doornbos, who last raced in 2006; both carry the code DOO. It made
  Doornbos a false accepted answer for a Red Bull × raced-in-2020s cell. 8
  results, 700 laps and 7 pit stops moved. Doornbos is 2005–2006 again, and
  all forty-five cells across the five boards now reproduce exactly from the
  predicates. The regression check is a ratchet in
  `tests/test_identity_mapping.py`, and it spans every session type: a
  race-only check went green while four practice and sprint-qualifying rows
  were still misfiled;
- re-freeze the five sandbox boards at the 1990 floor, including their Rookie
  option lists, which are currently drawn from an all-history pool;
- run canonical identity and database audits;
- make every enabled category report coverage and source boundaries;
- prove each standard cell has at least three accepted answers;
- manually review every singleton; and
- freeze category versions and answer IDs.

Nationality headers are enabled from the canonical driver field after the
completed backfill. Constructor lineage and owned driver photos are not launch
blockers.

## Open decisions

- Set the cap and ordering for the completion reveal. Every exit reveals the
  unsolved cells, but a 38-answer cell cannot be listed in full. Rank by
  recognition and cap the list.
- Decide whether a missed singleton gets a special reveal.
- Define and name regulation-era boundaries.
- Set the plausible completion floor below which a result is flagged.
- Decide when rarity scoring begins. The session records it depends on start
  accumulating at launch.

## Completion gate

The rules are launch-ready when open launch decisions are resolved, enabled
predicates have tested canonical definitions, search and duplicate rules are
consistent, board validation enforces the three-answer default and reviewed
singleton exception, published puzzles preserve immutable answer snapshots,
and the clock is served and stamped by the server on every board.

Leaderboards and the championship may follow launch. Session records may not:
they are the input to both, and a leaderboard that opens on an empty table has
no field to rank. Sessions must be recording from the first published board.
