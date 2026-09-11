"use client";

import { type ReactNode, useEffect, useRef } from "react";

export type DailyGameMenuName = "settings" | "statistics" | "help";

export default function DailyGameMenu({
  children,
  icon,
  label,
  name,
  onClose,
  onToggle,
  open,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
  name: DailyGameMenuName;
  onClose: () => void;
  onToggle: (name: DailyGameMenuName) => void;
  open: boolean;
  title: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        onClose();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [onClose, open]);

  return (
    <div ref={root} className="relative h-8">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${name}-daily-game-menu`}
        onClick={() => onToggle(name)}
        className="grid h-8 w-8 place-items-center rounded-sm text-ink-base hover:bg-surface-band hover:text-ink-strong focus-visible:bg-surface-band focus-visible:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
      >
        {icon}
      </button>
      {open && (
        <section
          id={`${name}-daily-game-menu`}
          aria-label={title}
          className="absolute right-0 top-[38px] z-[80] w-[min(420px,calc(100vw-24px))] rounded-md border border-line-strong bg-surface-band shadow-[var(--shadow-floating)]"
        >
          <h2 className="m-0 border-b border-line-soft px-[13px] py-[11px] text-[15px] font-bold text-ink-strong">
            {title}
          </h2>
          {children}
        </section>
      )}
    </div>
  );
}
