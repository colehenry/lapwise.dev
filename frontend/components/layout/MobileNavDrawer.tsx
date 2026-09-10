"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import { UserAvatar } from "./NavUserMenu";
import {
  archiveLinks,
  DatabaseIcon,
  isActiveHref,
  NavIcon,
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

export default function MobileNavDrawer({
  pathname,
  user,
  isAuthenticated,
  isLoading,
  onClose,
  onLogout,
}: {
  pathname: string;
  user: DrawerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

  const row =
    "flex items-center gap-3 border-b border-line-soft px-4 py-3 text-sm transition-colors last:border-b-0";

  const linkRow = (href: string, label: string, icon: React.ReactNode) => {
    const active = isActiveHref(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`${row} ${active ? "text-accent-light" : "text-ink-base"}`}
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
        {navLinksBefore.map((link) =>
          linkRow(
            link.href,
            link.label,
            <NavIcon link={link} active={isActiveHref(pathname, link.href)} />,
          ),
        )}

        <button
          type="button"
          onClick={() => setArchiveOpen((open) => !open)}
          aria-expanded={archiveOpen}
          className={`${row} w-full text-left ${
            archiveLinks.some((l) => isActiveHref(pathname, l.href))
              ? "text-accent-light"
              : "text-ink-base"
          }`}
        >
          <DatabaseIcon />
          <span className="flex-1">Archive</span>
          <svg
            className={`h-4 w-4 transition-transform ${archiveOpen ? "rotate-180" : ""}`}
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
        {archiveOpen &&
          archiveLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`${row} pl-11 ${
                isActiveHref(pathname, link.href)
                  ? "text-accent-light"
                  : "text-ink-base"
              }`}
            >
              <NavIcon link={link} active={isActiveHref(pathname, link.href)} />
              {link.label}
            </Link>
          ))}

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
              className={`${row} text-ink-base`}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className={`${row} text-ink-base`}
            >
              Settings
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                onClick={onClose}
                className={`${row} text-accent-light`}
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
