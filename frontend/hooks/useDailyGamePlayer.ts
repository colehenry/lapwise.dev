"use client";

import { useEffect, useState } from "react";

const PLAYER_KEY = "lapwise:daily-games:player";

export function useDailyGamePlayer(): string {
  const [playerId, setPlayerId] = useState("");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAYER_KEY);
      if (stored) {
        setPlayerId(stored);
        return;
      }
      const created = window.crypto.randomUUID();
      window.localStorage.setItem(PLAYER_KEY, created);
      setPlayerId(created);
    } catch {
      setPlayerId(window.crypto.randomUUID());
    }
  }, []);
  return playerId;
}
