"use client";

import type { ReactNode } from "react";
import AuthProvider from "@/components/AuthProvider";
import FavoritesPrompt from "@/components/FavoritesPrompt";
import Footer from "@/components/Footer";
import Navigation from "@/components/Navigation";
import QueryProvider from "@/components/QueryProvider";
import ScrollbarHandler from "@/components/ScrollbarHandler";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ScrollbarHandler />
        <Navigation />
        <main className="min-h-screen pt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        <Footer />
        <FavoritesPrompt />
      </AuthProvider>
    </QueryProvider>
  );
}
