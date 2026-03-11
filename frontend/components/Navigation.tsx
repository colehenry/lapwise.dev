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

const navLinks: NavLink[] = [
  {
    href: "/results",
    label: "Race Weekend Hub",
    icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
  },
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
    imageSrc: "/track-maps/4.png",
  },
  {
    href: "/discussions",
    label: "Discussions",
    icon: "M7 8h10M7 12h6m-6 8l-4-4H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-4 4z",
  },
];

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
        className={`shrink-0 object-contain transition-all duration-500 ${sizeClass} ${
          active ? "opacity-95" : "opacity-70 group-hover:opacity-90"
        } ${scrolled ? "scale-[1.15]" : "scale-[1.1]"}`}
        style={{
          filter: active
            ? "drop-shadow(0 0 1.4px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 4px rgba(160, 32, 240, 0.6)) brightness(1.85) saturate(0.25) hue-rotate(220deg)"
            : "drop-shadow(0 0 1.2px rgba(255, 255, 255, 0.6)) brightness(1.6) saturate(0) invert(0.8)",
        }}
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

export default function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 48);
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
        className={`fixed top-0 left-0 right-0 z-[1200] backdrop-blur-xl border-b border-border-primary bg-bg-secondary/80 h-14 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          scrolled
            ? "opacity-0 pointer-events-none -translate-y-2"
            : "opacity-100 pointer-events-auto translate-y-0"
        }`}
      >
        <div className="h-full px-4 max-w-6xl mx-auto flex items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="relative h-7 w-7 rounded-lg overflow-hidden ring-1 ring-purple-500/20">
              <Image
                src="/favicon.ico"
                alt="Lapwise home"
                width={28}
                height={28}
                className="object-cover"
              />
            </div>
            <span className="font-bold">
              <span className="text-purple-500">Lap</span>
              <span className="text-text-primary">wise</span>
            </span>
          </Link>

          {/* Center nav links — desktop */}
          <div className="hidden md:flex items-center justify-center gap-1 flex-1">
            {navLinks.map((link) => {
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
                  <span className="text-sm whitespace-nowrap">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side — desktop */}
          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
            <a
              href="https://github.com/colehenry/lapwise.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated/80 transition-all duration-300 hover:scale-[1.08] active:scale-95"
              aria-label="View source on GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <title>GitHub</title>
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="sr-only">GitHub</span>
            </a>

            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-bg-elevated animate-pulse" />
            ) : !isAuthenticated || !user ? (
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-sm rounded-full text-text-secondary hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/25 transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]"
              >
                Log in
              </Link>
            ) : (
              <div
                ref={userMenuRef}
                className="relative"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="group"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300 group-hover:border-purple-500/60 group-hover:scale-[1.08] active:scale-95 transition-all duration-300">
                    {initial}
                  </div>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-bg-secondary/95 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn">
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
                      <Link href={`/profile/${user.username}`} onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors">Profile</Link>
                      <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors">Settings</Link>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-purple-300 hover:text-purple-200 hover:bg-bg-elevated/60 transition-colors">Admin</Link>
                      )}
                    </div>
                    <div className="border-t border-border-primary py-1">
                      <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">Log out</button>
                    </div>
                  </div>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <title>{mobileOpen ? "Close menu" : "Open menu"}</title>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Collapsed state: vertical floating dock on the left ── */}
      <div
        className={`fixed left-3 top-3 z-[1200] hidden md:flex flex-col items-center gap-2.5 p-2.5 rounded-3xl bg-bg-secondary/90 backdrop-blur-xl border border-border-primary shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(160,32,240,0.06)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          scrolled
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 -translate-x-4 scale-95 pointer-events-none"
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group relative w-12 h-12 flex items-center justify-center rounded-2xl hover:scale-[1.1] active:scale-95 transition-all duration-200"
          title="Lapwise home"
        >
          <div className="relative h-10 w-10 rounded-lg overflow-hidden ring-1 ring-purple-500/30">
            <Image
              src="/favicon.ico"
              alt="Lapwise home"
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
            Home
          </span>
        </Link>

        <div className="w-8 h-px bg-border-primary my-0.5" />

        {/* Nav icons */}
        {navLinks.map((link) => {
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <title>Log in</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
              Log in
            </span>
          </Link>
        ) : (
          <div
            ref={scrolled ? userMenuRef : undefined}
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
              <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-sm font-bold text-purple-300 group-hover:border-purple-500/60 group-hover:scale-[1.12] active:scale-95 transition-all duration-200">
                {initial}
              </div>
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 translate-x-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-100 transition-all duration-200 bg-bg-secondary/95 border border-border-primary rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap">
                Profile
              </span>
            </button>

            {userMenuOpen && scrolled && (
              <div className="absolute left-full top-0 ml-2 w-48 bg-bg-secondary/95 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn">
                <div className="px-3 py-2.5 border-b border-border-primary">
                  <p className="text-sm font-medium text-text-primary truncate">@{user.username}</p>
                  {user.role !== "user" && (
                    <p className="text-[10px] uppercase tracking-widest text-purple-300 mt-0.5 font-mono">{user.role}</p>
                  )}
                </div>
                <div className="py-1">
                  <Link href={`/profile/${user.username}`} onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors">Profile</Link>
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60 transition-colors">Settings</Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-purple-300 hover:text-purple-200 hover:bg-bg-elevated/60 transition-colors">Admin</Link>
                  )}
                </div>
                <div className="border-t border-border-primary py-1">
                  <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">Log out</button>
                </div>
              </div>
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
              {navLinks.map((link) => {
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
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">
                      {initial}
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
                <a
                  href="https://github.com/colehenry/lapwise.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>GitHub</title>
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Source
                </a>
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
