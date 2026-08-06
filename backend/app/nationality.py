"""Driver nationality vocabulary.

Lapwise stores F1-style three-letter nationality codes (`NED`, `GER`, `SUI`),
not ISO 3166-1 alpha-3. FastF1 live timing emits this vocabulary directly.
The Jolpica dump emits ISO alpha-3 codes and English demonyms, both of which
normalize here before reaching `drivers.country_code`.

Every code in `LAPWISE_CODES` must have a flag and country name in
`frontend/lib/flags.ts`.
"""

LAPWISE_CODES = frozenset(
    {
        "ARG",
        "AUS",
        "AUT",
        "BEL",
        "BRA",
        "CAN",
        "CHI",
        "CHN",
        "COL",
        "CZE",
        "DEN",
        "ESP",
        "EST",
        "FIN",
        "FRA",
        "GBR",
        "GER",
        "HUN",
        "INA",
        "IND",
        "IRL",
        "ISR",
        "ITA",
        "JPN",
        "LIE",
        "MAL",
        "MEX",
        "MON",
        "NED",
        "NZL",
        "POL",
        "POR",
        "RHO",
        "RSA",
        "RUS",
        "SGP",
        "SUI",
        "SWE",
        "THA",
        "URU",
        "USA",
        "VEN",
    }
)

# ISO alpha-3 codes whose Lapwise spelling differs.
_ISO_TO_LAPWISE = {
    "CHE": "SUI",
    "CHL": "CHI",
    "DEU": "GER",
    "DNK": "DEN",
    "IDN": "INA",
    "MCO": "MON",
    "MYS": "MAL",
    "NLD": "NED",
    "PRT": "POR",
    "RSR": "RHO",
    "URY": "URU",
    "ZAF": "RSA",
}

_DEMONYM_TO_LAPWISE = {
    "american": "USA",
    "argentine": "ARG",
    "argentinian": "ARG",
    "australian": "AUS",
    "austrian": "AUT",
    "belgian": "BEL",
    "brazilian": "BRA",
    "british": "GBR",
    "canadian": "CAN",
    "chilean": "CHI",
    "chinese": "CHN",
    "colombian": "COL",
    "czech": "CZE",
    "danish": "DEN",
    "dutch": "NED",
    "east german": "GER",
    "english": "GBR",
    "estonian": "EST",
    "finnish": "FIN",
    "french": "FRA",
    "german": "GER",
    "hungarian": "HUN",
    "indian": "IND",
    "indonesian": "INA",
    "irish": "IRL",
    "israeli": "ISR",
    "italian": "ITA",
    "japanese": "JPN",
    "liechtensteiner": "LIE",
    "malaysian": "MAL",
    "mexican": "MEX",
    "monegasque": "MON",
    "new zealander": "NZL",
    "polish": "POL",
    "portuguese": "POR",
    "rhodesian": "RHO",
    "russian": "RUS",
    "scottish": "GBR",
    "singaporean": "SGP",
    "south african": "RSA",
    "spanish": "ESP",
    "swedish": "SWE",
    "swiss": "SUI",
    "thai": "THA",
    "uruguayan": "URU",
    "venezuelan": "VEN",
    "welsh": "GBR",
}


def normalize_country_code(value: str | None) -> str | None:
    """Map an ISO alpha-3 or Lapwise code to the Lapwise vocabulary."""
    if not value:
        return None
    code = str(value).strip().upper()
    if not code:
        return None
    code = _ISO_TO_LAPWISE.get(code, code)
    return code if code in LAPWISE_CODES else None


def normalize_demonym(value: str | None) -> str | None:
    """Map an English nationality demonym to a Lapwise code."""
    if not value:
        return None
    return _DEMONYM_TO_LAPWISE.get(str(value).strip().lower())
