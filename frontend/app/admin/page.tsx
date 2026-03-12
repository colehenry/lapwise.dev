"use client";

import { useEffect, useState } from "react";
import { fetchAdminDashboardStats } from "@/lib/admin";
import type { AdminDashboardStats } from "@/lib/types";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { formatDistanceToNow } from "date-fns";

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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="h-32 animate-pulse bg-bg-tertiary/50" />
          <Card className="h-32 animate-pulse bg-bg-tertiary/50" />
        </div>
        <Card className="h-96 animate-pulse bg-bg-tertiary/50" />
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
      <div>
        <h1 className="text-3xl font-bold mb-2 text-text-primary">Overview</h1>
        <p className="text-text-muted">Quick statistics and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card padding="lg" className="flex flex-col justify-center">
          <span className="text-text-muted text-xs font-bold uppercase tracking-widest">
            Total Users
          </span>
          <span className="text-5xl font-bold mt-2 text-purple-400">
            {stats.user_count.toLocaleString()}
          </span>
        </Card>
        <Card padding="lg" className="flex flex-col justify-center">
          <span className="text-text-muted text-xs font-bold uppercase tracking-widest">
            Total Posts
          </span>
          <span className="text-5xl font-bold mt-2 text-purple-400">
            {stats.post_count.toLocaleString()}
          </span>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text-primary px-1">Recent Login Activity</h2>
        <Card padding="none" className="border-border-primary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-bg-secondary text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">IP Address</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {stats.recent_activity.map((activity) => (
                  <tr key={activity.id} className="text-sm hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {activity.username || <span className="text-text-muted italic">Unknown</span>}
                    </td>
                    <td className="px-6 py-4 text-text-muted font-mono text-xs">
                      {activity.ip_address}
                    </td>
                    <td className="px-6 py-4">
                      {activity.success ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-muted text-xs whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
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
