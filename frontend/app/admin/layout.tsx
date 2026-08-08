"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Section from "@/components/ui/Section";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  // The shell the resolved page renders into, so nothing shifts when auth
  // lands. Skeleton blocks rather than a spinner, which is what the rest of
  // the site loads with.
  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Section background="primary" spacing="sm">
          <div className="mb-5 h-10 border-b border-border-primary" />
          <div className="space-y-2">
            {["a", "b", "c"].map((key) => (
              <div
                key={key}
                className="h-12 animate-pulse rounded-sm border border-border-primary bg-bg-tertiary"
              />
            ))}
          </div>
        </Section>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/comments", label: "Comments" },
    { href: "/admin/puzzles", label: "Grids" },
  ];

  return (
    <div className="bg-bg-primary min-h-screen">
      <Section background="primary" spacing="sm">
        {/* The tab names say which page this is, so there is no heading above
            them to repeat it. */}
        <nav className="mb-5 flex items-center gap-5 border-b border-border-primary">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px border-b-2 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-purple-400 text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main>{children}</main>
      </Section>
    </div>
  );
}
