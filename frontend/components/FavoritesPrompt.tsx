"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import FavoritesPicker from "@/components/favorites/FavoritesPicker";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";

const DISMISS_KEY = "favorites_dismissed";

export default function FavoritesPrompt() {
  const { user, refreshUser } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const hasFavorites =
      user.favorite_driver || user.favorite_team || user.favorite_circuit;
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (!hasFavorites && !dismissed) {
      setShowPicker(true);
    }
  }, [user]);

  const handleClose = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShowPicker(false);
  }, []);

  const handleSave = useCallback(
    async (favorites: {
      favorite_driver_slug: string | null;
      favorite_team_name: string | null;
      favorite_circuit_id: number | null;
    }) => {
      setIsSaving(true);
      try {
        const res = await fetchWithAuth(apiUrl("/auth/me"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(favorites),
        });
        if (!res.ok) {
          throw new Error(
            await extractErrorMessage(res, "Failed to save favorites"),
          );
        }
        await refreshUser();
        setShowPicker(false);
      } catch {
        // Silently fail — user can set favorites later from settings
      } finally {
        setIsSaving(false);
      }
    },
    [refreshUser],
  );

  return (
    <FavoritesPicker
      open={showPicker}
      onClose={handleClose}
      onSave={handleSave}
      isSaving={isSaving}
    />
  );
}
