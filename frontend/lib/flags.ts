/**
 * Flag utility functions for displaying country flags as emojis
 *
 * Converts country codes to flag emojis using Unicode regional indicator
 * symbols.
 */

/**
 * Driver nationality codes, keyed by the F1-style three-letter code stored in
 * `drivers.country_code`. These are not ISO 3166-1 alpha-3 — the backend
 * normalizes ISO and FastF1 values into this vocabulary in
 * `backend/app/nationality.py`, which must stay in sync with these keys.
 */
const DRIVER_COUNTRIES: Record<string, { alpha2: string; name: string }> = {
  ARG: { alpha2: "AR", name: "Argentina" },
  AUS: { alpha2: "AU", name: "Australia" },
  AUT: { alpha2: "AT", name: "Austria" },
  BEL: { alpha2: "BE", name: "Belgium" },
  BRA: { alpha2: "BR", name: "Brazil" },
  CAN: { alpha2: "CA", name: "Canada" },
  CHI: { alpha2: "CL", name: "Chile" },
  CHN: { alpha2: "CN", name: "China" },
  COL: { alpha2: "CO", name: "Colombia" },
  CZE: { alpha2: "CZ", name: "Czechia" },
  DEN: { alpha2: "DK", name: "Denmark" },
  ESP: { alpha2: "ES", name: "Spain" },
  EST: { alpha2: "EE", name: "Estonia" },
  FIN: { alpha2: "FI", name: "Finland" },
  FRA: { alpha2: "FR", name: "France" },
  GBR: { alpha2: "GB", name: "Great Britain" },
  GER: { alpha2: "DE", name: "Germany" },
  HUN: { alpha2: "HU", name: "Hungary" },
  INA: { alpha2: "ID", name: "Indonesia" },
  IND: { alpha2: "IN", name: "India" },
  IRL: { alpha2: "IE", name: "Ireland" },
  ISR: { alpha2: "IL", name: "Israel" },
  ITA: { alpha2: "IT", name: "Italy" },
  JPN: { alpha2: "JP", name: "Japan" },
  LIE: { alpha2: "LI", name: "Liechtenstein" },
  MAL: { alpha2: "MY", name: "Malaysia" },
  MEX: { alpha2: "MX", name: "Mexico" },
  MON: { alpha2: "MC", name: "Monaco" },
  NED: { alpha2: "NL", name: "Netherlands" },
  NZL: { alpha2: "NZ", name: "New Zealand" },
  POL: { alpha2: "PL", name: "Poland" },
  POR: { alpha2: "PT", name: "Portugal" },
  // Rhodesia has no flag emoji; Zimbabwe is the successor state.
  RHO: { alpha2: "ZW", name: "Rhodesia" },
  RSA: { alpha2: "ZA", name: "South Africa" },
  RUS: { alpha2: "RU", name: "Russia" },
  SGP: { alpha2: "SG", name: "Singapore" },
  SUI: { alpha2: "CH", name: "Switzerland" },
  SWE: { alpha2: "SE", name: "Sweden" },
  THA: { alpha2: "TH", name: "Thailand" },
  URU: { alpha2: "UY", name: "Uruguay" },
  USA: { alpha2: "US", name: "United States" },
  VEN: { alpha2: "VE", name: "Venezuela" },
};

export const DRIVER_COUNTRY_CODES = Object.keys(DRIVER_COUNTRIES);

// Map of F1 team names (2018-2025) to country codes (alpha-2)
const TEAM_COUNTRY_MAP: Record<string, string> = {
  // Current teams (2024-2025)
  "Red Bull Racing": "AT", // Austria
  Ferrari: "IT", // Italy
  Mercedes: "DE", // Germany
  McLaren: "GB", // Great Britain
  "Aston Martin": "GB", // Great Britain
  Alpine: "FR", // France
  Williams: "GB", // Great Britain
  "Haas F1 Team": "US", // United States
  "Kick Sauber": "CH", // Switzerland
  RB: "IT", // Italy (based in Faenza, Italy)
  "Racing Bulls": "IT", // Italy
  Audi: "DE", // Germany
  Cadillac: "US", // United States

  // Historical teams (2018-2023)
  AlphaTauri: "IT", // Italy (Faenza)
  "Alfa Romeo": "CH", // Switzerland (Hinwil)
  "Alfa Romeo Racing": "CH", // Switzerland
  Renault: "FR", // France
  "Racing Point": "GB", // Great Britain
  "Toro Rosso": "IT", // Italy
  "Force India": "GB", // Great Britain (Silverstone)
  Sauber: "CH", // Switzerland
};

