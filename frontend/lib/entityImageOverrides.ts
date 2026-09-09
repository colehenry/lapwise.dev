type EntityImageOverride = {
  headshotUrl?: string;
  portraitUrl?: string;
  logoUrl?: string;
  photoUrl?: string;
  bannerUrl?: string;
};

type DriverImageInput = {
  driver_code?: string | null;
  full_name?: string | null;
  headshot_url?: string | null;
};

type ConstructorImageInput = {
  team_name?: string | null;
  logo_url?: string | null;
};

const F1_MEDIA_BASE = "https://media.formula1.com/image/upload";
const F1_MEDIA_VERSION = "v1740000001";

function normalizeEntityKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function driverImagePath(team: string, asset: string): string {
  return `common/f1/2026/${team}/${asset}/2026${team}${asset}right.webp`;
}

function driverHeadshot(team: string, asset: string): string {
  return `${F1_MEDIA_BASE}/c_thumb,g_face,h_640,w_640/q_auto/${F1_MEDIA_VERSION}/${driverImagePath(team, asset)}`;
}

function driverPortrait(team: string, asset: string): string {
  return `${F1_MEDIA_BASE}/c_lfill,w_720/q_auto/${F1_MEDIA_VERSION}/${driverImagePath(team, asset)}`;
}

function driverBanner(team: string, asset: string): string {
  return `${F1_MEDIA_BASE}/c_fill,g_auto,h_720,w_1600/q_auto/${F1_MEDIA_VERSION}/${driverImagePath(team, asset)}`;
}

function teamLogo(team: string): string {
  return `${F1_MEDIA_BASE}/c_lfill,w_384/q_auto/${F1_MEDIA_VERSION}/common/f1/2026/${team}/2026${team}logowhite.webp`;
}

function teamCarBanner(team: string): string {
  return `${F1_MEDIA_BASE}/c_lfill,w_1800/q_auto/${F1_MEDIA_VERSION}/common/f1/2026/${team}/2026${team}carright.webp`;
}

function teamCarPhoto(team: string): string {
  return `${F1_MEDIA_BASE}/c_lfill,w_900/q_auto/${F1_MEDIA_VERSION}/common/f1/2026/${team}/2026${team}carright.webp`;
}

function teamImages(team: string): EntityImageOverride {
  return {
    logoUrl: teamLogo(team),
    photoUrl: teamCarPhoto(team),
    bannerUrl: teamCarBanner(team),
  };
}

const DRIVER_ASSETS = [
  ["RUS", "George Russell", "mercedes", "georus01"],
  ["ANT", "Andrea Kimi Antonelli", "mercedes", "andant01"],
  ["LEC", "Charles Leclerc", "ferrari", "chalec01"],
  ["HAM", "Lewis Hamilton", "ferrari", "lewham01"],
  ["NOR", "Lando Norris", "mclaren", "lannor01"],
  ["PIA", "Oscar Piastri", "mclaren", "oscpia01"],
  ["OCO", "Esteban Ocon", "haasf1team", "estoco01"],
  ["BEA", "Oliver Bearman", "haasf1team", "olibea01"],
  ["GAS", "Pierre Gasly", "alpine", "piegas01"],
  ["COL", "Franco Colapinto", "alpine", "fracol01"],
  ["VER", "Max Verstappen", "redbullracing", "maxver01"],
  ["HAD", "Isack Hadjar", "redbullracing", "isahad01"],
  ["LAW", "Liam Lawson", "racingbulls", "lialaw01"],
  ["LIN", "Arvid Lindblad", "racingbulls", "arvlin01"],
  ["HUL", "Nico Hulkenberg", "audi", "nichul01"],
  ["BOR", "Gabriel Bortoleto", "audi", "gabbor01"],
  ["SAI", "Carlos Sainz", "williams", "carsai01"],
  ["ALB", "Alex Albon", "williams", "alealb01"],
  ["PER", "Sergio Perez", "cadillac", "serper01"],
  ["BOT", "Valtteri Bottas", "cadillac", "valbot01"],
  ["ALO", "Fernando Alonso", "astonmartin", "feralo01"],
  ["STR", "Lance Stroll", "astonmartin", "lanstr01"],
] as const;

