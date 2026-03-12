"use client";

import { useEffect, useState } from "react";
import { fetchAdminUsers, updateUserRole, updateUserStatus } from "@/lib/admin";
import type { UserProfile } from "@/lib/types";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { format } from "date-fns";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers(p = page, q = query) {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(p, 20, q);
      setUsers(data.users);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError("Failed to load users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(1, query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleRoleChange = async (userId: number, currentRole: string) => {
    const roles = ["user", "moderator", "admin"];
    const nextRole = roles[(roles.indexOf(currentRole) + 1) % roles.length];
    
    if (!confirm(`Change role to ${nextRole}?`)) return;

    try {
      const updatedUser = await updateUserRole(userId, nextRole);
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
    } catch (err) {
      alert("Failed to update role");
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} this account?`)) return;

    try {
      await updateUserStatus(userId, !currentStatus);
      loadUsers();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-text-primary">User Management</h1>
          <p className="text-text-muted">Manage user accounts and permissions.</p>
        </div>
        <div className="w-full md:w-80">
          <Input
            placeholder="Search username or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-bg-tertiary"
          />
        </div>
      </div>

      <Card padding="none" className="border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-primary bg-bg-secondary text-[10px] font-bold uppercase tracking-widest text-text-muted">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-center">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {users.map((user) => (
                <tr key={user.id} className="text-sm hover:bg-bg-secondary/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-text-primary">{user.username}</span>
                      <span className="text-xs text-text-muted">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === "admin" ? "purple" : user.role === "moderator" ? "info" : "neutral"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center text-text-muted text-xs">
                    {format(new Date(user.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRoleChange(user.id, user.role)}
                        className="text-xs h-8"
                      >
                        Change Role
                      </Button>
                      <Button
                        variant={user.is_active ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => handleStatusToggle(user.id, user.is_active)}
                        className="text-xs h-8"
                      >
                        {user.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-muted italic bg-bg-tertiary/20">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {total > 20 && (
        <div className="flex justify-center gap-3 mt-8">
          <Button 
            variant="secondary" 
            size="sm"
            disabled={page === 1} 
            onClick={() => loadUsers(page - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center px-4 text-sm font-bold text-text-muted">
            Page {page} of {Math.ceil(total / 20)}
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            disabled={page * 20 >= total} 
            onClick={() => loadUsers(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
