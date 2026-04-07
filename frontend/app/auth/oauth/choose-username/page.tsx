"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { setLoggedInCookie } from "@/lib/cookies";

/**
 * Username picker shown after a brand-new Google sign-up. The backend has
 * stashed a short-lived `pending_oauth_signup` cookie containing the OAuth
 * profile; submitting this form finalizes the account.
 */
export default function ChooseUsernamePage() {
  return (
    <Suspense>
      <ChooseUsernameForm />
    </Suspense>
  );
}

function ChooseUsernameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const [username, setUsername] = useState(searchParams.get("suggested") || "");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Same debounced availability check as the password-signup page
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

    if (usernameStatus === "taken" || usernameStatus === "invalid") {
      setError("Please choose an available username");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/oauth/google/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.toLowerCase().trim() }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Sign-up failed"));
      }
      const data = await res.json();
      setAccessToken(data.access_token);
      setLoggedInCookie();
      await refreshUser();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Choose a username
        </h1>
        <p className="text-text-muted text-sm mb-8">
          This is the name that will appear on discussion boards.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoFocus
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

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={loading}
            disabled={usernameStatus !== "available"}
          >
            Finish sign-up
          </Button>
        </form>
      </div>
    </div>
  );
}
