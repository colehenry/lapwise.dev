"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { fetchAdminDashboardStats } from "@/lib/admin";
import type { AdminDashboardPeriod, AdminDashboardStats } from "@/lib/types";

const PERIODS: { value: AdminDashboardPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "24h", label: "24H" },
];

function periodLabel(
  period: AdminDashboardPeriod,
  all: string,
  scoped: string,
) {
  return period === "all" ? all : scoped;
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
        {label}
      </span>
      <p className="text-3xl font-bold text-purple-400 font-mono tracking-tight">
        {value.toLocaleString()}
      </p>
      {note && (
        <span className="text-[10px] text-text-muted font-mono">{note}</span>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("all");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminDashboardStats(period)
      .then(setStats)
      .catch(() => setError("Failed to load dashboard statistics"))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-text-primary">Overview</h2>
            <p className="text-sm text-text-muted">
              Quick statistics and recent activity.
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border-primary rounded-sm p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                period === p.value
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-text-muted hover:text-text-primary border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["users", "active", "comments", "ai"].map((k) => (
            <div
              key={k}
              className="bg-bg-tertiary border border-border-primary rounded-sm p-4 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : error || !stats ? (
        <div className="p-8 text-center text-red-400 border border-red-400/20 bg-red-400/5 rounded-sm">
          {error || "Something went wrong"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={periodLabel(period, "Total Users", "New Users")}
            value={stats.user_count}
          />
          <StatCard
            label={periodLabel(period, "Ever Active", "Active Users")}
            value={stats.active_users}
            note="unique logins"
          />
          <StatCard
            label={periodLabel(period, "Total Comments", "New Comments")}
            value={stats.comment_count}
          />
          <StatCard
            label="AI Queries"
            value={stats.total_ai_queries}
            note="all-time total"
          />
        </div>
      )}

      {/* Quick links */}
      {!loading && stats && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
            <h3 className="text-lg font-bold text-text-primary">Quick Links</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: "Sentry Issues",
                href: "https://lapwise.sentry.io/issues/",
              },
              {
                label: "Sentry Performance",
                href: "https://lapwise.sentry.io/performance/",
              },
              { label: "Neon DB", href: "https://console.neon.tech" },
              { label: "Railway", href: "https://railway.app" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-medium bg-bg-secondary border border-border-primary hover:border-purple-500/50 text-text-secondary hover:text-text-primary transition-all"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent login activity */}
      {!loading && stats && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
            <h3 className="text-lg font-bold text-text-primary">
              Recent Login Activity
            </h3>
          </div>
          <div className="border border-border-primary rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-secondary">
                    {["User", "IP Address", "Status", "Time"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {stats.recent_activity.map((activity) => (
                    <tr
                      key={activity.id}
                      className="text-sm hover:bg-bg-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {activity.username || (
                          <span className="text-text-muted italic">
                            Unknown
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-muted font-mono text-xs">
                        {activity.ip_address}
                      </td>
                      <td className="px-6 py-4">
                        {activity.success ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-muted text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
