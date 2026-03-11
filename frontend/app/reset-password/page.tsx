"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Button from "@/components/ui/Button";
import { apiUrl } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-muted mb-4">
            Invalid reset link. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
          >
            Request password reset
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Reset failed");
      }

      router.push("/login?reset=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Set new password
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm text-text-secondary mb-1.5"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
            />
            <p className="text-xs text-text-muted mt-1">
              Min 8 characters with uppercase, lowercase, and a number
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth isLoading={loading}>
            Reset password
          </Button>
        </form>
      </div>
    </div>
  );
}
