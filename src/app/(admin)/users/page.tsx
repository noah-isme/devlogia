import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserRoleManager } from "@/components/admin/UserRoleManager";
import type { Role } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "User management",
  description: "Manage team roles and permissions for Devlogia.",
});

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "owner") {
    redirect("/admin/dashboard");
  }

  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Users unavailable</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to view and manage workspace members.
        </p>
      </div>
    );
  }

  let users: Array<{ id: string; email: string; role: Role; createdAt: Date }> = [];

  try {
    const records = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    users = records.map((user) => ({
      ...user,
      role: user.role as Role,
    }));
  } catch (error) {
    console.error("Failed to load users for admin view", error);
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Users unavailable</p>
        <p>We couldn&apos;t load team members. Verify your database connection and try again.</p>
      </div>
    );
  }

  const serialized = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Team roles</h1>
        <p className="text-sm text-muted-foreground">
          Promote editors, delegate writers, and keep your Devlogia workspace secure.
        </p>
      </header>
      <UserRoleManager currentUserId={session.user.id} users={serialized} />
    </div>
  );
}
