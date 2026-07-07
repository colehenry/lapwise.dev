"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case "exchange_failed":
      return "Google sign-in didn't complete. Please try again.";
    case "missing_profile":
      return "Google didn't return your email. Please try again.";
    case "email_unverified":
      return "Your Google email isn't verified. Verify it with Google first.";
    case "account_deactivated":
      return "Your account is deactivated.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") || "/";
  const oauthError = searchParams.get("oauth_error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(identifier, password);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Log in to <span className="text-purple-500">Lapwise</span>
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Welcome back. Enter your credentials below.
        </p>

        {redirect && redirect !== "/" && (
          <p className="text-[11px] font-mono text-text-muted border border-border-primary rounded-sm px-3 py-2 mb-4">
            Log in to continue
          </p>
        )}

        {oauthError && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2 mb-4">
            {oauthErrorMessage(oauthError)}
          </p>
        )}

        <GoogleButton next={redirect} />
        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Email or username
            </label>
            <Input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm text-text-secondary"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth isLoading={loading}>
            Log in
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
