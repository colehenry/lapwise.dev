"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(email, username, displayName, password);
      router.push("/verify-email?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Join <span className="text-purple-500">Lapwise</span>
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Create an account to join the discussion.
        </p>

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

          <div>
            <label
              htmlFor="username"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              autoComplete="username"
              pattern="^[a-z0-9_]{3,20}$"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors font-mono text-sm"
              placeholder="cool_racer"
            />
            <p className="text-xs text-text-muted mt-1">
              3-20 characters, lowercase letters, numbers, and underscores
            </p>
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={50}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Password
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
              Confirm password
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
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
