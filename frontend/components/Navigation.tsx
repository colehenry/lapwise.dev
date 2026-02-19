"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/SidebarContext";

const navLinks = [
  {
    href: "/results",
    label: "Results",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    href: "/drivers",
    label: "Drivers",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    href: "/constructors",
    label: "Constructors",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    href: "/circuits",
    label: "Circuits",
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  },
  {
    href: "/about",
    label: "About",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

function GridPatternNav() {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
      aria-hidden="true"
    >
      <title>Grid pattern</title>
      <defs>
        <pattern
          id="nav-grid"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nav-grid)" />
    </svg>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const { isOpen, toggle, close } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Collapsed toggle — visible only when sidebar is closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          className="fixed top-4 left-4 z-[1300] flex items-center gap-2.5 group"
          aria-label="Open navigation"
        >
          <div className="relative h-10 w-10 rounded-sm overflow-hidden ring-2 ring-purple-500/20 group-hover:ring-purple-500/50 transition-all duration-150">
            <Image
              src="/favicon.ico"
              alt="Lapwise"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <span className="text-xl font-bold hidden sm:block">
            <span className="text-purple-500">Lap</span>
            <span className="text-text-primary">wise</span>
          </span>
        </button>
      )}

      {/* Mobile backdrop — only on small screens */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1200] md:hidden"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") close();
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-bg-secondary border-r border-border-primary z-[1250] transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <GridPatternNav />

        <div className="relative z-10 flex flex-col h-full">
          {/* Header with logo + collapse button */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-border-primary">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-8 w-8 rounded-sm overflow-hidden ring-2 ring-purple-500/20">
                <Image
                  src="/favicon.ico"
                  alt="Lapwise home"
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <span className="text-lg font-bold">
                <span className="text-purple-500">Lap</span>
                <span className="text-text-primary">wise</span>
              </span>
            </Link>

            {/* Collapse button */}
            <button
              type="button"
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150"
              aria-label="Collapse navigation"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Collapse sidebar</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* Section label */}
          <div className="px-5 pt-6 pb-2">
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Navigate
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors duration-150 ${
                  isActive(link.href)
                    ? "bg-purple-500/15 border border-purple-500/40 text-purple-300"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent"
                }`}
              >
                <svg
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive(link.href) ? "text-purple-400" : "text-text-muted"
                  }`}
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
                <span className="tracking-wide">{link.label}</span>
                {isActive(link.href) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border-primary">
            <a
              href="https://github.com/colehenry/lapwise.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-text-muted hover:text-purple-300 text-xs tracking-wide transition-colors duration-150"
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
              <span>Source</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
