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

const CLUTCH_DISABLED_ROUTE_PREFIXES = [
  "/results",
  "/drivers",
  "/constructors",
  "/circuits",
  "/tracks",
] as const;

function routeHasClutch(pathname: string): boolean {
  if (pathname === "/" || pathname === "/ask") return false;
  return !CLUTCH_DISABLED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatWorkspace = pathname === "/ask";
  const showClutchDock = routeHasClutch(pathname);

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
          {showClutchDock && <ClutchDock />}
          <FavoritesPrompt />
        </ClutchDockProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
