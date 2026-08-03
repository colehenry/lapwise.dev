"use client";

import type { ReactNode } from "react";
import FavoritesPrompt from "@/components/favorites/FavoritesPrompt";
import AuthProvider from "@/components/providers/AuthProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import Footer from "./Footer";
import Navigation from "./Navigation";
import ScrollbarHandler from "./ScrollbarHandler";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ScrollbarHandler />
        <Navigation />
        <main className="pt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        <Footer />
        <FavoritesPrompt />
      </AuthProvider>
    </QueryProvider>
  );
}
