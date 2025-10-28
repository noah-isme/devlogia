"use client";

import { FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/rbac";
import { toast } from "sonner";

const ROLE_OPTIONS: Role[] = ["admin", "editor", "writer"];
const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  editor: "Editor",
  writer: "Writer",
};

type UserSummary = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  isActive: boolean;
};

type Props = {
  users: UserSummary[];
  currentUserId: string;
};

type RoleDraft = Record<string, Role>;

type CreateDraft = {
  email: string;
  password: string;
  role: Role;
};

const INITIAL_CREATE_DRAFT: CreateDraft = {
  email: "",
  password: "",
  role: "editor",
};

export function UserRoleManager({ users, currentUserId }: Props) {
  const [draftRoles, setDraftRoles] = useState<RoleDraft>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [state, setState] = useState(users);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(INITIAL_CREATE_DRAFT);
  const [createPending, setCreatePending] = useState(false);

  const sortedUsers = useMemo(
    () => state.slice().sort((a, b) => a.email.localeCompare(b.email)),
    [state],
  );

  function handleSelectChange(userId: string, role: Role) {
    setDraftRoles((prev) => ({ ...prev, [userId]: role }));
  }

  async function handleUpdate(userId: string) {
    const user = state.find((item) => item.id === userId);
    if (!user) return;

    const nextRole = draftRoles[userId];
    if (!nextRole || nextRole === user.role) {
      toast.info("No changes to save", { description: "Select a different role before saving." });
      return;
    }

    setPendingId(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to update role.";
        throw new Error(message);
      }

      const data = await response.json();
      const updatedRole = data.user.role as Role;
      setState((prev) => prev.map((item) => (item.id === userId ? { ...item, role: updatedRole } : item)));
      setDraftRoles((prev) => ({ ...prev, [userId]: updatedRole }));
      toast.success("Role updated", {
        description: `${user.email} is now ${ROLE_LABELS[updatedRole]}.`,
      });
    } catch (error) {
      console.error(error);
      setDraftRoles((prev) => ({ ...prev, [userId]: user.role }));
      toast.error("Unable to update role", {
        description: error instanceof Error ? error.message : "Update failed.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(userId: string) {
    const user = state.find((item) => item.id === userId);
    if (!user) return;
    const confirmed = window.confirm(`Remove ${user.email}?`);
    if (!confirmed) return;

    setPendingId(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to delete user.";
        throw new Error(message);
      }

      setState((prev) => prev.filter((item) => item.id !== userId));
      toast.success("User removed", { description: `${user.email} no longer has access.` });
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete user", {
        description: error instanceof Error ? error.message : "Delete failed.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatePending(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createDraft),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to create user.";
        throw new Error(message);
      }

      const data = await response.json();
      const created: UserSummary = {
        id: data.user.id,
        email: data.user.email,
        createdAt: data.user.createdAt,
        role: data.user.role,
        isActive: data.user.isActive,
      };
      setState((prev) => [...prev, created]);
      setDraftRoles((prev) => ({ ...prev, [created.id]: created.role }));
      setCreateDraft(INITIAL_CREATE_DRAFT);
      toast.success("User created", {
        description: `${created.email} added as ${ROLE_LABELS[created.role]}.`,
      });
    } catch (error) {
      console.error(error);
      toast.error("Unable to create user", {
        description: error instanceof Error ? error.message : "Create failed.",
      });
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="user-management">
      <section className="rounded-md border border-border p-4">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreate} data-testid="user-create-form">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              name="email"
              type="email"
              required
              value={createDraft.email}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="editor@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              name="password"
              type="password"
              minLength={6}
              required
              value={createDraft.password}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-role">Role</Label>
            <Select
              id="new-user-role"
              value={createDraft.role}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, role: event.target.value as Role }))}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createPending} className="w-full" data-testid="user-create-submit">
              {createPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </section>

      <div className="overflow-x-auto rounded-md border border-border" data-testid="user-table">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const draftRole = draftRoles[user.id] ?? user.role;
              const disableChange = user.id === currentUserId;
              return (
                <tr key={user.id} className="border-t border-border" data-testid={`user-row-${user.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.isActive ? "success" : "warning"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={draftRole}
                      onChange={(event) => handleSelectChange(user.id, event.target.value as Role)}
                      disabled={disableChange || pendingId === user.id}
                      aria-label={`Role for ${user.email}`}
                    >
                      {["superadmin", ...ROLE_OPTIONS].map((role) => (
                        <option key={role} value={role} disabled={role === "superadmin" && user.id !== currentUserId}>
                          {ROLE_LABELS[role as Role]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disableChange || pendingId === user.id || draftRole === user.role}
                      onClick={() => handleUpdate(user.id)}
                      data-testid={`user-save-${user.id}`}
                    >
                      {pendingId === user.id ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pendingId === user.id || disableChange}
                      onClick={() => handleDelete(user.id)}
                      data-testid={`user-delete-${user.id}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
