"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  useEffect(() => {
    const normalized = username.toLowerCase().trim();
    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      setUsernameStatus("invalid");
      setUsernameMessage(
        "3-20 characters, lowercase letters, numbers, and underscores",
      );
      return;
    }
    const timeout = setTimeout(() => {
      setUsernameStatus("checking");
      fetch(
        apiUrl(
          `/auth/username-available?username=${encodeURIComponent(normalized)}`,
        ),
      )
        .then((res) => res.json())
        .then((data: { available: boolean; reason?: string }) => {
          if (data.available) {
            setUsernameStatus("available");
            setUsernameMessage("Username is available");
            return;
          }
          if (data.reason === "reserved") {
            setUsernameStatus("invalid");
            setUsernameMessage("That username is reserved");
            return;
          }
          if (data.reason === "invalid") {
            setUsernameStatus("invalid");
            setUsernameMessage(
              "3-20 characters, lowercase letters, numbers, and underscores",
            );
            return;
          }
          setUsernameStatus("taken");
          setUsernameMessage("That username is already taken");
        })
        .catch(() => {
          setUsernameStatus("idle");
          setUsernameMessage("");
        });
    }, 400);
    return () => clearTimeout(timeout);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (usernameStatus === "taken" || usernameStatus === "invalid") {
      setError("Please choose an available username");
      return;
    }

    setLoading(true);
    try {
      await register(email, username, password, { website, formStartedAt });
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
        <p className="text-text-muted text-sm mb-3">
          Join Lapwise to discuss races, ask Clutch, and track your favorites.
        </p>
        <ul className="flex flex-col gap-1 mb-6">
          {[
            "Race comments & community",
            "Clutch AI — ask anything about F1 data",
            "Favorite driver, team & circuit",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-[11px] font-mono text-text-muted"
            >
              <span className="w-1 h-1 rounded-full bg-purple-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <GoogleButton />
        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <Input
              id="website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              autoComplete="username"
              pattern="^[a-z0-9_]{3,20}$"
              className="font-mono text-sm"
              placeholder="cool_racer"
            />
            {usernameStatus === "idle" && (
              <p className="text-xs text-text-muted mt-1">
                3-20 characters, lowercase letters, numbers, and underscores
              </p>
            )}
            {usernameStatus === "checking" && (
              <p className="text-xs text-text-muted mt-1">
                Checking availability...
              </p>
            )}
            {usernameStatus !== "checking" && usernameMessage && (
              <p
                className={`text-xs mt-1 ${
                  usernameStatus === "available"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {usernameMessage}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
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
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth isLoading={loading}>
            Create account
          </Button>

          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            By creating an account you agree to our{" "}
            <Link
              href="/terms"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Privacy Policy
            </Link>
            .
          </p>
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
