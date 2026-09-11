"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { isActiveHref, NavIcon, type NavLink } from "./navigationLinks";

/** Shared hover/focus dropdown for small groups of primary navigation links. */
export default function NavLinkMenu({
  icon,
  label,
  links,
  pathname,
}: {
  icon: ReactNode;
  label: string;
  links: NavLink[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = links.some((link) => isActiveHref(pathname, link.href));
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 260);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover augments the real button and focus behavior
    <div
      className="relative h-full"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          cancelClose();
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        cancelClose();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`flex h-full items-center gap-2 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
          active
            ? "font-semibold text-ink-strong"
            : "text-ink-soft hover:text-ink-base"
        }`}
      >
        {icon}
        {label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 w-48 pt-2">
          <div className="overflow-hidden rounded-sm border border-line-soft bg-surface-panel shadow-floating-soft">
            {links.map((link) => {
              const linkActive = isActiveHref(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={linkActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 border-b border-line-soft px-3 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-surface-raised hover:text-ink-strong ${
                    linkActive ? "text-ink-strong" : "text-ink-base"
                  }`}
                >
                  <NavIcon link={link} active={linkActive} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
