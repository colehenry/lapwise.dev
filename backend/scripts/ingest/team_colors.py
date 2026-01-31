"""
Historical F1 Team Color Mapping (Pre-2018)

FastF1 does not provide team colors for seasons before 2018.
This mapping provides fallback colors for historical teams based on their
traditional livery colors.

Colors are stored WITHOUT the '#' prefix (just hex values like 'DC0000').
"""

# Team color mapping (case-insensitive team names)
# Colors sourced from historical F1 liveries and official team colors
HISTORICAL_TEAM_COLORS = {
    # Ferrari (always red)
    "ferrari": "DC0000",
    "scuderia ferrari": "DC0000",

    # Mercedes (silver)
    "mercedes": "00D2BE",
    "mercedes-benz": "00D2BE",
    "mercedes gp": "00D2BE",

    # Red Bull (dark blue)
    "red bull": "0600EF",
    "red bull racing": "0600EF",

    # McLaren (orange/papaya or silver depending on era)
    "mclaren": "FF8700",
    "mclaren mercedes": "FF8700",
    "mclaren honda": "FF8700",
    "mclaren renault": "FF8700",

    # Williams (blue/white)
    "williams": "0082FA",
    "williams mercedes": "0082FA",
    "williams renault": "0082FA",
    "williams bmw": "0082FA",

    # Renault (yellow)
    "renault": "FFF500",
    "renault f1 team": "FFF500",

    # Force India (pink)
    "force india": "F596C8",
    "force india mercedes": "F596C8",

    # Toro Rosso (red/blue)
    "toro rosso": "469BFF",
    "scuderia toro rosso": "469BFF",

    # Sauber (white/blue)
    "sauber": "9B0000",
    "sauber ferrari": "9B0000",

    # Haas (grey/red)
    "haas f1 team": "787878",
    "haas": "787878",

    # Lotus (black/gold)
    "lotus": "000000",
    "lotus f1 team": "000000",
    "lotus renault": "000000",

    # Caterham (green)
    "caterham": "00B500",
    "caterham f1 team": "00B500",

    # Marussia (red/white)
    "marussia": "6E0000",
    "marussia f1 team": "6E0000",

    # Manor (orange/red)
    "manor": "E40046",
    "manor f1 team": "E40046",
    "manor racing": "E40046",

    # HRT (silver)
    "hrt": "8A8A8A",
    "hrt f1 team": "8A8A8A",

    # Virgin (red)
    "virgin": "CC0000",
    "virgin racing": "CC0000",

    # BMW Sauber (white/blue)
    "bmw sauber": "1E5BC6",
    "bmw sauber f1 team": "1E5BC6",

    # Toyota (red/white)
    "toyota": "CC0000",
    "toyota f1": "CC0000",

    # Honda (white)
    "honda": "FFFFFF",
    "honda racing": "FFFFFF",

    # Brawn GP (fluorescent yellow/green)
    "brawn": "B6BABD",
    "brawn gp": "B6BABD",

    # Super Aguri (white/orange)
    "super aguri": "E40046",
    "super aguri f1": "E40046",

    # Spyker (orange)
    "spyker": "FF8700",
    "spyker f1 team": "FF8700",

    # Midland (red)
    "midland": "E40046",
    "midland f1": "E40046",

    # Jordan (yellow)
    "jordan": "FFFF00",
    "jordan ford": "FFFF00",

    # Jaguar (racing green)
    "jaguar": "00491E",
    "jaguar racing": "00491E",

    # BAR (white/blue/red)
    "bar": "FFFFFF",
    "bar honda": "FFFFFF",

    # Minardi (black/white)
    "minardi": "000000",
    "minardi cosworth": "000000",

    # Arrows (orange)
    "arrows": "FF8700",
    "arrows f1": "FF8700",

    # Prost (blue)
    "prost": "0033CC",
    "prost grand prix": "0033CC",

    # Benetton (green/blue)
    "benetton": "00A8E6",
    "benetton ford": "00A8E6",
    "benetton renault": "00A8E6",

    # Tyrrell (blue)
    "tyrrell": "0033CC",
    "tyrrell ford": "0033CC",
}


def get_historical_team_color(team_name: str) -> str | None:
    """
    Get historical team color by name (case-insensitive).

    Args:
        team_name: Team name from FastF1

    Returns:
        Hex color (without #) or None if not found
    """
    if not team_name:
        return None

    # Normalize team name (lowercase, strip whitespace)
    normalized = team_name.lower().strip()

    return HISTORICAL_TEAM_COLORS.get(normalized)


def enrich_team_color(team_data, year: int) -> str | None:
    """
    Enrich team data with historical color if needed.

    Args:
        team_data: Row from session.results DataFrame
        year: Season year

    Returns:
        Team color (hex without #) or None
    """
    # First try to get color from FastF1 data
    team_color = team_data.get("TeamColor", "")

    # If FastF1 provided a color, use it
    if team_color and team_color.strip():
        # Remove '#' if present
        if team_color.startswith("#"):
            return team_color[1:]
        return team_color

    # For pre-2018, use historical mapping
    if year < 2018:
        team_name = team_data.get("TeamName", "")
        return get_historical_team_color(team_name)

    # No color available
    return None
