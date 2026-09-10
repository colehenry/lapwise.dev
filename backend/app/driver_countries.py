"""Small stable country reference used by the driver-guess comparison."""

COUNTRIES = {
    "ARG": ("Argentina", "South America"),
    "AUS": ("Australia", "Oceania"),
    "AUT": ("Austria", "Europe"),
    "BEL": ("Belgium", "Europe"),
    "BRA": ("Brazil", "South America"),
    "CAN": ("Canada", "North America"),
    "CHI": ("Chile", "South America"),
    "CHN": ("China", "Asia"),
    "COL": ("Colombia", "South America"),
    "CZE": ("Czechia", "Europe"),
    "DEN": ("Denmark", "Europe"),
    "ESP": ("Spain", "Europe"),
    "EST": ("Estonia", "Europe"),
    "FIN": ("Finland", "Europe"),
    "FRA": ("France", "Europe"),
    "GBR": ("Great Britain", "Europe"),
    "GER": ("Germany", "Europe"),
    "HUN": ("Hungary", "Europe"),
    "INA": ("Indonesia", "Asia"),
    "IND": ("India", "Asia"),
    "IRL": ("Ireland", "Europe"),
    "ISR": ("Israel", "Asia"),
    "ITA": ("Italy", "Europe"),
    "JPN": ("Japan", "Asia"),
    "LIE": ("Liechtenstein", "Europe"),
    "MAL": ("Malaysia", "Asia"),
    "MEX": ("Mexico", "North America"),
    "MON": ("Monaco", "Europe"),
    "NED": ("Netherlands", "Europe"),
    "NZL": ("New Zealand", "Oceania"),
    "POL": ("Poland", "Europe"),
    "POR": ("Portugal", "Europe"),
    "RHO": ("Rhodesia", "Africa"),
    "RSA": ("South Africa", "Africa"),
    "RUS": ("Russia", "Europe"),
    "SGP": ("Singapore", "Asia"),
    "SUI": ("Switzerland", "Europe"),
    "SWE": ("Sweden", "Europe"),
    "THA": ("Thailand", "Asia"),
    "URU": ("Uruguay", "South America"),
    "USA": ("United States", "North America"),
    "VEN": ("Venezuela", "South America"),
}


def country_name(code: str | None) -> str:
    return COUNTRIES.get(code or "", (code or "Unknown", "Unknown"))[0]


def continent(code: str | None) -> str | None:
    value = COUNTRIES.get(code or "")
    return value[1] if value else None