// Map of circuit countries (full names) to alpha-2 codes
const CIRCUIT_COUNTRY_MAP: Record<string, string> = {
  // Current calendar countries
  Bahrain: "BH",
  "Saudi Arabia": "SA",
  Australia: "AU",
  Japan: "JP",
  China: "CN",
  USA: "US",
  "United States": "US",
  Italy: "IT",
  Monaco: "MC",
  Spain: "ES",
  Canada: "CA",
  Austria: "AT",
  "Great Britain": "GB",
  UK: "GB",
  "United Kingdom": "GB",
  Hungary: "HU",
  Belgium: "BE",
  Netherlands: "NL",
  Singapore: "SG",
  Mexico: "MX",
  Brazil: "BR",
  "United Arab Emirates": "AE",
  UAE: "AE",
  Azerbaijan: "AZ",
  France: "FR",
  Germany: "DE",
  Russia: "RU",
  Turkey: "TR",
  Portugal: "PT",
  Qatar: "QA",

  // Historical countries
  Malaysia: "MY",
  India: "IN",
  Korea: "KR",
  "South Korea": "KR",
  Argentina: "AR",
  Morocco: "MA",
};

/**
 * Converts a 2-letter country code to a flag emoji
 * @param alpha2Code - ISO 3166-1 alpha-2 country code (e.g., "NL", "GB")
 * @returns Flag emoji string
 */
function alpha2ToFlagEmoji(alpha2Code: string): string {
  // Convert to uppercase
  const code = alpha2Code.toUpperCase();

  // Validate input (must be 2 letters)
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
    return "";
  }

  // Convert each letter to regional indicator symbol
  // Regional indicator symbols are U+1F1E6 to U+1F1FF (A-Z)
  const codePoints = [...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);

  return String.fromCodePoint(...codePoints);
}

/**
 * Converts a 3-letter driver nationality code to a flag emoji
 * @param countryCode - Driver nationality code (e.g., "NED", "GBR")
 * @returns Flag emoji string or empty string if not found
 */
export function getDriverFlagEmoji(countryCode: string | null): string {
  if (!countryCode) return "";

  const country = DRIVER_COUNTRIES[countryCode.toUpperCase()];
  if (!country) {
    return "";
  }

  return alpha2ToFlagEmoji(country.alpha2);
}

/**
 * Converts a team name to a flag emoji
 * @param teamName - Full F1 team name (e.g., "Red Bull Racing", "Ferrari")
 * @returns Flag emoji string or empty string if not found
 */
export function getTeamFlagEmoji(teamName: string | null): string {
  if (!teamName) return "";

  const alpha2 = TEAM_COUNTRY_MAP[teamName];
  if (!alpha2) {
    return "";
  }

  return alpha2ToFlagEmoji(alpha2);
}

/**
 * Converts a circuit country name to a flag emoji
 * @param countryName - Full country name (e.g., "Bahrain", "United States")
 * @returns Flag emoji string or empty string if not found
 */
export function getCircuitFlagEmoji(countryName: string | null): string {
  if (!countryName) return "";

  const alpha2 = CIRCUIT_COUNTRY_MAP[countryName];
  if (!alpha2) {
    return "";
  }

  return alpha2ToFlagEmoji(alpha2);
}

/**
 * Gets the full country name from a driver nationality code
 * @param countryCode - Driver nationality code (e.g., "NED", "GBR")
 * @returns Full country name or the original code if not found
 */
export function getCountryName(countryCode: string | null): string {
  if (!countryCode) return "Unknown";

  return DRIVER_COUNTRIES[countryCode.toUpperCase()]?.name ?? countryCode;
}
