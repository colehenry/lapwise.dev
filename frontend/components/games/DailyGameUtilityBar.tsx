"use client";

import { type ReactNode, useCallback, useState } from "react";
import DailyGameMenu, { type DailyGameMenuName } from "./DailyGameMenu";

const iconClass = "h-[19px] w-[19px] fill-none stroke-current stroke-[1.8]";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
      <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid h-[19px] w-[19px] place-items-center rounded-full border-[1.5px] border-current text-[13px] font-bold leading-none"
    >
      ?
    </span>
  );
}

export default function DailyGameUtilityBar({
  help,
  settings,
  statistics,
}: {
  help: ReactNode;
  settings: ReactNode;
  statistics: ReactNode;
}) {
  const [open, setOpen] = useState<DailyGameMenuName | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = useCallback((name: DailyGameMenuName) => {
    setOpen((current) => (current === name ? null : name));
  }, []);
  return (
    <div className="h-10 border-b border-line-soft">
      <div className="page-frame flex h-full items-center justify-end gap-[5px]">
        <DailyGameMenu
          name="settings"
          label="Settings"
          title="Settings"
          icon={<SettingsIcon />}
          open={open === "settings"}
          onClose={close}
          onToggle={toggle}
        >
          {settings}
        </DailyGameMenu>
        <DailyGameMenu
          name="statistics"
          label="Statistics and leaderboard"
          title="Statistics & leaderboard"
          icon={<StatsIcon />}
          open={open === "statistics"}
          onClose={close}
          onToggle={toggle}
        >
          {statistics}
        </DailyGameMenu>
        <DailyGameMenu
          name="help"
          label="Help"
          title="How it works"
          icon={<HelpIcon />}
          open={open === "help"}
          onClose={close}
          onToggle={toggle}
        >
          {help}
        </DailyGameMenu>
      </div>
    </div>
  );
}
