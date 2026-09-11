"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import { UserAvatar } from "./NavUserMenu";
import {
  archiveLinks,
  DatabaseIcon,
  GamesIcon,
  gamesLinks,
  isActiveHref,
  NavIcon,
  type NavLink,
  navLinksAfter,
  navLinksBefore,
} from "./navigationLinks";

type DrawerUser = {
  username: string;
  role: string;
  avatar_url?: string | null;
};

const THEME_LABELS: Record<AppTheme, string> = {
  light: "Light",
  dark: "Dark",
};

const DRAWER_ROW =
  "flex items-center gap-3 border-b border-line-soft px-4 py-3 text-sm transition-colors last:border-b-0";

function MobileLinkSection({
  icon,
  label,
  links,
  onClose,
  onToggle,
  open,
  pathname,
}: {
  icon: ReactNode;
  label: string;
  links: NavLink[];
  onClose: () => void;
  onToggle: () => void;
  open: boolean;
  pathname: string;
}) {
  const active = links.some((link) => isActiveHref(pathname, link.href));
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`${DRAWER_ROW} w-full text-left ${
          active ? "text-accent-light" : "text-ink-base"
        }`}
      >
        {icon}
        <span className="flex-1">{label}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
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
      {open &&
        links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className={`${DRAWER_ROW} pl-11 ${
              isActiveHref(pathname, link.href)
                ? "text-accent-light"
                : "text-ink-base"
            }`}
          >
            <NavIcon link={link} active={isActiveHref(pathname, link.href)} />
            {link.label}
          </Link>
        ))}
    </>
  );
}

export default function MobileNavDrawer({
  pathname,
  user,
  isAuthenticated,
  isLoading,
  gamesOpen,
  onToggleGames,
  onClose,
  onLogout,
}: {
  pathname: string;
  user: DrawerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  gamesOpen: boolean;
  onToggleGames: () => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const linkRow = (href: string, label: string, icon: React.ReactNode) => {
    const active = isActiveHref(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`${DRAWER_ROW} ${active ? "text-accent-light" : "text-ink-base"}`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[1210] theme-overlay backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[1220] max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-sm border border-line-soft bg-surface-panel shadow-floating md:hidden">
        <MobileLinkSection
          icon={<GamesIcon />}
          label="Daily Games"
          links={gamesLinks}
          pathname={pathname}
          open={gamesOpen}
          onToggle={onToggleGames}
          onClose={onClose}
        />
        {navLinksBefore.map((link) =>
          linkRow(
            link.href,
            link.label,
            <NavIcon link={link} active={isActiveHref(pathname, link.href)} />,
          ),
        )}

        <MobileLinkSection
          icon={<DatabaseIcon />}
          label="Archive"
          links={archiveLinks}
          pathname={pathname}
          open={archiveOpen}
          onToggle={() => setArchiveOpen((open) => !open)}
          onClose={onClose}
        />

        {navLinksAfter.map((link) =>
          linkRow(
            link.href,
            link.label,
            <NavIcon link={link} active={isActiveHref(pathname, link.href)} />,
          ),
        )}

        <div className="border-b border-line-soft px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            Appearance
          </p>
          <div className="flex gap-1">
            {APP_THEMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
                className={`min-h-10 flex-1 rounded-sm border px-2 text-xs transition-colors ${
                  theme === option
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-line-soft text-ink-soft"
                }`}
              >
                {THEME_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="m-4 h-10 animate-pulse rounded-sm bg-surface-raised" />
        ) : !isAuthenticated || !user ? (
          <Link
            href="/login"
            onClick={onClose}
            className="block bg-accent px-4 py-3 text-center text-sm font-semibold text-ink-strong"
          >
            Sign in
          </Link>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
              <UserAvatar user={user} />
              <span className="text-sm font-medium text-ink-strong">
                @{user.username}
              </span>
            </div>
            <Link
              href={`/profile/${user.username}`}
              onClick={onClose}
              className={`${DRAWER_ROW} text-ink-base`}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className={`${DRAWER_ROW} text-ink-base`}
            >
              Settings
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                onClick={onClose}
                className={`${DRAWER_ROW} text-accent-light`}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full px-4 py-3 text-left text-sm text-danger-bright"
            >
              Log out
            </button>
          </>
        )}
      </div>
    </>
  );
}
