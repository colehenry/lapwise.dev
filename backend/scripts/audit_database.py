"""
Database Audit Script

Performs a comprehensive audit of the F1 analytics database to identify:
- Missing sessions (race, qualifying, sprint)
- Incomplete session data (missing results, laps, weather, etc.)
- Data quality issues
- Ingestion failures

Usage:
    PYTHONPATH=$PWD python scripts/audit_database.py [season]
    PYTHONPATH=$PWD python scripts/audit_database.py 2024
    PYTHONPATH=$PWD python scripts/audit_database.py --all  # Check all seasons

Output:
    - Summary statistics for each season
    - Detailed report of missing/incomplete data
    - Recommendations for re-ingestion
"""

import sys
import os
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from collections import defaultdict

# Import models and config
from app.models import (
    Driver, Team, Circuit, Session, SessionResult,
    Lap, Weather, TrackStatus, RaceControlMessage
)
from app.config import settings


def get_db_session():
    """Create a synchronous database session."""
    database_url = settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    # Handle SSL parameter for Neon/cloud databases
    # psycopg2 expects sslmode instead of ssl
    if "?ssl=require" in database_url:
        database_url = database_url.replace("?ssl=require", "?sslmode=require")

    engine = create_engine(database_url, echo=False)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


class DatabaseAuditor:
    """Audit database for missing or incomplete F1 session data."""

    def __init__(self, db):
        self.db = db
        self.issues = []
        self.stats = defaultdict(lambda: defaultdict(int))

    def add_issue(self, severity, category, season, round_num, session_type, message):
        """Record an issue found during audit."""
        self.issues.append({
            'severity': severity,  # 'ERROR', 'WARNING', 'INFO'
            'category': category,  # 'missing_session', 'incomplete_data', etc.
            'season': season,
            'round': round_num,
            'session_type': session_type,
            'message': message
        })

    def get_seasons_in_db(self):
        """Get list of all seasons in database."""
        result = self.db.execute(
            select(Session.year).distinct().order_by(Session.year)
        )
        return [row[0] for row in result]

    def get_expected_sessions_for_season(self, season):
        """
        Get expected session count for a season.

        For most modern seasons:
        - ~20-24 races per season
        - Each race has: race + qualifying = 2 sessions
        - Some races have sprint (sprint_race + sprint_qualifying) = +2 sessions

        Returns: dict with expected counts
        """
        # This is an approximation - actual counts vary by year
        expected = {
            'race': 20,  # Minimum expected races
            'qualifying': 20,  # Every race has qualifying
            'sprint_race': 0,  # Varies by season (0-6 typically)
            'sprint_qualifying': 0,
        }

        # Sprint weekends by season (approximate)
        sprint_counts = {
            2021: 3,  # First season with sprints
            2022: 3,
            2023: 6,
            2024: 6,
        }

        if season in sprint_counts:
            sprint_count = sprint_counts[season]
            expected['sprint_race'] = sprint_count
            expected['sprint_qualifying'] = sprint_count

        return expected

    def audit_sessions(self, season):
        """Audit session records for a season."""
        print(f"\n📋 Auditing Sessions for {season}")
        print("=" * 70)

        # Get all sessions for this season
        sessions = self.db.execute(
            select(Session)
            .where(Session.year == season)
            .order_by(Session.round, Session.session_type)
        ).scalars().all()

        # Group by session type
        sessions_by_type = defaultdict(list)
        sessions_by_round = defaultdict(dict)

        for session in sessions:
            sessions_by_type[session.session_type].append(session)
            sessions_by_round[session.round][session.session_type] = session

        # Report counts
        print(f"\n📊 Session Counts:")
        for session_type in ['race', 'qualifying', 'sprint_race', 'sprint_qualifying']:
            count = len(sessions_by_type.get(session_type, []))
            print(f"   {session_type:20s}: {count:3d}")
            self.stats[season][f'{session_type}_count'] = count

        # Check for missing races (gaps in round numbers)
        if 'race' in sessions_by_type:
            race_rounds = sorted([s.round for s in sessions_by_type['race']])
            expected_rounds = list(range(1, max(race_rounds) + 1))
            missing_rounds = set(expected_rounds) - set(race_rounds)

            if missing_rounds:
                print(f"\n⚠️  Missing Race Rounds: {sorted(missing_rounds)}")
                for round_num in missing_rounds:
                    self.add_issue(
                        'ERROR', 'missing_session', season, round_num, 'race',
                        f"Race session missing for round {round_num}"
                    )

        # Check for qualifying without race
        for session in sessions_by_type.get('qualifying', []):
            if 'race' not in sessions_by_round[session.round]:
                print(f"⚠️  Round {session.round}: Has qualifying but no race")
                self.add_issue(
                    'WARNING', 'orphan_session', season, session.round, 'qualifying',
                    "Qualifying exists but race is missing"
                )

        # Check for sprint_race without sprint_qualifying and vice versa
        for session in sessions_by_type.get('sprint_race', []):
            if 'sprint_qualifying' not in sessions_by_round[session.round]:
                print(f"⚠️  Round {session.round}: Has sprint race but no sprint qualifying")
                self.add_issue(
                    'WARNING', 'incomplete_sprint', season, session.round, 'sprint_race',
                    "Sprint race exists but sprint qualifying is missing"
                )

        return sessions

    def audit_session_data(self, session):
        """Audit data completeness for a single session."""
        session_id = session.id

        # Check results
        results_count = self.db.execute(
            select(func.count(SessionResult.id))
            .where(SessionResult.session_id == session_id)
        ).scalar()

        # Check laps
        laps_count = self.db.execute(
            select(func.count(Lap.id))
            .where(Lap.session_id == session_id)
        ).scalar()

        # Check weather
        weather_count = self.db.execute(
            select(func.count(Weather.id))
            .where(Weather.session_id == session_id)
        ).scalar()

        # Check track status
        track_status_count = self.db.execute(
            select(func.count(TrackStatus.id))
            .where(TrackStatus.session_id == session_id)
        ).scalar()

        # Check race control messages
        messages_count = self.db.execute(
            select(func.count(RaceControlMessage.id))
            .where(RaceControlMessage.session_id == session_id)
        ).scalar()

        return {
            'results': results_count,
            'laps': laps_count,
            'weather': weather_count,
            'track_status': track_status_count,
            'messages': messages_count,
        }

    def audit_data_completeness(self, season):
        """Audit data completeness for all sessions in a season."""
        print(f"\n📊 Auditing Data Completeness for {season}")
        print("=" * 70)

        sessions = self.db.execute(
            select(Session)
            .where(Session.year == season)
            .order_by(Session.round, Session.session_type)
        ).scalars().all()

        incomplete_sessions = []

        for session in sessions:
            data = self.audit_session_data(session)

            # Expected data presence by session type
            expected = {
                'race': {
                    'results': True,
                    'laps': True,  # Should have lap data
                    'weather': True,
                    'track_status': True,
                    'messages': True,
                },
                'qualifying': {
                    'results': True,
                    'laps': True,  # Qualifying has laps too
                    'weather': True,
                    'track_status': True,
                    'messages': True,
                },
                'sprint_race': {
                    'results': True,
                    'laps': True,
                    'weather': True,
                    'track_status': True,
                    'messages': True,
                },
                'sprint_qualifying': {
                    'results': True,
                    'laps': True,
                    'weather': True,
                    'track_status': True,
                    'messages': True,
                }
            }

            issues_found = []

            # Check what should be present
            if session.session_type in expected:
                expectations = expected[session.session_type]

                if expectations['results'] and data['results'] == 0:
                    issues_found.append('results')
                    self.add_issue(
                        'ERROR', 'missing_data', season, session.round, session.session_type,
                        f"No results data for {session.session_type}"
                    )

                if expectations['laps'] and data['laps'] == 0:
                    issues_found.append('laps')
                    self.add_issue(
                        'ERROR', 'missing_data', season, session.round, session.session_type,
                        f"No lap data for {session.session_type}"
                    )

                if expectations['weather'] and data['weather'] == 0:
                    issues_found.append('weather')
                    self.add_issue(
                        'WARNING', 'missing_data', season, session.round, session.session_type,
                        f"No weather data for {session.session_type}"
                    )

                if expectations['track_status'] and data['track_status'] == 0:
                    issues_found.append('track_status')
                    self.add_issue(
                        'WARNING', 'missing_data', season, session.round, session.session_type,
                        f"No track status data for {session.session_type}"
                    )

                if expectations['messages'] and data['messages'] == 0:
                    issues_found.append('messages')
                    self.add_issue(
                        'WARNING', 'missing_data', season, session.round, session.session_type,
                        f"No race control messages for {session.session_type}"
                    )

            if issues_found:
                incomplete_sessions.append({
                    'session': session,
                    'data': data,
                    'issues': issues_found
                })

        # Print summary
        if incomplete_sessions:
            print(f"\n⚠️  Found {len(incomplete_sessions)} incomplete sessions:\n")

            for item in incomplete_sessions:
                session = item['session']
                data = item['data']
                issues = item['issues']

                print(f"Round {session.round:2d} - {session.session_type:20s} ({session.event_name})")
                print(f"   Missing: {', '.join(issues)}")
                print(f"   Current: Results={data['results']}, Laps={data['laps']}, "
                      f"Weather={data['weather']}, TrackStatus={data['track_status']}, "
                      f"Messages={data['messages']}")
                print()
        else:
            print("\n✅ All sessions have complete data!")

        return incomplete_sessions

    def audit_data_quality(self, season):
        """Audit data quality issues (NULL values, inconsistencies, etc.)."""
        print(f"\n🔍 Auditing Data Quality for {season}")
        print("=" * 70)

        # Check for sessions with results but no driver data
        sessions = self.db.execute(
            select(Session)
            .where(Session.year == season)
        ).scalars().all()

        quality_issues = []

        for session in sessions:
            # Check for results with NULL positions (should be rare)
            null_positions = self.db.execute(
                select(func.count(SessionResult.id))
                .where(SessionResult.session_id == session.id)
                .where(SessionResult.position.is_(None))
            ).scalar()

            if null_positions > 0:
                print(f"⚠️  Round {session.round} {session.session_type}: "
                      f"{null_positions} results with NULL position")
                self.add_issue(
                    'WARNING', 'data_quality', season, session.round, session.session_type,
                    f"{null_positions} results have NULL position"
                )
                quality_issues.append({
                    'session': session,
                    'issue': 'null_positions',
                    'count': null_positions
                })

            # Check for race/sprint results with NULL lap times for finishers
            if session.session_type in ['race', 'sprint_race']:
                null_times = self.db.execute(
                    select(func.count(SessionResult.id))
                    .where(SessionResult.session_id == session.id)
                    .where(SessionResult.position == 1)  # Winner should have time
                    .where(SessionResult.time_seconds.is_(None))
                ).scalar()

                if null_times > 0:
                    print(f"⚠️  Round {session.round} {session.session_type}: "
                          f"Winner has NULL time")
                    self.add_issue(
                        'ERROR', 'data_quality', season, session.round, session.session_type,
                        "Race winner has NULL time"
                    )
                    quality_issues.append({
                        'session': session,
                        'issue': 'null_winner_time',
                        'count': null_times
                    })

            # Check for qualifying results with all NULL times
            if session.session_type in ['qualifying', 'sprint_qualifying']:
                all_null_q_times = self.db.execute(
                    select(func.count(SessionResult.id))
                    .where(SessionResult.session_id == session.id)
                    .where(SessionResult.q1_time_seconds.is_(None))
                    .where(SessionResult.q2_time_seconds.is_(None))
                    .where(SessionResult.q3_time_seconds.is_(None))
                ).scalar()

                total_results = self.db.execute(
                    select(func.count(SessionResult.id))
                    .where(SessionResult.session_id == session.id)
                ).scalar()

                if all_null_q_times == total_results and total_results > 0:
                    print(f"⚠️  Round {session.round} {session.session_type}: "
                          f"ALL qualifying times are NULL")
                    self.add_issue(
                        'ERROR', 'data_quality', season, session.round, session.session_type,
                        "All qualifying times are NULL"
                    )
                    quality_issues.append({
                        'session': session,
                        'issue': 'all_null_q_times',
                        'count': total_results
                    })

        if not quality_issues:
            print("\n✅ No data quality issues found!")

        return quality_issues

    def generate_report(self, seasons):
        """Generate comprehensive audit report."""
        print("\n" + "=" * 70)
        print("📊 AUDIT SUMMARY")
        print("=" * 70)

        # Count issues by severity
        errors = [i for i in self.issues if i['severity'] == 'ERROR']
        warnings = [i for i in self.issues if i['severity'] == 'WARNING']
        infos = [i for i in self.issues if i['severity'] == 'INFO']

        print(f"\n📈 Overall Statistics:")
        print(f"   Seasons audited: {len(seasons)}")
        print(f"   Total issues found: {len(self.issues)}")
        print(f"   ❌ Errors: {len(errors)}")
        print(f"   ⚠️  Warnings: {len(warnings)}")
        print(f"   ℹ️  Info: {len(infos)}")

        # Group issues by category
        issues_by_category = defaultdict(list)
        for issue in self.issues:
            issues_by_category[issue['category']].append(issue)

        print(f"\n📋 Issues by Category:")
        for category, category_issues in sorted(issues_by_category.items()):
            print(f"   {category:20s}: {len(category_issues)}")

        # Print critical errors
        if errors:
            print(f"\n❌ CRITICAL ERRORS ({len(errors)}):")
            print("-" * 70)
            for issue in errors:
                print(f"   [{issue['season']} R{issue['round']:2d}] "
                      f"{issue['session_type']:20s}: {issue['message']}")

        # Print warnings
        if warnings and len(warnings) <= 20:
            print(f"\n⚠️  WARNINGS ({len(warnings)}):")
            print("-" * 70)
            for issue in warnings[:20]:  # Limit to first 20
                print(f"   [{issue['season']} R{issue['round']:2d}] "
                      f"{issue['session_type']:20s}: {issue['message']}")
            if len(warnings) > 20:
                print(f"   ... and {len(warnings) - 20} more warnings")

        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        print("-" * 70)

        if errors:
            print("\n1. Re-run ingestion for sessions with ERRORS:")
            # Group errors by season and round
            errors_by_season_round = defaultdict(lambda: defaultdict(set))
            for error in errors:
                errors_by_season_round[error['season']][error['round']].add(error['session_type'])

            for season in sorted(errors_by_season_round.keys()):
                print(f"\n   Season {season}:")
                for round_num in sorted(errors_by_season_round[season].keys()):
                    session_types = errors_by_season_round[season][round_num]
                    print(f"      Round {round_num}: {', '.join(sorted(session_types))}")

        if len(errors) == 0 and len(warnings) == 0:
            print("\n   ✅ Database is in excellent condition!")
            print("   ✅ All expected data is present and complete.")

        print("\n" + "=" * 70)


def main():
    """Main audit function."""
    db = get_db_session()
    auditor = DatabaseAuditor(db)

    # Determine which seasons to audit
    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            seasons = auditor.get_seasons_in_db()
            print(f"📅 Found seasons in database: {seasons}")
        else:
            seasons = [int(sys.argv[1])]
    else:
        # Default: audit most recent season
        all_seasons = auditor.get_seasons_in_db()
        seasons = [max(all_seasons)] if all_seasons else []

    if not seasons:
        print("❌ No seasons found in database!")
        return

    print(f"\n{'='*70}")
    print(f"🔍 F1 DATABASE AUDIT")
    print(f"{'='*70}")
    print(f"Auditing {len(seasons)} season(s): {seasons}")

    # Run audits for each season
    for season in seasons:
        auditor.audit_sessions(season)
        auditor.audit_data_completeness(season)
        auditor.audit_data_quality(season)

    # Generate final report
    auditor.generate_report(seasons)

    db.close()


if __name__ == "__main__":
    main()
