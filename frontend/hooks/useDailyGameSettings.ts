"use client";

import { useEffect, useState } from "react";

export type DailyGameSettings = {
  highContrast: boolean;
  reduceMotion: boolean;
};

const SETTINGS_KEY = "lapwise:daily-games:settings";
const DEFAULTS: DailyGameSettings = {
  highContrast: false,
  reduceMotion: false,
};

export function useDailyGameSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {
      setSettings(DEFAULTS);
    }
  }, []);
  const update = (next: DailyGameSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Preferences still apply for this page view when storage is unavailable.
    }
  };
  return { settings, update };
}
