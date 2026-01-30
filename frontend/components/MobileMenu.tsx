"use client";

import Link from "next/link";

interface MobileMenuLink {
  href: string;
  label: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  links: MobileMenuLink[];
  isActive: (href: string) => boolean;
  onClose: () => void;
}

export default function MobileMenu({
  isOpen,
  links,
  isActive,
  onClose,
}: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden py-4 border-t border-border-primary animate-slideDown">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`block px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
            isActive(link.href)
              ? "text-purple-400 bg-purple-500/10"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          }`}
          onClick={onClose}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
