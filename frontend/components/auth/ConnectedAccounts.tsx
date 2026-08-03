"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import GoogleButton from "./GoogleButton";

interface ConnectedAccount {
  provider: string;
  email: string | null;
  created_at: string;
}

interface ConnectedAccountsResponse {
  accounts: ConnectedAccount[];
  has_password: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
};

/**
 * Settings section that lists linked OAuth providers, lets users connect a
 * new one, and lets them disconnect (with the "don't strand yourself" guard).
 */
export default function ConnectedAccounts() {
  const { user } = useAuth();
  const [data, setData] = useState<ConnectedAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(apiUrl("/auth/oauth/connected"));
      if (!res.ok) {
        throw new Error(
          await extractErrorMessage(res, "Failed to load connected accounts"),
        );
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Surface success/error from the OAuth link redirect (?google_linked=1
    // or ?oauth_error=...) so users get feedback after the round-trip
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_linked")) {
      setMessage("Google account connected");
      // Clean the query string so the message doesn't reappear on refresh
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("oauth_error")) {
      setError(oauthErrorMessage(params.get("oauth_error") || ""));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [load]);

  async function handleDisconnect(provider: string) {
    setError("");
    setMessage("");
    setActionLoading(provider);
    try {
      const res = await fetchWithAuth(apiUrl(`/auth/oauth/${provider}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Failed to disconnect"));
      }
      setMessage(`${PROVIDER_LABELS[provider] || provider} disconnected`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading && !data) return null;

  const googleLinked = data?.accounts.find((a) => a.provider === "google");
  // Read has_password from the auth context so the guard reflects changes
  // made elsewhere on the page (e.g. the "Set password" form below) without
  // requiring a manual refetch.
  const hasPassword = user?.has_password ?? data?.has_password ?? true;
  const onlySignInMethod = !hasPassword && (data?.accounts.length ?? 0) === 1;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Connected accounts
      </h2>

      {message && <p className="text-sm text-green-400 mb-3">{message}</p>}
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-sm bg-bg-tertiary border border-border-primary">
          <div>
            <p className="text-sm text-text-primary">Google</p>
            <p className="text-xs text-text-muted">
              {googleLinked
                ? googleLinked.email || "Connected"
                : "Not connected"}
            </p>
          </div>
          {googleLinked ? (
            <Button
              variant="secondary"
              size="sm"
              isLoading={actionLoading === "google"}
              disabled={onlySignInMethod}
              onClick={() => handleDisconnect("google")}
              title={
                onlySignInMethod
                  ? "Set a password before disconnecting your only sign-in method"
                  : undefined
              }
            >
              Disconnect
            </Button>
          ) : (
            <div className="w-40">
              <GoogleButton mode="link" label="Connect" next="/settings" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case "already_linked_other":
      return "That Google account is already connected to a different Lapwise account.";
    case "link_session_lost":
      return "Linking session expired. Please try again.";
    case "exchange_failed":
      return "Google didn't complete the sign-in. Please try again.";
    case "missing_profile":
      return "Google didn't return your email. Please try again.";
    case "email_unverified":
      return "Your Google email isn't verified.";
    default:
      return "Failed to connect Google account.";
  }
}
