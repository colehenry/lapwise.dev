import type { DailyGameSettings } from "@/hooks/useDailyGameSettings";

export default function DailyGameSettingsPanel({
  settings,
  onChange,
}: {
  settings: DailyGameSettings;
  onChange: (settings: DailyGameSettings) => void;
}) {
  const toggle = (key: keyof DailyGameSettings) =>
    onChange({ ...settings, [key]: !settings[key] });
  return (
    <div className="grid gap-3 p-4 text-[13px] text-ink-base">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <strong className="block text-ink-strong">High-contrast clues</strong>
          <span className="text-ink-soft">
            Strengthens exact and close colors.
          </span>
        </span>
        <input
          type="checkbox"
          checked={settings.highContrast}
          onChange={() => toggle("highContrast")}
          className="h-4 w-4 accent-accent-bright"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <strong className="block text-ink-strong">Reduce motion</strong>
          <span className="text-ink-soft">Disables game reveal animation.</span>
        </span>
        <input
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={() => toggle("reduceMotion")}
          className="h-4 w-4 accent-accent-bright"
        />
      </label>
    </div>
  );
}
