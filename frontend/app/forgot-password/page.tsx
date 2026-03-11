"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { apiUrl } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(apiUrl("/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Reset password
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/15 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Email sent</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <p className="text-text-secondary text-sm mb-4">
              If an account exists for that email, we sent a password reset
              link.
            </p>
            <Link
              href="/login"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm text-text-secondary mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={loading}
            >
              Send reset link
            </Button>
            <p className="text-center">
              <Link
                href="/login"
                className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
