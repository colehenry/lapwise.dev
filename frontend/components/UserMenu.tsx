"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function UserMenu() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-bg-elevated animate-pulse" />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-purple-300 hover:bg-purple-500/10 rounded-md transition-colors duration-150"
      >
        <svg
          className="w-4 h-4"
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
        <span>Log in</span>
      </Link>
    );
  }

  const initial = user.username[0].toUpperCase();
  const roleLabel =
    user.role === "admin"
      ? "Admin"
      : user.role === "moderator"
        ? "Moderator"
        : null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
        aria-label="User menu"
      >
        <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-sm font-bold text-purple-300 group-hover:border-purple-500/60 transition-colors">
          {initial}
        </div>
        {roleLabel && (
          <span className="text-[10px] uppercase tracking-widest text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded">
            {roleLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2.5 border-b border-border-primary">
            <p className="text-sm font-medium text-text-primary truncate">
              @{user.username}
            </p>
            {roleLabel && (
              <p className="text-[10px] uppercase tracking-widest text-purple-300 mt-1">
                {roleLabel}
              </p>
            )}
          </div>

          <div className="py-1">
            <Link
              href={`/profile/${user.username}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Settings
            </Link>
          </div>

          <div className="border-t border-border-primary py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
