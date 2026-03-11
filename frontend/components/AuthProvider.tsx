"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiUrl } from "@/lib/api";
import {
  clearAccessToken,
  fetchWithAuth,
  setAccessToken,
  silentRefresh,
} from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: attempt silent refresh to restore session
  useEffect(() => {
    silentRefresh()
      .then(async (token) => {
        if (token) {
          const res = await fetchWithAuth(apiUrl("/auth/me"));
          if (res.ok) {
            const profile = await res.json();
            setUser(profile);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ identifier, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();
    setAccessToken(data.access_token);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (
      email: string,
      username: string,
      displayName: string,
      password: string,
    ) => {
      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          display_name: displayName,
          password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetchWithAuth(apiUrl("/auth/logout"), {
      method: "POST",
    }).catch(() => {});
    clearAccessToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetchWithAuth(apiUrl("/auth/me"));
    if (res.ok) {
      setUser(await res.json());
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
