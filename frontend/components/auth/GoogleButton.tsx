"use client";

import { apiUrl } from "@/lib/api";

interface GoogleButtonProps {
  /** Optional path to return the user to after sign-in completes. */
  next?: string;
  /** "login" goes to /auth/oauth/google/login (sign-in or sign-up).
   *  "link"  goes to /auth/oauth/google/link  (attach to current user). */
  mode?: "login" | "link";
  label?: string;
}

/**
 * "Continue with Google" button. Renders as a plain anchor because OAuth
 * requires a full-page navigation to the provider — fetch() can't follow
 * cross-origin redirects through Google's authorize page.
 */
export default function GoogleButton({
  next,
  mode = "login",
  label = "Continue with Google",
}: GoogleButtonProps) {
  const path =
    mode === "link" ? "/auth/oauth/google/link" : "/auth/oauth/google/login";
  const href = next
    ? `${apiUrl(path)}?next=${encodeURIComponent(next)}`
    : apiUrl(path);

  return (
    <a
      href={href}
      className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-sm border border-border-primary bg-bg-secondary hover:bg-bg-tertiary text-text-primary text-sm font-medium transition-colors"
    >
      <GoogleLogo />
      <span>{label}</span>
    </a>
  );
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Google</title>
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Visual divider with "or" — pairs with the GoogleButton above the email form */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-border-primary" />
      <span className="text-xs text-text-muted uppercase tracking-wide">
        or
      </span>
      <div className="flex-1 h-px bg-border-primary" />
    </div>
  );
}
