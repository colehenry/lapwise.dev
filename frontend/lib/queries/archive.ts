import { queryOptions } from "@tanstack/react-query";
import { apiHeaders, apiUrl } from "@/lib/api";
import type {
  CircuitInfo,
  ConstructorListResponse,
  DriverListResponse,
} from "@/lib/types";

/**
 * All-time driver, constructor, and circuit listings. Archive routes, the
 * favorites picker, and the home AI preview share these keys instead of
 * fetching the same list under a name of their own.
 */
export const archiveKeys = {
  drivers: (includeSprint: boolean) => ["drivers-all", includeSprint] as const,
  constructors: (includeSprint: boolean) =>
    ["constructors-all", includeSprint] as const,
  circuits: () => ["circuits-all"] as const,
};

export type CircuitsResponse = {
  circuits: CircuitInfo[];
  total: number;
};

const LIST_STALE_TIME = 1000 * 60 * 5;

function listPath(base: string, includeSprint: boolean): string {
  return includeSprint ? base : `${base}?include_sprint=false`;
}

async function getJson<T>(path: string, error: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: apiHeaders() });
  if (!res.ok) throw new Error(error);
  return res.json();
}

export function driversQuery(includeSprint = true) {
  return queryOptions({
    queryKey: archiveKeys.drivers(includeSprint),
    queryFn: () =>
      getJson<DriverListResponse>(
        listPath("/api/drivers/", includeSprint),
        "Failed to fetch drivers",
      ),
    staleTime: LIST_STALE_TIME,
  });
}

export function constructorsQuery(includeSprint = true) {
  return queryOptions({
    queryKey: archiveKeys.constructors(includeSprint),
    queryFn: () =>
      getJson<ConstructorListResponse>(
        listPath("/api/constructors/", includeSprint),
        "Failed to fetch constructors",
      ),
    staleTime: LIST_STALE_TIME,
  });
}

export function circuitsQuery() {
  return queryOptions({
    queryKey: archiveKeys.circuits(),
    queryFn: () =>
      getJson<CircuitsResponse>("/api/circuits/", "Failed to fetch circuits"),
    staleTime: LIST_STALE_TIME,
  });
}

export function selectCircuitList(data: CircuitsResponse): CircuitInfo[] {
  return data.circuits ?? [];
}
