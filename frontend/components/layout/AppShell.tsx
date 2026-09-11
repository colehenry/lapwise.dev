"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ClutchDock from "@/components/clutch/ClutchDock";
import FavoritesPrompt from "@/components/favorites/FavoritesPrompt";
import AuthProvider from "@/components/providers/AuthProvider";
import ClutchDockProvider from "@/components/providers/ClutchDockProvider";
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
        <ClutchDockProvider>
          <ScrollbarHandler />
          <Navigation />
          <main
            className={
              isChatWorkspace
                ? ""
                : "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
            }
          >
            {children}
          </main>
          {!isChatWorkspace && <Footer />}
          {/* The workspace is the dock, full size; showing both would be two
            copies of one thread. */}
          {!isChatWorkspace && <ClutchDock />}
          <FavoritesPrompt />
        </ClutchDockProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
