import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserRoleManager } from "@/components/admin/UserRoleManager";
import type { Role } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  const serialized = users.map((user) => ({
    ...user,
    role: user.role as Role,
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
