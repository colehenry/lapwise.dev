"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type DriverLapTimes, driverKey } from "@/lib/types";

type UseDriverSelectionOptions = {
  initialDrivers?: string[];
  maxDefaultDrivers?: number;
};

export function sortDriversByClassification(drivers: DriverLapTimes[]) {
  return [...drivers].sort(
    (a, b) => (a.final_position ?? 999) - (b.final_position ?? 999),
  );
}

export function useDriverSelection(
  drivers: DriverLapTimes[] | undefined,
  { initialDrivers, maxDefaultDrivers = 10 }: UseDriverSelectionOptions = {},
) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const initialDriverKey = useMemo(
    () => initialDrivers?.join(",") ?? "",
    [initialDrivers],
  );

  useEffect(() => {
    if (!drivers) return;

    const sorted = sortDriversByClassification(drivers);
    const available = new Set(sorted.map((driver) => driverKey(driver)));
    const requested = initialDriverKey
      .split(",")
      .filter((key) => available.has(key));

    setSelectedDrivers(
      requested.length > 0
        ? requested
        : sorted.slice(0, maxDefaultDrivers).map((driver) => driverKey(driver)),
    );
  }, [drivers, initialDriverKey, maxDefaultDrivers]);

  const toggleDriver = useCallback((key: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(key)
        ? prev.filter((driver) => driver !== key)
        : [...prev, key],
    );
  }, []);

  return { selectedDrivers, setSelectedDrivers, toggleDriver };
}
