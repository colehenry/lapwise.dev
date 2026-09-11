"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { LapwiseWordmark } from "@/components/ui/BrandLogo";
import MobileNavDock from "./MobileNavDock";
import MobileNavDrawer from "./MobileNavDrawer";
import NavLinkMenu from "./NavLinkMenu";
import NavThemeToggle from "./NavThemeToggle";
import NavUserMenu from "./NavUserMenu";
import {
  archiveLinks,
  DatabaseIcon,
  GamesIcon,
  gamesLinks,
  isActiveHref,
  NavIcon,
  navLinksAfter,
  navLinksBefore,
} from "./navigationLinks";

/**
 * Full-bleed: the bar spans the screen and the gutter is the only margin. Three
 * columns so the links sit centred in the bar however wide the wordmark and the
 * auth control happen to be.
 */
const FRAME = "page-frame grid h-full grid-cols-[1fr_auto_1fr] items-center";

export default function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGamesOpen, setMobileGamesOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
  const lastScroll = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing on navigation is the point
  useEffect(() => {
    setMobileOpen(false);
    setMobileGamesOpen(false);
    setBarHidden(false);
  }, [pathname]);

  /* On a phone the bar gets out of the way going down and comes back the
     moment you head up. The threshold stops a jitter flipping it. */
  useEffect(() => {
    lastScroll.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScroll.current;
      if (y < 8) setBarHidden(false);
      else if (delta > 6) setBarHidden(true);
      else if (delta < -6) setBarHidden(false);
      if (Math.abs(delta) > 6 || y < 8) lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const link = (href: string, label: string, icon: React.ReactNode) => {
    const active = isActiveHref(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-full items-center gap-2 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright ${
          active
            ? "font-semibold text-ink-strong"
            : "text-ink-soft hover:text-ink-base"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav
        className={`sticky top-0 z-[1200] h-[52px] border-b border-line-soft bg-surface-band transition-transform duration-200 md:translate-y-0 ${
          barHidden && !mobileOpen ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className={FRAME}>
          <Link
            href="/"
            className="col-start-1 flex h-full shrink-0 items-center justify-self-start"
            aria-label="Lapwise home"
          >
            <LapwiseWordmark className="relative top-[2px] h-8" priority />
          </Link>

          <div className="col-start-2 hidden h-full items-center gap-5 md:flex">
            <NavLinkMenu
              pathname={pathname}
              label="Daily Games"
              icon={<GamesIcon />}
              links={gamesLinks}
            />
            {navLinksBefore.map((l) =>
              link(
                l.href,
                l.label,
                <NavIcon link={l} active={isActiveHref(pathname, l.href)} />,
              ),
            )}
            <NavLinkMenu
              pathname={pathname}
              label="Archive"
              icon={<DatabaseIcon />}
              links={archiveLinks}
            />
            {navLinksAfter.map((l) =>
              link(
                l.href,
                l.label,
                <NavIcon link={l} active={isActiveHref(pathname, l.href)} />,
              ),
            )}
          </div>

          <div className="col-start-3 flex h-full items-center gap-3 justify-self-end">
            <NavThemeToggle />
            {isLoading ? (
              <div className="h-7 w-16 animate-pulse rounded-sm bg-surface-raised" />
            ) : !isAuthenticated || !user ? (
              <Link
                href="/login"
                className="rounded-sm border border-line-strong px-3 py-2 text-[12px] text-ink-base md:px-[11px] md:py-[5px] transition-colors hover:border-ink-soft hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
              >
                Sign in
              </Link>
            ) : (
              <NavUserMenu user={user} onLogout={logout} />
            )}
          </div>
        </div>
      </nav>

      <MobileNavDock
        pathname={pathname}
        menuOpen={mobileOpen}
        gamesOpen={mobileGamesOpen}
        onToggleGames={() => {
          if (mobileOpen && mobileGamesOpen) {
            setMobileOpen(false);
            setMobileGamesOpen(false);
          } else {
            setMobileGamesOpen(true);
            setMobileOpen(true);
          }
        }}
        onToggleMenu={() => {
          if (mobileOpen && !mobileGamesOpen) {
            setMobileOpen(false);
          } else {
            setMobileGamesOpen(false);
            setMobileOpen(true);
          }
        }}
      />

      {mobileOpen && (
        <MobileNavDrawer
          pathname={pathname}
          user={user ?? null}
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          gamesOpen={mobileGamesOpen}
          onToggleGames={() => setMobileGamesOpen((open) => !open)}
          onClose={() => setMobileOpen(false)}
          onLogout={logout}
        />
      )}
    </>
  );
}
