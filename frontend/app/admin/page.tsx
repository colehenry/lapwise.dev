"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { GridPattern } from "@/components/Patterns";
import Card from "@/components/ui/Card";
import { fetchAdminDashboardStats } from "@/lib/admin";
import type { AdminDashboardStats } from "@/lib/types";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <Card
      padding="sm"
      className="relative overflow-hidden group border-border-primary hover:border-purple-500/50 transition-all duration-200"
    >
      <GridPattern
        id={`stat-${label}`}
        className="text-purple-500 opacity-[0.04]"
      />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            {label}
          </span>
          <p className="text-4xl font-bold mt-2 text-purple-400 font-mono tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        <div className="w-12 h-12 rounded-sm bg-purple-500/12 border border-purple-500/30 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>{label}</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d={icon}
            />
          </svg>
        </div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchAdminDashboardStats();
        setStats(data);
      } catch (err) {
        setError("Failed to load dashboard statistics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 bg-bg-tertiary rounded-sm animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="h-36 animate-pulse bg-bg-tertiary/50" padding="none">
            <div className="h-full w-full" />
          </Card>
          <Card className="h-36 animate-pulse bg-bg-tertiary/50" padding="none">
            <div className="h-full w-full" />
          </Card>
        </div>
        <Card className="h-96 animate-pulse bg-bg-tertiary/50" padding="none">
          <div className="h-full w-full" />
        </Card>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="p-8 text-center text-red-400 border-red-400/20 bg-red-400/5">
        {error || "Something went wrong"}
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
        <div>
          <h2 className="text-xl font-bold text-text-primary">Overview</h2>
          <p className="text-sm text-text-muted">
            Quick statistics and recent activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          label="Total Users"
          value={stats.user_count}
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
        <StatCard
          label="Total Posts"
          value={stats.post_count}
          icon="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
          <h3 className="text-lg font-bold text-text-primary">
            Recent Login Activity
          </h3>
        </div>
        <Card padding="none" className="border-border-primary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-bg-secondary">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    User
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    IP Address
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    Status
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    Time
                  </th>
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
                        <span className="text-text-muted italic">Unknown</span>
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
        </Card>
      </div>
    </div>
  );
}
