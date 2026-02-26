"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridPattern } from "@/components/Patterns";
import { useSidebar } from "@/components/SidebarContext";

const navLinks = [
  {
    href: "/results",
    label: "Race Weekend Hub",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
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

export default function Navigation() {
  const pathname = usePathname();
  const { isOpen, toggle, close } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
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

      {/* Sidebar — always present, transitions between rail (64px) and full width (18rem) */}
      <aside
        className={`fixed top-0 left-0 h-full bg-bg-secondary border-r border-border-primary z-[1250] transition-all duration-200 ease-out overflow-hidden ${
          isOpen ? "w-72" : "w-16"
        } ${!isOpen ? "max-md:hidden" : ""}`}
      >
        <GridPattern
          id="nav-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center border-b border-border-primary shrink-0">
            {isOpen ? (
              <div className="flex items-center justify-between w-full px-5">
                <Link href="/" className="flex items-center gap-2.5">
                  <div className="relative h-8 w-8 rounded-sm overflow-hidden ring-2 ring-purple-500/20 shrink-0">
                    <Image
                      src="/favicon.ico"
                      alt="Lapwise home"
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                  <span className="text-lg font-bold whitespace-nowrap">
                    <span className="text-purple-500">Lap</span>
                    <span className="text-text-primary">wise</span>
                  </span>
                </Link>

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
            ) : (
              <div className="flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={toggle}
                  className="relative h-8 w-8 rounded-sm overflow-hidden ring-2 ring-purple-500/20 hover:ring-purple-500/50 transition-all duration-150 cursor-pointer"
                  aria-label="Expand navigation"
                >
                  <Image
                    src="/favicon.ico"
                    alt="Lapwise"
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                </button>
              </div>
            )}
          </div>

          {/* Section label — only when expanded */}
          {isOpen && (
            <div className="px-5 pt-6 pb-2">
              <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                Navigate
              </span>
            </div>
          )}

          {/* Expand chevron — only when collapsed */}
          {!isOpen && (
            <div className="flex justify-center pt-4 pb-2">
              <button
                type="button"
                onClick={toggle}
                className="w-8 h-8 flex items-center justify-center rounded-sm text-text-muted hover:text-purple-400 hover:bg-purple-500/10 transition-colors duration-150"
                aria-label="Expand navigation"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Expand sidebar</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav
            className={`flex-1 space-y-1 ${isOpen ? "px-3" : "px-2"} ${!isOpen ? "pt-1" : ""}`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={!isOpen ? link.label : undefined}
                className={`flex items-center rounded-sm text-sm transition-colors duration-150 ${
                  isOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"
                } ${
                  isActive(link.href)
                    ? "bg-purple-500/15 border border-purple-500/40 text-purple-300"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent"
                }`}
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${
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
                {isOpen && (
                  <>
                    <span className="tracking-wide whitespace-nowrap">
                      {link.label}
                    </span>
                    {isActive(link.href) && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div
            className={`py-4 border-t border-border-primary ${isOpen ? "px-5" : "flex justify-center"}`}
          >
            <a
              href="https://github.com/colehenry/lapwise.dev"
              target="_blank"
              rel="noopener noreferrer"
              title={!isOpen ? "Source on GitHub" : undefined}
              className={`flex items-center text-text-muted hover:text-purple-300 text-xs tracking-wide transition-colors duration-150 ${
                isOpen ? "gap-2" : "justify-center"
              }`}
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>GitHub</title>
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              {isOpen && <span>Source</span>}
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile open button — only visible on small screens when sidebar is closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          className="fixed top-4 left-4 z-[1300] md:hidden flex items-center justify-center w-10 h-10 rounded-sm bg-bg-secondary border border-border-primary text-text-muted hover:text-purple-400 hover:border-purple-500/40 transition-colors duration-150"
          aria-label="Open navigation"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Open menu</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}
    </>
  );
}
