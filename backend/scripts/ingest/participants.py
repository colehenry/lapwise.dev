
from sqlalchemy import select
from app.models import Driver, Team
from .team_colors import enrich_team_color

def ingest_driver(db, driver_data):
    """
    Ingest or update driver.

    Args:
        driver_data: Row from session.results DataFrame

    Returns: driver_id
    """
    driver_code = driver_data["Abbreviation"]

    # Check if driver exists by code
    driver = db.execute(
        select(Driver).where(Driver.driver_code == driver_code)
    ).scalar_one_or_none()

    if driver:
        return driver.id
    else:
        print(f"    + New driver: {driver_data['FullName']} ({driver_code})")
        driver = Driver(
            full_name=driver_data["FullName"],
            driver_code=driver_code,
            driver_number=(
                int(driver_data["DriverNumber"])
                if driver_data["DriverNumber"]
                else None
            ),
            country_code=driver_data.get("CountryCode"),
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)
        return driver.id


def ingest_team(db, team_data, year):
    """
    Ingest team for a specific year if it doesn't exist.

    Args:
        team_data: Row from session.results DataFrame
        year: Season year

    Returns: team_id
    """
    team_name = team_data["TeamName"]

    # Use enriched color (includes historical mapping for pre-2018)
    team_color = enrich_team_color(team_data, year)

    # Check if team exists for this year
    team = db.execute(
        select(Team).where(Team.year == year, Team.name == team_name)
    ).scalar_one_or_none()

    if team:
        # Update color if we now have one and team doesn't
        if team_color and not team.team_color:
            team.team_color = team_color
            db.commit()
        return team.id
    else:
        print(f"    + New team for {year}: {team_name} (color: {team_color or 'none'})")
        team = Team(
            year=year, name=team_name, team_color=team_color
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        return team.id
