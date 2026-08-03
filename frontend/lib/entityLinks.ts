type DriverLinkInput = {
  driver_slug?: string | null;
  driver_code?: string | null;
  full_name?: string | null;
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function driverHref(driver: DriverLinkInput): string | null {
  const identifier =
    driver.driver_slug ?? driver.driver_code ?? driver.full_name;
  return identifier ? `/drivers/${encodePathSegment(identifier)}` : null;
}

type ConstructorLinkInput = {
  constructor_slug?: string | null;
  team_name?: string | null;
};

export function constructorHref(
  input: string | ConstructorLinkInput | null | undefined,
): string | null {
  const identifier =
    typeof input === "string"
      ? input
      : (input?.constructor_slug ?? input?.team_name);
  return identifier ? `/constructors/${encodePathSegment(identifier)}` : null;
}

export function circuitHref(
  circuitId: number | string | null | undefined,
): string | null {
  return circuitId != null
    ? `/circuits/${encodePathSegment(String(circuitId))}`
    : null;
}
