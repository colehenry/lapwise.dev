"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Section from "@/components/ui/Section";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/tags", label: "Tags" },
  ];

  return (
    <Section background="primary" spacing="md">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-bg-tertiary border border-border-primary rounded-sm p-2 sticky top-24">
            <div className="px-4 py-4 mb-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">Admin System</h2>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-2.5 rounded-sm text-sm font-bold transition-all ${
                      isActive
                        ? "bg-purple-500 text-text-primary shadow-lg shadow-purple-500/20"
                        : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </Section>
  );
}
