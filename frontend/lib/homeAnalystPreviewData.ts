/** Scripted 2025 championship dataset behind the home AI analyst demo. */

export const QUESTION =
  "How did Lando and Max overtake Oscar in the 2025 championship?";

export const INTRO_TEXT =
  "**Piastri started P10 in Melbourne** — earning just 2 points while Norris won. He immediately fired back with victories at **Bahrain**, **Saudi Arabia**, and **Miami** to take the championship lead. A **Norris win at Monaco** (R8) briefly closed the gap to just **3 points**, before Piastri's Spain win and a Norris DNF in **Canada** pushed his lead back out to **22 points**.";

export const TABLE_ROWS = [
  {
    pos: "1",
    driver: "Lando Norris",
    driverCode: "NOR",
    team: "McLaren",
    pts: "423",
  },
  {
    pos: "2",
    driver: "Max Verstappen",
    driverCode: "VER",
    team: "Red Bull Racing",
    pts: "421",
  },
  {
    pos: "3",
    driver: "Oscar Piastri",
    driverCode: "PIA",
    team: "McLaren",
    pts: "410",
  },
  {
    pos: "4",
    driver: "George Russell",
    driverCode: "RUS",
    team: "Mercedes",
    pts: "319",
  },
  {
    pos: "5",
    driver: "Charles Leclerc",
    driverCode: "LEC",
    team: "Ferrari",
    pts: "242",
  },
];

export const OUTRO_TEXT =
  "**Piastri's lead peaked at 34 points** after Zandvoort (R15), where Norris retired. The comeback started when Verstappen won **Italy and Baku** back-to-back while Piastri scored zero in Azerbaijan — the lead was suddenly just 25 points. Norris swept **Mexico City** (R20) to overtake Piastri by a single point, and sealed the title with a **2-point margin over Verstappen** — the closest finish in a decade.";

// Real 2025 points after each Grand Prix — source: /api/results/2025/points-progression
export const CHART_DATA = [
  { round: "1", event_name: "Australian GP", NOR: 25, VER: 18, PIA: 2 },
  { round: "2", event_name: "Chinese GP", NOR: 44, VER: 36, PIA: 34 },
  { round: "3", event_name: "Japanese GP", NOR: 62, VER: 61, PIA: 49 },
  { round: "4", event_name: "Bahrain GP", NOR: 77, VER: 69, PIA: 74 },
  { round: "5", event_name: "Saudi Arabian GP", NOR: 89, VER: 87, PIA: 99 },
  { round: "6", event_name: "Miami GP", NOR: 115, VER: 99, PIA: 131 },
  { round: "7", event_name: "Emilia Romagna GP", NOR: 133, VER: 124, PIA: 146 },
  { round: "8", event_name: "Monaco GP", NOR: 158, VER: 136, PIA: 161 },
  { round: "9", event_name: "Spanish GP", NOR: 176, VER: 137, PIA: 186 },
  { round: "10", event_name: "Canadian GP", NOR: 176, VER: 155, PIA: 198 },
  { round: "11", event_name: "Austrian GP", NOR: 201, VER: 155, PIA: 216 },
  { round: "12", event_name: "British GP", NOR: 226, VER: 165, PIA: 234 },
  { round: "13", event_name: "Belgian GP", NOR: 250, VER: 185, PIA: 266 },
  { round: "14", event_name: "Hungarian GP", NOR: 275, VER: 187, PIA: 284 },
  { round: "15", event_name: "Dutch GP", NOR: 275, VER: 205, PIA: 309 },
  { round: "16", event_name: "Italian GP", NOR: 293, VER: 230, PIA: 324 },
  { round: "17", event_name: "Azerbaijan GP", NOR: 299, VER: 255, PIA: 324 },
  { round: "18", event_name: "Singapore GP", NOR: 314, VER: 273, PIA: 336 },
  { round: "19", event_name: "United States GP", NOR: 332, VER: 306, PIA: 346 },
  { round: "20", event_name: "Mexico City GP", NOR: 357, VER: 321, PIA: 356 },
  { round: "21", event_name: "São Paulo GP", NOR: 390, VER: 341, PIA: 366 },
  { round: "22", event_name: "Las Vegas GP", NOR: 390, VER: 366, PIA: 366 },
  { round: "23", event_name: "Qatar GP", NOR: 408, VER: 396, PIA: 392 },
  { round: "24", event_name: "Abu Dhabi GP", NOR: 423, VER: 421, PIA: 410 },
];

export const DRIVERS = [
  { key: "NOR", name: "Norris" },
  { key: "VER", name: "Verstappen" },
  { key: "PIA", name: "Piastri" },
];

export const DRIVER_TEAMS: Record<string, string> = {
  NOR: "McLaren",
  VER: "Red Bull Racing",
  PIA: "McLaren",
};
