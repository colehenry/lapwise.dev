"use client";

import Link from "next/link";
import type React from "react";

interface NavLinkProps {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}

export default function NavLink({
  href,
  label,
  isActive,
  onClick,
  className = "",
}: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        isActive
          ? "text-purple-400 bg-purple-500/10"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
      } ${className}`}
      onClick={onClick}
    >
      {label}
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full" />
      )}
    </Link>
  );
}
