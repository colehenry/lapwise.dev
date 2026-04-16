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

export function constructorHref(
  teamName: string | null | undefined,
): string | null {
  return teamName ? `/constructors/${encodePathSegment(teamName)}` : null;
}

export function circuitHref(
  circuitId: number | string | null | undefined,
): string | null {
  return circuitId != null
    ? `/circuits/${encodePathSegment(String(circuitId))}`
    : null;
}
