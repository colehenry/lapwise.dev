import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Product: [
      { label: "Results", href: "/results", external: false },
      { label: "Drivers", href: "/drivers", external: false },
      { label: "Blog", href: "/blog", external: false },
      { label: "About", href: "/about", external: false },
    ],
    Resources: [
      { label: "FAQ", href: "/faq", external: false },
      { label: "Contact", href: "/contact", external: false },
      { label: "Privacy", href: "/privacy", external: false },
      { label: "Terms", href: "/terms", external: false },
    ],
    Social: [
      {
        label: "GitHub",
        href: "https://github.com/colehenry/lapwise.dev",
        external: true,
      },
    ],
  };

  return (
    <footer className="bg-bg-secondary border-t border-border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative h-8 w-8 rounded-lg overflow-hidden ring-2 ring-purple-500/20">
                <Image
                  src="/favicon.ico"
                  alt="Lapwise"
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <span className="text-xl font-bold">
                <span className="text-purple-500">Lap</span>
                <span className="text-text-primary">wise</span>
              </span>
            </div>
            <p className="text-text-tertiary text-sm mb-4">
              Professional F1 analytics and telemetry platform for fans and
              enthusiasts.
            </p>
            <div className="flex space-x-4">
              {/* Social Icons */}
              <a
                href="https://github.com/colehenry/lapwise.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-bg-elevated hover:bg-purple-500/20 border border-border-primary hover:border-purple-500/50 flex items-center justify-center transition-all duration-200 group"
                aria-label="GitHub"
              >
                <svg
                  className="w-4 h-4 text-text-tertiary group-hover:text-purple-400 transition-colors duration-200"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>GitHub</title>
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-text-primary font-semibold mb-4">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-tertiary hover:text-purple-400 text-sm transition-colors duration-200 flex items-center"
                      >
                        {link.label}
                        <svg
                          className="w-3 h-3 ml-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>External link</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-text-tertiary hover:text-purple-400 text-sm transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-border-primary">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-text-tertiary text-sm">
              © {currentYear} Lapwise. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <Link
                href="/privacy"
                className="text-text-tertiary hover:text-purple-400 text-sm transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-text-tertiary hover:text-purple-400 text-sm transition-colors duration-200"
              >
                Terms of Service
              </Link>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-text-muted text-xs">
              Not affiliated with Formula 1, FIA, or any F1 constructors. All
              trademarks are property of their respective owners.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
