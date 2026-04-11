-- =============================================================================
-- LAPWISE F1 DATABASE SCHEMA — LLM CONTEXT
-- =============================================================================
-- This file describes the queryable tables in the lapwise.dev F1 database.
-- Use this schema to generate accurate SQL queries against PostgreSQL.
--
-- DATA COVERAGE:
--   Race results:     1950–present (all F1 seasons)
--   Lap-level timing: 2018–present (from F1 Live Timing via FastF1)
--   Basic lap times:  1996–2017 (from Jolpica API, limited accuracy)
--   Weather data:     2018–present (per-minute samples)
--   Track status:     2018–present (safety cars, flags)
--   Race control:     2018–present (penalties, investigations, DRS)
--
-- IMPORTANT QUERY RULES:
--   1. All queries MUST be read-only (SELECT only).
--   2. Never query auth/user tables (users, refresh_tokens, etc.).
--   3. Always use LIMIT (max 500 rows) unless aggregating.
--   4. For lap time analysis, filter: is_accurate = true AND deleted = false
--   5. NULL position means DNF/DNS/DSQ — use status column for details.
--   6. Teams are year-partitioned: JOIN on team_id, not team name across years.
--   7. driver_code can be NULL for pre-2003 drivers; use jolpica_id as stable key.
--   8. Grand Prix names live in sessions.event_name; circuit names live in circuits.name.
--      A user may ask for either one ("Silverstone 2025", "British GP 2025"), so event lookup
--      queries should usually search across sessions.event_name PLUS circuits.name/location/country.
--   9. For case-insensitive text matching, prefer ILIKE over LIKE.
--  10. If an event lookup returns 0 rows, first run a broader discovery query for that year/session_type
--      to inspect actual event_name and circuit values before concluding the event is missing.
--  11. For race strategy analysis, prefer laps.stint + laps.compound + lap_number as the primary source.
--      pit_duration_seconds and weather_data are useful supporting fields but may be sparse or missing.
--  12. If a supporting table/field returns 0 rows, pivot to another data source instead of repeating
--      near-identical queries with formatting-only changes.
--  13. For race narrative claims ("led from pole to flag", "dominated", "recovered", "benefited from SC"),
--      query laps.position by lap plus track_status/race_control_messages before interpreting. Final result,
--      grid position, and winning margin alone do not prove how the race unfolded.
-- =============================================================================

-- DRIVERS: One row per driver across their entire career.
-- ~1,000 rows. Every driver who has entered an F1 session since 1950.
CREATE TABLE drivers (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR NOT NULL,               -- "Lewis Hamilton", "Ayrton Senna"
    driver_code     VARCHAR(3) UNIQUE,              -- "HAM", "VER" — NULL for pre-2003 drivers
    jolpica_id      VARCHAR UNIQUE,                 -- "hamilton", "senna" — stable ID for all eras
    driver_number   INTEGER,                        -- Permanent number: 44, 1, 16 — NULL pre-2014
    country_code    VARCHAR(3)                      -- ISO alpha-3: "GBR", "NED", "BRA" — NULL for some historical
);

-- TEAMS: One row per team PER YEAR. Handles name changes (Racing Point → Aston Martin).
-- ~300 rows. Use (year, name) as the logical key.
CREATE TABLE teams (
    id              SERIAL PRIMARY KEY,
    year            INTEGER NOT NULL,               -- The season this entry represents
    name            VARCHAR NOT NULL,               -- "Red Bull Racing", "Ferrari", "Aston Martin"
    team_color      VARCHAR(6),                     -- Hex without "#": "3671C6" — NULL for some historical
    logo_url        VARCHAR,                        -- Team logo URL — NULL for historical teams
    UNIQUE (year, name)
);

-- CIRCUITS: Every F1 circuit ever used. ~80 rows.
CREATE TABLE circuits (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR NOT NULL,               -- "Silverstone Circuit", "Circuit de Monaco"
    location        VARCHAR NOT NULL,               -- City: "Silverstone", "Monte Carlo"
    country         VARCHAR NOT NULL,               -- "United Kingdom", "Monaco"
    track_length_km FLOAT,                          -- e.g., 5.891 — NULL for some historical
    latitude        FLOAT,                          -- Geographic coordinate
    longitude       FLOAT                           -- Geographic coordinate
);

-- SESSIONS: One row per session (race, qualifying, sprint, sprint qualifying).
-- ~1,200 rows. Central table linking all per-session data.
CREATE TABLE sessions (
    id                      SERIAL PRIMARY KEY,
    year                    INTEGER NOT NULL,
    round                   INTEGER NOT NULL,       -- 1-24 (round within season)
    session_type            VARCHAR NOT NULL,        -- 'race', 'sprint_race', 'qualifying', 'sprint_qualifying'
    event_name              VARCHAR NOT NULL,        -- "Monaco Grand Prix", "British Grand Prix"
    date                    DATE NOT NULL,
    circuit_id              INTEGER NOT NULL REFERENCES circuits(id),
    highlights_video_id     VARCHAR,                -- YouTube video ID (may be NULL)
    UNIQUE (year, round, session_type)
);

