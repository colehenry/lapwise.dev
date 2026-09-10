"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import FavoritesPrompt from "@/components/favorites/FavoritesPrompt";
import AuthProvider from "@/components/providers/AuthProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import Footer from "./Footer";
import Navigation from "./Navigation";
import ScrollbarHandler from "./ScrollbarHandler";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatWorkspace = pathname === "/ask";

  return (
    <QueryProvider>
      <AuthProvider>
        <ScrollbarHandler />
        <Navigation />
        <main
          className={`pt-[52px] ${isChatWorkspace ? "" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"}`}
        >
          {children}
        </main>
        {!isChatWorkspace && <Footer />}
        <FavoritesPrompt />
      </AuthProvider>
    </QueryProvider>
  );
}