const DRIVER_IMAGE_OVERRIDES = DRIVER_ASSETS.reduce<
  Record<string, EntityImageOverride>
>((acc, [code, name, team, asset]) => {
  const override = {
    headshotUrl: driverHeadshot(team, asset),
    portraitUrl: driverPortrait(team, asset),
    bannerUrl: driverBanner(team, asset),
  };

  acc[normalizeEntityKey(code)] = override;
  acc[normalizeEntityKey(name)] = override;

  return acc;
}, {});

const CONSTRUCTOR_IMAGE_OVERRIDES: Record<string, EntityImageOverride> = {
  alpine: teamImages("alpine"),
  astonmartin: teamImages("astonmartin"),
  audi: teamImages("audi"),
  cadillac: teamImages("cadillac"),
  ferrari: teamImages("ferrari"),
  haasf1team: teamImages("haasf1team"),
  haas: teamImages("haasf1team"),
  mclaren: teamImages("mclaren"),
  mercedes: teamImages("mercedes"),
  racingbulls: teamImages("racingbulls"),
  redbullracing: teamImages("redbullracing"),
  redbull: teamImages("redbullracing"),
  williams: teamImages("williams"),
};

const CONSTRUCTOR_LOGO_INVERT_ON_LIGHT = new Set<string>([
  "alpine",
  "astonmartin",
  "audi",
  "cadillac",
  "haas",
  "haasf1team",
  "mclaren",
  "mercedes",
  "racingbulls",
  "redbull",
  "redbullracing",
  "williams",
]);

// Driver imagery now comes from the owned Commons library, which covers the
// full 2026 grid. Flip to true to fall back to hotlinked Formula 1 media.
// Constructor overrides below are unaffected: no owned team assets exist yet.
const USE_FORMULA1_DRIVER_HOTLINKS = false;

export function getDriverImageOverride(
  driver: DriverImageInput,
): EntityImageOverride | null {
  if (!USE_FORMULA1_DRIVER_HOTLINKS) return null;

  const codeOverride =
    DRIVER_IMAGE_OVERRIDES[normalizeEntityKey(driver.driver_code)];
  if (codeOverride) return codeOverride;

  return DRIVER_IMAGE_OVERRIDES[normalizeEntityKey(driver.full_name)] ?? null;
}

export function getDriverHeadshotUrl(driver: DriverImageInput): string | null {
  return (
    getDriverImageOverride(driver)?.headshotUrl ?? driver.headshot_url ?? null
  );
}

export function getDriverPortraitUrl(driver: DriverImageInput): string | null {
  return (
    getDriverImageOverride(driver)?.portraitUrl ??
    getDriverImageOverride(driver)?.headshotUrl ??
    driver.headshot_url ??
    null
  );
}

export function getDriverBannerUrl(driver: DriverImageInput): string | null {
  return getDriverImageOverride(driver)?.bannerUrl ?? null;
}

export function getConstructorImageOverride(
  team: ConstructorImageInput,
): EntityImageOverride | null {
  return (
    CONSTRUCTOR_IMAGE_OVERRIDES[normalizeEntityKey(team.team_name)] ?? null
  );
}

export function getConstructorLogoUrl(
  team: ConstructorImageInput,
): string | null {
  return getConstructorImageOverride(team)?.logoUrl ?? team.logo_url ?? null;
}

export function shouldInvertConstructorLogoOnLight(
  team: ConstructorImageInput,
): boolean {
  return CONSTRUCTOR_LOGO_INVERT_ON_LIGHT.has(
    normalizeEntityKey(team.team_name),
  );
}

export function getConstructorPhotoUrl(
  team: ConstructorImageInput,
): string | null {
  return getConstructorImageOverride(team)?.photoUrl ?? null;
}

export function getConstructorBannerUrl(
  team: ConstructorImageInput,
): string | null {
  return getConstructorImageOverride(team)?.bannerUrl ?? null;
}