-- SESSION_RESULTS: One row per driver per session. Race finishes, qualifying times.
-- ~24,000 rows. This is the primary results table.
CREATE TABLE session_results (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES sessions(id),
    driver_id           INTEGER NOT NULL REFERENCES drivers(id),
    team_id             INTEGER NOT NULL REFERENCES teams(id),

    -- Universal fields (all session types)
    position            INTEGER,                    -- Final position. NULL = DNF/DNS/DSQ
    status              VARCHAR NOT NULL,            -- "Finished", "+1 Lap", "DNF", "DNS", "DSQ", "Retired", etc.
    headshot_url        VARCHAR,                    -- Driver photo URL

    -- Race & Sprint only
    grid_position       INTEGER,                    -- Starting grid position
    points              FLOAT,                      -- Championship points awarded (0 if outside points)
    laps_completed      INTEGER,                    -- Total laps completed
    time_seconds        FLOAT,                      -- Total race time in seconds (winner only has absolute; others have gap)
    fastest_lap         BOOLEAN DEFAULT FALSE,       -- Did this driver set the fastest lap?

    -- Qualifying only (NULL for race/sprint sessions)
    q1_time_seconds     FLOAT,                      -- Best Q1 lap time in seconds
    q2_time_seconds     FLOAT,                      -- Best Q2 lap time in seconds (NULL if eliminated in Q1)
    q3_time_seconds     FLOAT,                      -- Best Q3 lap time in seconds (NULL if eliminated in Q2)

    UNIQUE (session_id, driver_id)
);

-- LAPS: Lap-by-lap timing data. LARGEST TABLE (~100K+ rows).
-- Rich data from 2018+. Basic times from 1996-2017. Empty pre-1996.
CREATE TABLE laps (
    id                              SERIAL PRIMARY KEY,
    session_id                      INTEGER NOT NULL REFERENCES sessions(id),
    driver_id                       INTEGER NOT NULL REFERENCES drivers(id),
    lap_number                      INTEGER NOT NULL,

    -- Lap timing (all in seconds)
    lap_time_seconds                FLOAT,          -- Total lap time. NULL for in/out laps.
    sector1_time_seconds            FLOAT,          -- Sector 1 time
    sector2_time_seconds            FLOAT,          -- Sector 2 time
    sector3_time_seconds            FLOAT,          -- Sector 3 time

    -- Session timestamps (seconds since session start — useful for timeline analysis)
    lap_start_time_seconds          FLOAT,
    sector1_session_time_seconds    FLOAT,
    sector2_session_time_seconds    FLOAT,
    sector3_session_time_seconds    FLOAT,

    -- Pit stop data
    pit_in_time_seconds             FLOAT,          -- Session time when car entered pit lane
    pit_out_time_seconds            FLOAT,          -- Session time when car exited pit lane
    pit_duration_seconds            FLOAT,          -- COMPUTED: pit_out - pit_in (total pit lane time)
    stint                           INTEGER,        -- Stint number: 1, 2, 3... (increments after each pit stop)

    -- Speed traps (all in km/h)
    speed_i1                        FLOAT,          -- Intermediate point 1
    speed_i2                        FLOAT,          -- Intermediate point 2
    speed_fl                        FLOAT,          -- Finish line
    speed_st                        FLOAT,          -- Speed trap (main straight)

    -- Tyre information
    compound                        VARCHAR(15),    -- "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"
    tyre_life                       INTEGER,        -- Laps on current tyre set
    fresh_tyre                      BOOLEAN,        -- New (unused) tyre set?

    -- Position & status
    position                        INTEGER,        -- Track position after this lap
    track_status                    VARCHAR(10),    -- "1"=green, "2"=yellow, "4"=SC, "5"=red, "6"=VSC, "7"=VSC ending
    is_personal_best                BOOLEAN,        -- Driver's personal best in this session
    is_accurate                     BOOLEAN,        -- FastF1 timing accuracy flag. FILTER ON THIS for analysis.

    -- FIA deleted laps (track limits violations)
    deleted                         BOOLEAN,        -- Was this lap time deleted?
    deleted_reason                  VARCHAR(100),   -- Reason for deletion

    UNIQUE (session_id, driver_id, lap_number)
);

-- WEATHER: Per-minute weather samples during each session.
-- ~150K+ rows. Available 2018+ (some limited data 1996-2017).
CREATE TABLE weather_data (
    id                      SERIAL PRIMARY KEY,
    session_id              INTEGER NOT NULL REFERENCES sessions(id),
    session_time_seconds    FLOAT NOT NULL,         -- Seconds since session start

    -- Temperature (Celsius)
    air_temp                FLOAT,
    track_temp              FLOAT,

    -- Atmospheric
    humidity                FLOAT,                  -- Percentage 0-100
    pressure                FLOAT,                  -- Millibars

    -- Wind
    wind_speed              FLOAT,                  -- m/s
    wind_direction          INTEGER,                -- Degrees 0-360

    -- Precipitation
    rainfall                BOOLEAN                 -- Is it currently raining?
);

