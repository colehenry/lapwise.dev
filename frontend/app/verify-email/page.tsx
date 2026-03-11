"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { apiUrl } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const justRegistered = searchParams.get("registered") === "true";

  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >(token ? "verifying" : "idle");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(apiUrl(`/auth/verify-email?token=${token}`))
      .then((res) => {
        setStatus(res.ok ? "success" : "error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    await fetch(apiUrl("/auth/resend-verification"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setResendSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {justRegistered && status === "idle" && (
          <>
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
            <h1 className="text-xl font-bold text-text-primary mb-2">
              Check your email
            </h1>
            <p className="text-text-muted text-sm mb-6">
              We sent a verification link to your email address. Click the link
              to verify your account.
            </p>
            <Link
              href="/login"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Back to login
            </Link>
          </>
        )}

        {status === "verifying" && (
          <p className="text-text-secondary">Verifying your email...</p>
        )}

        {status === "success" && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/15 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Success</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              Email verified
            </h1>
            <p className="text-text-muted text-sm mb-6">
              Your email has been verified. You can now log in.
            </p>
            <Link href="/login">
              <Button variant="primary">Go to login</Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Error</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              Verification failed
            </h1>
            <p className="text-text-muted text-sm mb-6">
              This link may be expired or already used.
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                placeholder="Enter your email to resend"
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm"
              />
              {resendSent ? (
                <p className="text-green-400 text-sm">
                  If that email is registered, a new link has been sent.
                </p>
              ) : (
                <Button type="submit" variant="secondary" fullWidth size="sm">
                  Resend verification email
                </Button>
              )}
            </form>
          </>
        )}

        {status === "idle" && !justRegistered && (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              Verify your email
            </h1>
            <p className="text-text-muted text-sm mb-6">
              Enter your email to receive a new verification link.
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm"
              />
              {resendSent ? (
                <p className="text-green-400 text-sm">
                  If that email is registered, a verification link has been
                  sent.
                </p>
              ) : (
                <Button type="submit" variant="primary" fullWidth size="sm">
                  Send verification email
                </Button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
