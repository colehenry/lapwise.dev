"use client";

import Link from "next/link";
import { useState } from "react";
import {
  archiveLinks,
  DatabaseIcon,
  isActiveHref,
  NavIcon,
} from "./navigationLinks";

/**
 * Opens on hover, as it always has. Focus opens it too, so the keyboard is not
 * left out, and it closes on Escape.
 */
export default function NavArchiveMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = archiveLinks.some((link) => isActiveHref(pathname, link.href));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only opens the menu on hover; the trigger inside it is a real button
    <div
      className="relative h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
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
        <DatabaseIcon />
        Archive
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
        <div className="absolute left-0 top-full z-10 w-44 pt-2">
          <div className="overflow-hidden rounded-sm border border-line-soft bg-surface-panel shadow-floating-soft">
            {archiveLinks.map((link) => {
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
