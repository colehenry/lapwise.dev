"use client";

import Link from "next/link";
import {
  GamesIcon,
  gamesLinks,
  isActiveHref,
  NavIcon,
  navLinksAfter,
  navLinksBefore,
} from "./navigationLinks";

/** Thumb-reach navigation. Flat, hairline-topped, accent marks the active tab. */
export default function MobileNavDock({
  pathname,
  menuOpen,
  gamesOpen,
  onToggleGames,
  onToggleMenu,
}: {
  pathname: string;
  menuOpen: boolean;
  gamesOpen: boolean;
  onToggleGames: () => void;
  onToggleMenu: () => void;
}) {
  const cell =
    "relative flex min-h-12 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold uppercase leading-tight tracking-wide transition-colors";
  const marker =
    "after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:bg-accent";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] md:hidden">
      <div className="grid grid-cols-5 border-t border-line-soft bg-surface-band pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={onToggleGames}
          aria-label={
            gamesOpen ? "Close Daily Games menu" : "Open Daily Games menu"
          }
          aria-expanded={menuOpen && gamesOpen}
          className={`${cell} ${
            gamesLinks.some((link) => isActiveHref(pathname, link.href)) ||
            (menuOpen && gamesOpen)
              ? `text-accent-light ${marker}`
              : "text-ink-soft"
          }`}
        >
          <GamesIcon />
          <span>Games</span>
        </button>
        {[...navLinksBefore, ...navLinksAfter].map((link) => {
          const active = isActiveHref(pathname, link.href);
          const label = link.href === "/results" ? "Races" : link.label;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`${cell} ${
                active ? `text-accent-light ${marker}` : "text-ink-soft"
              }`}
            >
              <NavIcon link={link} active={active} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`${cell} ${
            menuOpen ? `text-accent-light ${marker}` : "text-ink-soft"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"}
            />
          </svg>
          <span>More</span>
        </button>
      </div>
    </div>
  );
}
