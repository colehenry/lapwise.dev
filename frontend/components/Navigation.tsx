"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridPattern } from "@/components/Patterns";
import { useSidebar } from "@/components/SidebarContext";
import UserMenu from "@/components/UserMenu";

const navLinks = [
  {
    href: "/results",
    label: "Race Weekend Hub",
    icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
  },
  {
    href: "/drivers",
    label: "Drivers",
    renderIcon: (active: boolean) => (
      <svg
        className={`w-4 h-4 shrink-0 ${active ? "text-purple-400" : "text-text-muted"}`}
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
    href: "/discussions",
    label: "Discussions",
    icon: "M7 8h10M7 12h6m-6 8l-4-4H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-4 4z",
  },
  {
    href: "/circuits",
    label: "Circuits",
    imageSrc: "/track-maps/4.png",
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
                {"renderIcon" in link ? (
                  // biome-ignore lint/style/noNonNullAssertion: guarded by "renderIcon" in link
                  link.renderIcon!(isActive(link.href))
                ) : "imageSrc" in link ? (
                  <Image
                    src={link.imageSrc as string}
                    alt={link.label}
                    width={16}
                    height={16}
                    className={`w-4 h-4 shrink-0 object-contain ${
                      isActive(link.href) ? "opacity-90" : "opacity-40"
                    }`}
                    style={{
                      filter: isActive(link.href)
                        ? "drop-shadow(0 0 4px rgba(160, 32, 240, 0.6)) brightness(1.8) saturate(0.3) hue-rotate(220deg)"
                        : "brightness(1.4) saturate(0) invert(0.7)",
                    }}
                  />
                ) : (
                  <svg
                    className={`w-4 h-4 shrink-0 ${
                      isActive(link.href)
                        ? "text-purple-400"
                        : "text-text-muted"
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
                )}
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

          {/* User + Footer */}
          <div
            className={`py-4 border-t border-border-primary space-y-3 ${isOpen ? "px-5" : "flex flex-col items-center gap-3"}`}
          >
            {isOpen && <UserMenu />}
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
