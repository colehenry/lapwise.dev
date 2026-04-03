"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

interface NavLink {
  href: string;
  label: string;
  icon?: string;
  renderIcon?: (active: boolean, scrolled: boolean) => React.ReactNode;
  imageSrc?: string;
}

// The three "archive" sub-items collapsed under Data Archive
const archiveLinks: NavLink[] = [
  {
    href: "/drivers",
    label: "Drivers",
    renderIcon: (active: boolean, scrolled: boolean) => (
      <svg
        className={`shrink-0 transition-all duration-500 ${
          scrolled ? "w-6 h-6" : "w-4 h-4"
        } ${active ? "text-purple-400" : "text-text-muted group-hover:text-text-primary"}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        fill="none"
        stroke="currentColor"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Drivers</title>
        <path d="M40 280 A200 200 0 0 1 440 280 L440 360 A60 60 0 0 1 360 420 L100 360 A60 60 0 0 1 40 300 Z" />
        <path d="M260 230 L440 250 L440 400 L260 300 Z" />
        <circle cx="130" cy="270" r="45" />
      </svg>
    ),
  },
  {
    href: "/constructors",
    label: "Constructors",
    icon: "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z",
  },
  {
    href: "/circuits",
    label: "Circuits",
    renderIcon: (active: boolean, scrolled: boolean) => (
      <svg
        className={`shrink-0 transition-all duration-500 ${
          scrolled ? "w-6 h-6" : "w-4 h-4"
        } ${active ? "text-purple-400" : "text-text-muted group-hover:text-text-primary"}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 431.76266 282.2795"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Circuits</title>
        <path d="m4.0167 271.88c0.64631 8.2948 35.488 7.0412 175.53 4.453 12.377-0.22874 23.86-0.27059 25.52-0.0932 13.322 1.4247 100.54 2.2285 145.19 1.3382l52.003-1.0371 10.787-5.1931c5.9327-2.8564 11.75-6.3558 12.928-7.7758 3.9507-4.7641 3.2062-6.3707-21.921-47.254-13.094-21.305-31.084-50.583-39.976-65.064-78.47-127.81-76.73-125.33-87.73-124.85-10.071 0.43333-18.612 11.049-30.86 38.362-6.0647 12.461-9.3595 17.392-9.4458 30.499-0.16791 25.024 10.566 36.802 43.884 48.15 27.605 9.4028 44.83 34.219 37.75 54.389-2.9794 8.4869-5.7122 8.9248-56.109 8.9963-116.27 0.16506-159.78-0.95414-191.07-4.9201-0.01764-0.002-0.0317-0.005-0.04921-0.008-1.3307-0.66808-2.43-1.5305-2.9028-2.6746 0.52921-1.7786 2.7076-4.7102 6.8088-9.6375 12.941-15.548 12.809-15.542 95.728-5.2995 57.897 7.1518 61.142 0.92171 16.441-31.574-40.6-29.52-40.53-29.42-36.96-49.77 3.4-19.413-0.73-26.128-20.45-33.214-14.94-5.372-30.31-18.671-50.912-44.055-23.312-28.723-35.64-28.862-40.096-0.451-16.672 106.31-23.197 153.18-23.266 178.19-0.10452 1.6859-0.07039 3.3487 0.08572 4.9912 0.31161 8.3078 1.4916 13.926 3.3599 18.797 7.4095 19.318 7.6168 17.58-3.5718 30.076-5.9649 6.6621-10.949 11.37-10.696 14.616z" />
      </svg>
    ),
  },
];

const navLinksBefore: NavLink[] = [
  {
    href: "/results",
    label: "Race Weekend Hub",
    icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
  },
];

const navLinksAfter: NavLink[] = [
  {
    href: "/live",
    label: "Replay",
    icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z",
  },
  {
    href: "/discussions",
    label: "Discuss",
    icon: "M7 8h10M7 12h6m-6 8l-4-4H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-4 4z",
  },
  {
    href: "/ask",
    label: "Analyze",
    renderIcon: (active: boolean, scrolled: boolean) => (
      <svg
        className={`shrink-0 transition-all duration-500 ${
          scrolled ? "w-6 h-6" : "w-4 h-4"
        } ${active ? "text-purple-400" : "text-text-muted group-hover:text-text-primary"}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <title>AI Analyst</title>
        <path
          fillRule="evenodd"
          d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

// Database/archive icon for the Data Archive trigger
function DatabaseIcon({
  active,
  scrolled,
}: {
  active: boolean;
  scrolled: boolean;
}) {
  const sizeClass = scrolled ? "w-6 h-6" : "w-4 h-4";
  const colorClass = active
    ? "text-purple-400"
    : "text-text-muted group-hover:text-text-primary";
  return (
    <svg
      className={`shrink-0 transition-all duration-500 ${sizeClass} ${colorClass}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>Data Archive</title>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9" />
      <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" />
    </svg>
  );
}

function NavIcon({
  link,
  active,
  scrolled,
}: {
  link: NavLink;
  active: boolean;
  scrolled: boolean;
}) {
  const sizeClass = scrolled ? "w-6 h-6" : "w-4 h-4";
  const colorClass = active
    ? "text-purple-400"
    : "text-text-muted group-hover:text-text-primary";

  if (link.renderIcon) return <>{link.renderIcon(active, scrolled)}</>;

  if (link.imageSrc) {
    return (
      <Image
        src={link.imageSrc}
        alt={link.label}
        width={24}
        height={24}
        className={`shrink-0 object-contain transition-all duration-500 ${sizeClass} ${colorClass} ${
          scrolled ? "scale-[1.15]" : "scale-[1.1]"
        }`}
      />
    );
  }

  return (
    <svg
      className={`shrink-0 transition-all duration-500 ${sizeClass} ${colorClass}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <title>{link.label}</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d={link.icon}
      />
    </svg>
  );
}

// Dropdown for top-bar (drops below)
function DataArchiveTopBarDropdown({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 w-44 z-50">
      <div className="bg-bg-secondary/95 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn">
        {archiveLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "text-purple-300 bg-purple-500/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60"
              }`}
            >
              <NavIcon link={link} active={active} scrolled={false} />
              <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Submenu for floating dock (pops right)
function DataArchiveDockSubmenu({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="absolute left-full top-0 pl-2 w-44 z-50">
      <div className="bg-bg-secondary/95 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn">
        <div className="px-3 py-2 border-b border-border-primary">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
            Data Archive
          </p>
        </div>
        {archiveLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "text-purple-300 bg-purple-500/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60"
              }`}
            >
              <NavIcon link={link} active={active} scrolled={false} />
              <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function UserMenuDropdown({
  user,
  isAdmin,
  position,
  onClose,
  onLogout,
}: {
  user: { username: string; role: string };
  isAdmin: boolean;
  position: "top-bar" | "floating-dock";
  onClose: () => void;
  onLogout: () => void;
}) {
  const positionClass =
    position === "top-bar"
      ? "absolute right-0 top-full pt-2 w-48"
      : "absolute left-full top-0 pl-2 w-48";

  return (
    <div className={positionClass}>
      <div className="bg-bg-secondary/95 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn">
        <div className="px-3 py-2.5 border-b border-border-primary">
          <p className="text-sm font-medium text-text-primary truncate">
            @{user.username}
          </p>
          {user.role !== "user" && (
            <p className="text-[10px] uppercase tracking-widest text-purple-300 mt-0.5 font-mono">
              {user.role}
            </p>
          )}
        </div>
        <div className="py-1">
          <Link
            href={`/profile/${user.username}`}
            onClick={onClose}
            className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={onClose}
            className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors"
          >
            Settings
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="block px-3 py-2 text-sm text-purple-300 hover:text-purple-200 hover:bg-bg-elevated/60 transition-colors"
            >
              Admin
            </Link>
          )}
        </div>
        <div className="border-t border-border-primary py-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [mobileArchiveOpen, setMobileArchiveOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isArchiveActive = archiveLinks.some((l) => isActive(l.href));

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY >= 56);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — close menus when route changes
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setArchiveOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setUserMenuOpen(false);
        setArchiveOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";
  const isAdmin = user?.role === "admin";

  return (
    <>
      {/* ── Expanded state: full-width top bar ── */}
      <nav
        className={`absolute top-0 left-0 right-0 z-[1200] backdrop-blur-xl border-b border-border-primary bg-bg-secondary/80 h-14 ${
          scrolled ? "pointer-events-none" : "pointer-events-auto"
        }`}
      >
        <div className="h-full px-4 max-w-6xl mx-auto flex items-center">
          {/* Left side — Logo */}
          <div className="flex-1 flex items-center">
            <Link
              href="/"
              className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] ${
                isActive("/")
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.08)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 border border-transparent hover:border-border-secondary/60"
              }`}
            >
              <span className="font-bold text-lg">
                <span className="text-purple-500">Lap</span>
                <span className="text-text-primary">wise</span>
              </span>
            </Link>
          </div>

          {/* Center nav links — desktop */}
          <div className="hidden md:flex items-center justify-center gap-1 shrink-0">
            {navLinksBefore.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] ${
                    active
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.08)]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 border border-transparent hover:border-border-secondary/60"
                  }`}
                >
                  <NavIcon link={link} active={active} scrolled={false} />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                    {link.label}
                  </span>
                </Link>
              );
            })}

            {/* Data Archive dropdown trigger */}
            <div
              ref={archiveRef}
              role="none"
              className="relative"
              onMouseEnter={() => setArchiveOpen(true)}
              onMouseLeave={() => setArchiveOpen(false)}
            >
              <button
                type="button"
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] ${
                  isArchiveActive
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.08)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 border border-transparent hover:border-border-secondary/60"
                }`}
              >
                <DatabaseIcon active={isArchiveActive} scrolled={false} />
                <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                  Data Archive
                </span>
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${archiveOpen ? "rotate-180" : ""} ${isArchiveActive ? "text-purple-400" : "text-text-muted group-hover:text-text-primary"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {archiveOpen && !scrolled && (
                <DataArchiveTopBarDropdown isActive={isActive} />
              )}
            </div>

            {navLinksAfter.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] ${
                    active
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.08)]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 border border-transparent hover:border-border-secondary/60"
                  }`}
                >
                  <NavIcon link={link} active={active} scrolled={false} />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right side — desktop */}
          <div className="flex-1 hidden md:flex items-center justify-end gap-2 shrink-0">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-bg-elevated animate-pulse" />
            ) : !isAuthenticated || !user ? (
              <Link
                href="/login"
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] ${
                  isActive("/login")
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.08)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80 border border-transparent hover:border-border-secondary/60"
                }`}
              >
                <svg
                  className={`w-4 h-4 transition-all duration-500 ${
                    isActive("/login")
                      ? "text-purple-400"
                      : "text-text-muted group-hover:text-text-primary"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
                <span className="text-xs font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                  Log in
                </span>
              </Link>
            ) : (
              <div
                ref={userMenuRef}
                role="none"
                className="relative"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="group flex items-center"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-muted group-hover:scale-[1.08] active:scale-95 transition-all duration-300 overflow-hidden">
                    {user.avatar_url ? (
                      // biome-ignore lint/performance/noImgElement: arbitrary avatar hosts
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                </button>

                {userMenuOpen && !scrolled && (
                  <UserMenuDropdown
                    user={user}
                    isAdmin={isAdmin}
                    position="top-bar"
                    onClose={() => setUserMenuOpen(false)}
                    onLogout={logout}
                  />
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden ml-auto w-9 h-9 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated/80 transition-all duration-200 hover:scale-[1.08] active:scale-95"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>{mobileOpen ? "Close menu" : "Open menu"}</title>
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Collapsed state: vertical floating dock on the left ── */}
      <div
        style={{
          left: "min(60px, max(12px, calc((100vw - (72rem + 40px)) / 4 - 34px)))",
        }}
        className={`fixed top-3 z-[1200] hidden md:flex flex-col items-center gap-2.5 p-2.5 rounded-3xl bg-bg-secondary/90 backdrop-blur-xl border border-border-primary shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(160,32,240,0.06)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          scrolled
            ? "opacity-100 translate-x-0 scale-100 delay-300"
            : "opacity-0 -translate-x-4 scale-95 pointer-events-none delay-0"
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group relative w-12 h-12 flex items-center justify-center rounded-2xl hover:scale-[1.1] active:scale-95 transition-all duration-200"
          title="Lapwise home"
        >
          <div className="relative h-12 w-12 rounded-lg overflow-hidden">
            <Image
              src="/favicon.ico"
              alt="Lapwise home"
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
            Home
          </span>
        </Link>

        <div className="w-8 h-px bg-border-primary my-0.5" />

        {/* Nav icons — before archive */}
        {navLinksBefore.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.12] active:scale-95 ${
                active
                  ? "bg-purple-500/15 border border-purple-500/25 shadow-[inset_0_0_10px_rgba(160,32,240,0.1)]"
                  : "border border-transparent hover:bg-bg-elevated/80 hover:border-border-secondary/60"
              }`}
            >
              <NavIcon link={link} active={active} scrolled={true} />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
                {link.label}
              </span>
            </Link>
          );
        })}

        {/* Data Archive dock item */}
        <div
          role="none"
          className="relative group/archive"
          onMouseEnter={() => setArchiveOpen(true)}
          onMouseLeave={() => setArchiveOpen(false)}
        >
          <button
            type="button"
            className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.12] active:scale-95 ${
              isArchiveActive
                ? "bg-purple-500/15 border border-purple-500/25 shadow-[inset_0_0_10px_rgba(160,32,240,0.1)]"
                : "border border-transparent hover:bg-bg-elevated/80 hover:border-border-secondary/60"
            }`}
            aria-label="Data Archive"
          >
            <DatabaseIcon active={isArchiveActive} scrolled={true} />
            {!archiveOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
                Data Archive
              </span>
            )}
          </button>

          {archiveOpen && scrolled && (
            <DataArchiveDockSubmenu isActive={isActive} />
          )}
        </div>

        {/* Nav icons — after archive */}
        {navLinksAfter.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`group relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.12] active:scale-95 ${
                active
                  ? "bg-purple-500/15 border border-purple-500/25 shadow-[inset_0_0_10px_rgba(160,32,240,0.1)]"
                  : "border border-transparent hover:bg-bg-elevated/80 hover:border-border-secondary/60"
              }`}
            >
              <NavIcon link={link} active={active} scrolled={true} />
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
                {link.label}
              </span>
            </Link>
          );
        })}

        <div className="w-8 h-px bg-border-primary my-0.5" />

        {/* User avatar */}
        {isLoading ? (
          <div className="w-10 h-10 rounded-full bg-bg-elevated animate-pulse" />
        ) : !isAuthenticated || !user ? (
          <Link
            href="/login"
            title="Log in"
            className="group relative w-12 h-12 flex items-center justify-center rounded-2xl text-text-muted hover:text-purple-300 hover:bg-purple-500/10 transition-all duration-200 hover:scale-[1.12] active:scale-95"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Log in</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
              Log in
            </span>
          </Link>
        ) : (
          <div
            ref={scrolled ? userMenuRef : undefined}
            role="none"
            className="relative"
            onMouseEnter={() => setUserMenuOpen(true)}
            onMouseLeave={() => setUserMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              title={`@${user.username}`}
              className="group relative w-12 h-12 flex items-center justify-center"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-sm font-bold text-text-muted group-hover:scale-[1.12] active:scale-95 transition-all duration-200 overflow-hidden">
                {user.avatar_url ? (
                  // biome-ignore lint/performance/noImgElement: arbitrary avatar hosts
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initial
                )}
              </div>
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
                Profile
              </span>
            </button>

            {userMenuOpen && scrolled && (
              <UserMenuDropdown
                user={user}
                isAdmin={isAdmin}
                position="floating-dock"
                onClose={() => setUserMenuOpen(false)}
                onLogout={logout}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-14 left-0 right-0 z-[1150] md:hidden bg-bg-secondary/95 backdrop-blur-xl border-b border-border-primary shadow-[0_16px_48px_rgba(0,0,0,0.5)] animate-slideDown">
            <div className="px-4 py-3 space-y-1">
              {navLinksBefore.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                      active
                        ? "text-purple-300 bg-purple-500/12 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.06)]"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 border border-transparent"
                    }`}
                  >
                    <NavIcon link={link} active={active} scrolled={false} />
                    {link.label}
                  </Link>
                );
              })}

              {/* Data Archive — expandable section in mobile */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileArchiveOpen(!mobileArchiveOpen)}
                  className={`group w-full flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                    isArchiveActive
                      ? "text-purple-300 bg-purple-500/12 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.06)]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 border border-transparent"
                  }`}
                >
                  <DatabaseIcon active={isArchiveActive} scrolled={false} />
                  <span className="flex-1 text-left">Data Archive</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${mobileArchiveOpen ? "rotate-180" : ""} ${isArchiveActive ? "text-purple-400" : "text-text-muted"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {mobileArchiveOpen && (
                  <div className="mt-1 ml-4 space-y-1 border-l border-border-primary pl-3">
                    {archiveLinks.map((link) => {
                      const active = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className={`group flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 active:scale-[0.98] ${
                            active
                              ? "text-purple-300 bg-purple-500/12 border border-purple-500/20"
                              : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 border border-transparent"
                          }`}
                        >
                          <NavIcon
                            link={link}
                            active={active}
                            scrolled={false}
                          />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {navLinksAfter.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                      active
                        ? "text-purple-300 bg-purple-500/12 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(160,32,240,0.06)]"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 border border-transparent"
                    }`}
                  >
                    <NavIcon link={link} active={active} scrolled={false} />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-border-primary px-4 py-3">
              {isLoading ? (
                <div className="w-full h-11 bg-bg-elevated animate-pulse rounded-2xl" />
              ) : !isAuthenticated || !user ? (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm text-text-secondary hover:text-purple-300 rounded-2xl transition-colors"
                >
                  Log in
                </Link>
              ) : (
                <div className="space-y-1">
                  <div className="px-4 py-2 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300 overflow-hidden">
                      {user.avatar_url ? (
                        // biome-ignore lint/performance/noImgElement: arbitrary avatar hosts
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <span className="text-sm text-text-primary font-medium">
                      @{user.username}
                    </span>
                    {user.role !== "user" && (
                      <span className="text-[10px] uppercase tracking-widest text-purple-300 font-mono">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/profile/${user.username}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 rounded-2xl transition-colors"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 rounded-2xl transition-colors"
                  >
                    Settings
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-purple-300 hover:text-purple-200 hover:bg-bg-elevated/60 rounded-2xl transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-border-primary px-4 py-3">
              <div className="flex items-center gap-4">
                <Link
                  href="/about"
                  onClick={() => setMobileOpen(false)}
                  className="text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  About
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
