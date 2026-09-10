"use client";

import { useCallback, useState } from "react";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { type DriverLapTimes, driverKey } from "@/lib/types";

type DriverMultiSelectProps = {
  drivers: DriverLapTimes[];
  selectedDrivers: string[];
  onToggleDriver: (key: string) => void;
  isDriverDisabled?: (driver: DriverLapTimes) => boolean;
  disabledLabel?: string;
  label?: string;
};

export default function DriverMultiSelect({
  drivers,
  selectedDrivers,
  onToggleDriver,
  isDriverDisabled,
  disabledLabel = "no data",
  label = "Drivers",
}: DriverMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const dropdownRef = useOutsideClick<HTMLDivElement>(close);

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-line-soft text-ink-base hover:border-accent hover:text-accent-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright"
        aria-expanded={isOpen}
      >
        {label} ({selectedDrivers.length})
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface-panel border border-line-soft rounded-sm shadow-xl z-10 min-w-[220px] max-h-[280px] overflow-y-auto">
          {drivers.map((driver) => {
            const key = driverKey(driver);
            const isSelected = selectedDrivers.includes(key);
            const isDisabled = isDriverDisabled?.(driver) ?? false;
            const color = driver.team_color
              ? `#${driver.team_color}`
              : "var(--delta-neutral)";

            return (
              <label
                key={key}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-surface-raised cursor-pointer ${isDisabled ? "opacity-40" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {
                    if (!isDisabled) onToggleDriver(key);
                  }}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-[10px] font-mono text-ink-faint w-5">
                  {driver.final_position ?? "-"}
                </span>
                <span className="text-xs font-bold font-mono" style={{ color }}>
                  {driver.driver_code ?? driver.full_name}
                </span>
                {isDisabled && (
                  <span className="text-[9px] font-mono text-ink-faint ml-auto">
                    {disabledLabel}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
