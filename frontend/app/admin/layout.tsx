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

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/comments", label: "Comments" },
  ];

  return (
    <div className="bg-bg-primary min-h-screen">
      <Section background="primary" spacing="sm">
        <div className="py-6 border-b border-border-primary mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Admin System
            </span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              <span className="text-purple-400">Admin</span> Panel
            </h1>
          </div>
          <nav className="flex items-center gap-1 mt-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-sm text-sm font-medium transition-all ${
                    isActive
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main>{children}</main>
      </Section>
    </div>
  );
}
