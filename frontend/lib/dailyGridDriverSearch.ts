import type { GameDriverCatalogItem } from "@/lib/queries/dailyGrid";

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const exactMatchRank = (driver: GameDriverCatalogItem, query: string) => {
  const values = [
    driver.full_name,
    driver.driver_slug,
    driver.driver_code ?? "",
  ];
  const index = values.findIndex(
    (value) => normalizeSearchValue(value) === query,
  );
  return index === -1 ? values.length : index;
};

export function findGameDrivers(
  drivers: GameDriverCatalogItem[],
  rawQuery: string,
  excludedSlugs: Set<string>,
  limit = 12,
) {
  const query = normalizeSearchValue(rawQuery.trim());
  if (query.length < 2) return [];

  return drivers
    .filter((driver) => {
      if (excludedSlugs.has(driver.driver_slug)) return false;
      return [
        driver.full_name,
        driver.driver_slug,
        driver.driver_code ?? "",
      ].some((value) => normalizeSearchValue(value).includes(query));
    })
    .sort((left, right) => {
      const exactDifference =
        exactMatchRank(left, query) - exactMatchRank(right, query);
      if (exactDifference !== 0) return exactDifference;
      const entryDifference = right.race_entries - left.race_entries;
      if (entryDifference !== 0) return entryDifference;
      return left.full_name.localeCompare(right.full_name);
    })
    .slice(0, limit);
}
