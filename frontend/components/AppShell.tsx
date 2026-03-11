"use client";

import type { ReactNode } from "react";
import AuthProvider from "@/components/AuthProvider";
import Footer from "@/components/Footer";
import Navigation from "@/components/Navigation";
import QueryProvider from "@/components/QueryProvider";
import ScrollbarHandler from "@/components/ScrollbarHandler";
import { SidebarProvider, useSidebar } from "@/components/SidebarContext";

function ShellContent({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <>
      <ScrollbarHandler />
      <Navigation />
      <div
        data-shell-content
        className="transition-[margin] duration-200 ease-out max-md:!ml-0"
        style={{ marginLeft: isOpen ? "18rem" : "4rem" }}
      >
        <main className="min-h-screen">{children}</main>
        <Footer />
      </div>
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SidebarProvider>
          <ShellContent>{children}</ShellContent>
        </SidebarProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
