"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { LapwiseWordmark } from "@/components/ui/BrandLogo";
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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-strong mb-1">
          Log in to <LapwiseWordmark className="h-5" />
        </h1>
        <p className="text-ink-faint text-sm mb-8">
          Welcome back. Enter your credentials below.
        </p>

        {redirect && redirect !== "/" && (
          <p className="text-[11px] font-mono text-ink-faint border border-line-soft rounded-sm px-3 py-2 mb-4">
            Log in to continue
          </p>
        )}

        {oauthError && (
          <p className="text-danger-bright text-sm bg-danger/10 border border-danger/20 rounded-sm px-3 py-2 mb-4">
            {oauthErrorMessage(oauthError)}
          </p>
        )}

        <GoogleButton next={redirect} />
        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm text-ink-base mb-1.5"
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
              <label htmlFor="password" className="block text-sm text-ink-base">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-accent-bright hover:text-accent-light transition-colors"
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
            <p className="text-danger-bright text-sm bg-danger/10 border border-danger/20 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth isLoading={loading}>
            Log in
          </Button>
        </form>

        <p className="text-center text-sm text-ink-faint mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-accent-bright hover:text-accent-light transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
