"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { fetchAdminDashboardStats } from "@/lib/admin";
import type {
  AdminDashboardPeriod,
  AdminDashboardStats,
} from "@/lib/adminTypes";

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
    <div className="bg-surface-panel border border-line-soft rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[10px] tracking-widest text-ink-faint font-bold uppercase font-mono">
        {label}
      </span>
      <p className="text-3xl font-bold text-accent-bright font-mono tracking-tight">
        {value.toLocaleString()}
      </p>
      {note && (
        <span className="text-[10px] text-ink-faint font-mono">{note}</span>
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
          <div className="w-1.5 h-8 bg-accent rounded-full" />
          <div>
            <h2 className="text-xl font-bold text-ink-strong">Overview</h2>
            <p className="text-sm text-ink-faint">
              Quick statistics and recent activity.
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-surface-band border border-line-soft rounded-sm p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                period === p.value
                  ? "bg-accent/20 text-accent-light border border-accent/40"
                  : "text-ink-faint hover:text-ink-strong border border-transparent"
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
              className="bg-surface-panel border border-line-soft rounded-sm p-4 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : error || !stats ? (
        <div className="p-8 text-center text-danger-bright border border-danger-bright/20 bg-danger-bright/5 rounded-sm">
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
            <div className="w-1.5 h-6 bg-accent rounded-full" />
            <h3 className="text-lg font-bold text-ink-strong">Quick Links</h3>
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
                className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-medium bg-surface-band border border-line-soft hover:border-accent/50 text-ink-base hover:text-ink-strong transition-all"
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
            <div className="w-1.5 h-6 bg-accent rounded-full" />
            <h3 className="text-lg font-bold text-ink-strong">
              Recent Login Activity
            </h3>
          </div>
          <div className="border border-line-soft rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line-soft bg-surface-band">
                    {["User", "IP Address", "Status", "Time"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ink-faint font-mono"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {stats.recent_activity.map((activity) => (
                    <tr
                      key={activity.id}
                      className="text-sm hover:bg-surface-band/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-ink-strong">
                        {activity.username || (
                          <span className="text-ink-faint italic">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-faint font-mono text-xs">
                        {activity.ip_address}
                      </td>
                      <td className="px-6 py-4">
                        {activity.success ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-danger/10 text-danger-bright border border-danger/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger-bright mr-2" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink-faint text-xs whitespace-nowrap">
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
