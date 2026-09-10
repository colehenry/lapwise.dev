"use client";

import Link from "next/link";
import { useState } from "react";

type NavUser = {
  username: string;
  role: string;
  avatar_url?: string | null;
};

export function UserAvatar({
  user,
  size = 28,
}: {
  user: NavUser;
  size?: number;
}) {
  const initial = user.username?.[0]?.toUpperCase() ?? "?";

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised text-[11px] font-bold text-ink-base ring-1 ring-line-strong"
      style={{ width: size, height: size }}
    >
      {user.avatar_url ? (
        // biome-ignore lint/performance/noImgElement: arbitrary avatar hosts
        <img
          src={user.avatar_url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initial
      )}
    </span>
  );
}

export default function NavUserMenu({
  user,
  onLogout,
}: {
  user: NavUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin";

  const item =
    "block border-b border-line-soft px-3 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-surface-raised hover:text-ink-strong";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only opens the menu on hover; the trigger inside it is a real button
    <div
      className="relative h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label={`Account: ${user.username}`}
        className="flex h-full items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
      >
        <UserAvatar user={user} />
      </button>

      {open && (
        // The gap is padding on a wrapper, not a margin on the panel: a real
        // gap between trigger and menu drops the hover before the pointer
        // arrives.
        <div className="absolute right-0 top-full z-10 w-40 pt-2">
          <div className="overflow-hidden rounded-sm border border-line-soft bg-surface-panel shadow-floating-soft">
            <div className="border-b border-line-soft px-3 py-2.5">
              <p className="truncate text-[13px] font-semibold text-ink-strong">
                @{user.username}
              </p>
              {user.role !== "user" && (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-accent-light">
                  {user.role}
                </p>
              )}
            </div>

            <Link
              href={`/profile/${user.username}`}
              onClick={() => setOpen(false)}
              className={`${item} text-ink-base`}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={`${item} text-ink-base`}
            >
              Settings
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={`${item} text-accent-light`}
              >
                Admin
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full border-t border-line-soft px-3 py-2 text-left text-[13px] text-danger-bright transition-colors hover:bg-danger/10"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
