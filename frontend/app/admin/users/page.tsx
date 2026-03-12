"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { GridPattern } from "@/components/Patterns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { fetchAdminUsers, updateUserRole, updateUserStatus } from "@/lib/admin";
import type { UserProfile } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const [dialogState, setDialogState] = useState<{
    type: "role" | "status" | null;
    userId: number | null;
    value: string | boolean | null;
  }>({ type: null, userId: null, value: null });

  const loadUsers = useCallback(
    async (p = page, q = query) => {
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
    },
    [page, query],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(1, query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, loadUsers]);

  const handleRoleChange = (userId: number, currentRole: string) => {
    const roles = ["user", "moderator", "admin"];
    const nextRole = roles[(roles.indexOf(currentRole) + 1) % roles.length];
    setDialogState({ type: "role", userId, value: nextRole });
  };

  const handleStatusToggle = (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? "deactivate" : "reactivate";
    setDialogState({ type: "status", userId, value: action });
  };

  const handleConfirmDialog = async () => {
    if (
      !dialogState.type ||
      dialogState.userId === null ||
      dialogState.value === null
    )
      return;

    try {
      if (dialogState.type === "role") {
        const updatedUser = await updateUserRole(
          dialogState.userId,
          dialogState.value as string,
        );
        setUsers(
          users.map((u) => (u.id === dialogState.userId ? updatedUser : u)),
        );
      } else if (dialogState.type === "status") {
        const deactivate = dialogState.value === "deactivate";
        await updateUserStatus(dialogState.userId, !deactivate);
        loadUsers();
      }
    } catch (_err) {
      // Error handling
    } finally {
      setDialogState({ type: null, userId: null, value: null });
    }
  };

  const handleCancelDialog = () => {
    setDialogState({ type: null, userId: null, value: null });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              User Management
            </h1>
            <p className="text-sm text-text-muted">
              Manage user accounts and permissions.
            </p>
          </div>
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
        <div className="relative">
          <GridPattern
            id="users-table"
            className="text-purple-500 opacity-[0.03]"
          />
          <div className="overflow-x-auto relative">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-bg-secondary">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    User
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                    Role
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono text-center">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="text-sm hover:bg-bg-secondary/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">
                          {user.username}
                        </span>
                        <span className="text-xs text-text-muted">
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            user.role === "admin"
                              ? "purple"
                              : user.role === "moderator"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {user.role}
                        </Badge>
                        {!user.is_active && (
                          <Badge
                            variant="red"
                            size="sm"
                            className="text-[10px] uppercase"
                          >
                            Deactivated
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-text-muted text-xs font-mono">
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
                          onClick={() =>
                            handleStatusToggle(user.id, user.is_active)
                          }
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
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-text-muted italic bg-bg-tertiary/20"
                    >
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          <div className="flex items-center px-4 text-sm font-bold text-text-muted font-mono">
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

      <ConfirmDialog
        open={dialogState.type === "role"}
        title="Change Role"
        message={`Are you sure you want to change this user's role to "${dialogState.value}"?`}
        confirmLabel="Change Role"
        variant="primary"
        onConfirm={handleConfirmDialog}
        onCancel={handleCancelDialog}
      />
      <ConfirmDialog
        open={dialogState.type === "status"}
        title={
          dialogState.value === "deactivate"
            ? "Deactivate User"
            : "Reactivate User"
        }
        message={`Are you sure you want to ${String(dialogState.value)} this account?`}
        confirmLabel={
          dialogState.value === "deactivate" ? "Deactivate" : "Reactivate"
        }
        variant="danger"
        onConfirm={handleConfirmDialog}
        onCancel={handleCancelDialog}
      />
    </div>
  );
}
