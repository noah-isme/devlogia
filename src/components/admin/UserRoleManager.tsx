"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/rbac";

const ROLE_OPTIONS: Role[] = ["owner", "editor", "writer"];
const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  writer: "Writer",
};

type UserSummary = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

type Props = {
  users: UserSummary[];
  currentUserId: string;
};

type Feedback = { status: "success" | "error"; message: string } | null;

type RoleDraft = Record<string, Role>;

export function UserRoleManager({ users, currentUserId }: Props) {
  const [draftRoles, setDraftRoles] = useState<RoleDraft>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [state, setState] = useState(users);

  const sortedUsers = useMemo(() => state.slice().sort((a, b) => a.email.localeCompare(b.email)), [state]);

  function handleSelectChange(userId: string, role: Role) {
    setDraftRoles((prev) => ({ ...prev, [userId]: role }));
  }

  async function handleUpdate(userId: string) {
    const user = state.find((item) => item.id === userId);
    if (!user) return;

    const nextRole = draftRoles[userId];
    if (!nextRole || nextRole === user.role) {
      setFeedback({ status: "success", message: "No changes to save." });
      return;
    }

    setPendingId(userId);
    setFeedback(null);

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
      setFeedback({ status: "success", message: `${user.email} is now ${ROLE_LABELS[updatedRole]}.` });
    } catch (error) {
      console.error(error);
      setDraftRoles((prev) => ({ ...prev, [userId]: user.role }));
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Update failed." });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
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
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={draftRole}
                      onChange={(event) => handleSelectChange(user.id, event.target.value as Role)}
                      disabled={disableChange || pendingId === user.id}
                      aria-label={`Role for ${user.email}`}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disableChange || pendingId === user.id || draftRole === user.role}
                      onClick={() => handleUpdate(user.id)}
                    >
                      {pendingId === user.id ? "Saving…" : "Save"}
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
