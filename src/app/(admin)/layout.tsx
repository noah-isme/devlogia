import type { ReactNode } from "react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/lib/seo";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";

type AdminLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  const role = session?.user?.role;
  const navItems: AdminNavItem[] = [
    { href: "/admin/dashboard", label: "Dashboard", slug: "dashboard" },
    { href: "/admin/posts", label: "Posts", slug: "posts" },
    { href: "/admin/pages", label: "Pages", slug: "pages" },
  ];

  if (role === "owner") {
    navItems.push({ href: "/admin/users", label: "Users", slug: "users" });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{siteConfig.name} Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage posts, pages, and media from a single dashboard.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <AdminNav items={navItems} />
          <SignOutButton />
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
