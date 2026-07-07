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
    # ── 1950s–1960s ERA ─────────────────────────────────────────────────────
    # Alfa Romeo (Italian national racing red)
    "alfa romeo": "C8102E",
    "alfa romeo racing": "C8102E",
    # Maserati (Italian national racing red)
    "maserati": "C8102E",
    # BRM – British Racing Green
    "brm": "215732",
    "british racing motors": "215732",
    # Cooper – British Racing Green
    "cooper": "215732",
    "cooper climax": "215732",
    "cooper bristol": "215732",
    "cooper alta": "215732",
    "cooper maserati": "215732",
    "cooper borgward": "215732",
    "cooper ferrari": "215732",
    # Vanwall – British Racing Green
    "vanwall": "00563B",
    # Connaught – British Racing Green
    "connaught": "215732",
    "connaught alta": "215732",
    # Team Lotus / Lotus Climax (BRG until mid-60s, then gold/black)
    "team lotus": "215732",
    "lotus climax": "215732",
    "lotus brmv8": "215732",
    "lotus ford": "215732",
    # Gordini – French Racing Blue
    "gordini": "1B3F8A",
    "simca gordini": "1B3F8A",
    "simca-gordini": "1B3F8A",
    # Talbot-Lago – French Racing Blue
    "talbot lago": "1B3F8A",
    "talbot-lago": "1B3F8A",
    # ERA – British Racing Green
    "era": "215732",
    # HWM – British Racing Green
    "hwm": "215732",
    "hwm alta": "215732",
    # Veritas – German silver
    "veritas": "C0C0C0",
    "veritas meteor": "C0C0C0",
    # AFM – German silver
    "afm": "C0C0C0",
    # Osca – Italian red
    "osca": "C8102E",
    # Arzani-Volpini – Italian red
    "arzani-volpini": "C8102E",
    # Frazer Nash – British Racing Green
    "frazer nash": "215732",
    # Thin Wall Special (Ferrari-based British entry)
    "thin wall special": "C8102E",
    # Emeryson – British Racing Green
    "emeryson": "215732",
    "emeryson climax": "215732",
    # Brabham – from 1962, Brabham used green then later other colours
    "brabham": "215732",
    "brabham climax": "215732",
    "brabham repco": "215732",
    "brabham ford": "215732",
    # Porsche – silver/white (German)
    "porsche": "C0C0C0",
    # De Tomaso – Italian red
    "de tomaso": "C8102E",
    "de tomaso ford": "C8102E",
    # LDS – South African
    "lds": "C0C0C0",
    # Scarab – American blue
    "scarab": "1B3F8A",
    # Lotus (general, post-BRG liveries handled above)
    "lotus": "215732",
    # ── 1970s–2000s ADDITIONS (teams not yet mapped) ─────────────────────
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


# Maps variant team names (from FastF1, Jolpica, etc.) to the canonical name
# stored in the DB. Keys are lowercase for case-insensitive matching.
TEAM_NAME_ALIASES: dict[str, str] = {
    # Red Bull
    "red bull": "Red Bull Racing",
    # Alpine
    "alpine f1 team": "Alpine",
    # Racing Bulls (formerly Toro Rosso → AlphaTauri → RB → Racing Bulls)
    "rb f1 team": "Racing Bulls",
    "rb": "Racing Bulls",
    # Cadillac
    "cadillac f1 team": "Cadillac",
    # Sauber / Kick Sauber (pre-2026 canonical name is "Sauber")
    "kick sauber": "Sauber",
    "stake f1 team kick sauber": "Sauber",
}

# Year-range aliases: (year_min, year_max, {lowercase_alias: canonical}).
# year_min/year_max are inclusive; None means unbounded.
# Checked before TEAM_NAME_ALIASES so era-specific rules take priority.
TEAM_NAME_ALIASES_BY_YEAR: list[tuple[int | None, int | None, dict[str, str]]] = [
    # Sauber rebranded to Audi from 2026 onwards.
    (
        2026,
        None,
        {
            "sauber": "Audi",
            "audi": "Audi",
            "audi f1 team": "Audi",
        },
    ),
]


def normalize_team_name(name: str, year: int | None = None) -> str:
    """Return canonical team name, resolving known aliases."""
    if not name:
        return name
    key = name.lower().strip()
    if year is not None:
        for year_min, year_max, aliases in TEAM_NAME_ALIASES_BY_YEAR:
            in_range = (year_min is None or year >= year_min) and (
                year_max is None or year <= year_max
            )
            if in_range and key in aliases:
                return aliases[key]
    return TEAM_NAME_ALIASES.get(key, name)


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
