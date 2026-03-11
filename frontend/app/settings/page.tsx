"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/ui/Button";
import { apiUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/settings");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setBio(user.bio || "");
    }
  }, [user]);

  if (isLoading || !user) return null;

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileLoading(true);

    try {
      const res = await fetchWithAuth(apiUrl("/auth/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, bio }),
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
              maxLength={50}
              required
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="bio"
              className="block text-sm text-text-secondary mb-1.5"
            >
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors resize-none"
            />
            <p className="text-xs text-text-muted mt-1">
              {bio.length}/200 characters
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
            <input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm text-text-secondary mb-1.5"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
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

      {/* Danger Zone */}
      <section>
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger zone</h2>
        <div className="border border-red-500/20 rounded-lg p-4">
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
      </section>
    </div>
  );
}
