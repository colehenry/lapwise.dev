"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";

type SessionInfo = {
  id: number;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  is_current: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useAuth();

  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await fetchWithAuth(apiUrl("/auth/sessions"));
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setSessionsError("Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/settings");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setBio(user.bio || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void loadSessions();
    }
  }, [isLoading, isAuthenticated, loadSessions]);

  if (isLoading || !user) return null;

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileLoading(true);

    try {
      const res = await fetchWithAuth(apiUrl("/auth/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      await refreshUser();
      setProfileMsg("Profile updated");
    } catch {
      setProfileMsg("Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordError("");
    setPasswordLoading(true);

    try {
      const res = await fetchWithAuth(apiUrl("/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed");
      }
      setPasswordMsg("Password changed");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: number, isCurrent: boolean) {
    setSessionsError("");
    try {
      const res = await fetchWithAuth(apiUrl(`/auth/sessions/${sessionId}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke session");
      if (isCurrent) {
        await logout();
        router.push("/");
        return;
      }
      await loadSessions();
    } catch {
      setSessionsError("Failed to revoke session");
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);
    try {
      const res = await fetchWithAuth(apiUrl("/auth/delete-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete account");
      }
      await logout();
      router.push("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account",
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-text-primary mb-8">Settings</h1>

      {/* Profile Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Profile
        </h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label
              htmlFor="bio"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Bio
            </label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-text-muted mt-1">
              {bio.length}/200 characters
            </p>
          </div>
          <div>
            <label
              htmlFor="avatarUrl"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Avatar URL
            </label>
            <Input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
            <p className="text-xs text-text-muted mt-1">
              Recommended: square image, at least 256x256
            </p>
          </div>
          {profileMsg && <p className="text-sm text-green-400">{profileMsg}</p>}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={profileLoading}
          >
            Save changes
          </Button>
        </form>
      </section>

      {/* Password Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Change password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label
              htmlFor="oldPassword"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Current password
            </label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm text-text-secondary mb-1.5"
            >
              New password
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {passwordMsg && (
            <p className="text-sm text-green-400">{passwordMsg}</p>
          )}
          {passwordError && (
            <p className="text-sm text-red-400">{passwordError}</p>
          )}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            isLoading={passwordLoading}
          >
            Change password
          </Button>
        </form>
      </section>

      {/* Active Sessions */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Active sessions
        </h2>
        {sessionsLoading ? (
          <p className="text-sm text-text-muted">Loading sessions...</p>
        ) : sessionsError ? (
          <p className="text-sm text-red-400">{sessionsError}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-muted">No active sessions.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-border-primary rounded-sm p-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {session.device_info || "Unknown device"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {session.ip_address
                      ? `IP ${session.ip_address}`
                      : "IP unknown"}
                  </p>
                  <p className="text-xs text-text-muted">
                    Created{" "}
                    {new Date(session.created_at).toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-text-muted">
                    Expires{" "}
                    {new Date(session.expires_at).toLocaleString("en-US")}
                  </p>
                  {session.is_current && (
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-widest text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      Current session
                    </span>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    handleRevokeSession(session.id, session.is_current)
                  }
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger zone</h2>
        <div className="border border-red-500/20 rounded-sm p-4">
          <p className="text-sm text-text-muted mb-3">
            Log out from all devices. This will revoke all active sessions.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              await fetchWithAuth(apiUrl("/auth/logout-all"), {
                method: "POST",
              });
              await logout();
              router.push("/");
            }}
          >
            Log out everywhere
          </Button>
        </div>
        <div className="border border-red-500/20 rounded-sm p-4 mt-4">
          <p className="text-sm text-text-muted mb-3">
            Delete your account. This is a soft delete and will immediately
            revoke all active sessions.
          </p>
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              placeholder="Confirm password"
              autoComplete="current-password"
              variant="danger"
            />
            {deleteError && (
              <p className="text-sm text-red-400">{deleteError}</p>
            )}
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={deleteLoading}
            >
              Delete account
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
