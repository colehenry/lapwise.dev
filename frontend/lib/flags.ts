/**
 * Flag utility functions for displaying country flags as emojis
 *
 * Converts ISO 3166-1 alpha-3 country codes to flag emojis using
 * Unicode regional indicator symbols.
 */

// Map of ISO 3166-1 alpha-3 to alpha-2 country codes
const COUNTRY_CODE_MAP: Record<string, string> = {
  // Driver nationalities (from FastF1 data)
  NED: "NL", // Netherlands
  GBR: "GB", // Great Britain
  MON: "MC", // Monaco
  ESP: "ES", // Spain
  MEX: "MX", // Mexico
  CAN: "CA", // Canada
  AUS: "AU", // Australia
  JPN: "JP", // Japan
  CHN: "CN", // China
  THA: "TH", // Thailand
  FRA: "FR", // France
  GER: "DE", // Germany
  FIN: "FI", // Finland
  DEN: "DK", // Denmark
  USA: "US", // United States
  NZL: "NZ", // New Zealand
  ARG: "AR", // Argentina
  ITA: "IT", // Italy
  AUT: "AT", // Austria
  BRA: "BR", // Brazil
  BEL: "BE", // Belgium
  SWE: "SE", // Sweden
  POL: "PL", // Poland
  CHE: "CH", // Switzerland
  RUS: "RU", // Russia
  IND: "IN", // India
  COL: "CO", // Colombia
  VEN: "VE", // Venezuela
  MAL: "MY", // Malaysia
  SGP: "SG", // Singapore
};

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
 * Converts a 3-letter driver/country code to a flag emoji
 * @param countryCode - ISO 3166-1 alpha-3 country code (e.g., "NED", "GBR")
 * @returns Flag emoji string or empty string if not found
 */
export function getDriverFlagEmoji(countryCode: string | null): string {
  if (!countryCode) return "";

  const alpha2 = COUNTRY_CODE_MAP[countryCode.toUpperCase()];
  if (!alpha2) {
    console.warn(`Unknown country code: ${countryCode}`);
    return "";
  }

  return alpha2ToFlagEmoji(alpha2);
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
    console.warn(`Unknown team: ${teamName}`);
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
    console.warn(`Unknown circuit country: ${countryName}`);
    return "";
  }

  return alpha2ToFlagEmoji(alpha2);
}

/**
 * Gets the full country name from a 3-letter code
 * @param countryCode - ISO 3166-1 alpha-3 country code
 * @returns Full country name or the original code if not found
 */
export function getCountryName(countryCode: string | null): string {
  const countries: Record<string, string> = {
    NED: "Netherlands",
    GBR: "Great Britain",
    MON: "Monaco",
    ESP: "Spain",
    MEX: "Mexico",
    CAN: "Canada",
    AUS: "Australia",
    JPN: "Japan",
    CHN: "China",
    THA: "Thailand",
    FRA: "France",
    GER: "Germany",
    FIN: "Finland",
    DEN: "Denmark",
    USA: "United States",
    NZL: "New Zealand",
    ARG: "Argentina",
    ITA: "Italy",
    AUT: "Austria",
    BRA: "Brazil",
    BEL: "Belgium",
    SWE: "Sweden",
    POL: "Poland",
    CHE: "Switzerland",
    RUS: "Russia",
    IND: "India",
    COL: "Colombia",
    VEN: "Venezuela",
    MAL: "Malaysia",
    SGP: "Singapore",
  };

  return countryCode ? countries[countryCode] || countryCode : "Unknown";
}