-- TRACK_STATUS: Flag and safety car events during a session.
-- ~20K+ rows. Available 2018+ only.
CREATE TABLE track_status (
    id                      SERIAL PRIMARY KEY,
    session_id              INTEGER NOT NULL REFERENCES sessions(id),
    session_time_seconds    FLOAT NOT NULL,         -- When status changed

    -- Status codes:
    --   "1" = Green flag (clear)
    --   "2" = Yellow flag
    --   "4" = Safety Car deployed
    --   "5" = Red flag (session stopped)
    --   "6" = Virtual Safety Car (VSC)
    --   "7" = VSC ending
    status                  VARCHAR(10) NOT NULL,
    message                 TEXT                    -- Human-readable description from race control
);

-- RACE_CONTROL_MESSAGES: Official messages during a session (penalties, flags, DRS, incidents).
-- ~30K+ rows. Available 2018+ only.
CREATE TABLE race_control_messages (
    id                      SERIAL PRIMARY KEY,
    session_id              INTEGER NOT NULL REFERENCES sessions(id),
    session_time_seconds    FLOAT NOT NULL,         -- When message was issued

    category                VARCHAR(50),            -- "Flag", "Drs", "CarEvent", "SafetyCar", "Other"
    message                 TEXT NOT NULL,           -- Full message text (e.g., "CAR 44 (HAM) TIME PENALTY - 5 SECONDS")
    status                  VARCHAR(50),            -- Status field from race control

    driver_number           INTEGER,                -- Racing number of affected driver (NULL if track-wide)
    flag                    VARCHAR(20),            -- Flag type if applicable
    scope                   VARCHAR(20),            -- "Track", "Driver", "Sector"
    sector                  INTEGER,                -- Sector number (1, 2, or 3)
    lap_number              INTEGER                 -- Lap when message was issued
);

-- =============================================================================
-- PRE-COMPUTED STANDINGS VIEWS (fast — no joins needed)
-- =============================================================================

-- V_DRIVER_STANDINGS: Championship standings per year per driver.
-- Fastest way to answer "who leads the championship in year X".
-- Use: SELECT * FROM v_driver_standings WHERE year = 2024 ORDER BY championship_position
CREATE VIEW v_driver_standings AS
    -- year, championship_position, driver_name, driver_code, country_code,
    -- team_name (most recent team that year), points, wins, podiums, finishes, races_entered

-- V_CONSTRUCTOR_STANDINGS: Team championship standings per year.
-- Use: SELECT * FROM v_constructor_standings WHERE year = 2024 ORDER BY championship_position
CREATE VIEW v_constructor_standings AS
    -- year, championship_position, team_name, team_color,
    -- points, wins, podiums, finishes

-- =============================================================================
-- KEY RELATIONSHIPS (for JOINs)
-- =============================================================================
--
-- sessions.circuit_id        → circuits.id
-- session_results.session_id → sessions.id
-- session_results.driver_id  → drivers.id
-- session_results.team_id    → teams.id          (year-specific team record!)
-- laps.session_id            → sessions.id
-- laps.driver_id             → drivers.id
-- weather_data.session_id    → sessions.id
-- track_status.session_id    → sessions.id
-- race_control_messages.session_id → sessions.id
--
-- COMMON JOIN PATTERNS:
--
-- Race results with driver/team names:
--   session_results JOIN sessions ON session_id
--   JOIN drivers ON driver_id
--   JOIN teams ON team_id
--
-- Lap times with session context:
--   laps JOIN sessions ON session_id JOIN drivers ON driver_id
--
-- Weather during a race:
--   weather_data WHERE session_id = (SELECT id FROM sessions WHERE ...)
--
-- Race narrative fact check:
--   laps.position gives track position after each completed lap.
--   Use it to verify lap 1 position, leader changes, worst/best position, first lap in P1, and laps led.
--   Combine laps.track_status or track_status.status with pit_in_time_seconds/pit_out_time_seconds
--   before claiming SC/VSC luck or strategy gains.
--
-- Teammate comparison (same session, same team):
--   session_results r1 JOIN session_results r2
--     ON r1.session_id = r2.session_id AND r1.team_id = r2.team_id
--     AND r1.driver_id != r2.driver_id
--
-- Event resolution pattern (recommended when user names a race/circuit informally):
--   SELECT s.id, s.year, s.round, s.session_type, s.event_name, s.date,
--          c.name AS circuit_name, c.location, c.country
--   FROM sessions s
--   JOIN circuits c ON s.circuit_id = c.id
--   WHERE s.year = 2025
--     AND s.session_type = 'race'
--     AND (
--       s.event_name ILIKE '%british%'
--       OR c.name ILIKE '%silverstone%'
--       OR c.location ILIKE '%silverstone%'
--       OR c.country ILIKE '%united kingdom%'
--     );
-- =============================================================================
