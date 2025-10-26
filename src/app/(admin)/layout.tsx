import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/forms/sign-out-button";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/lib/seo";

type AdminLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  const role = session?.user?.role;
  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/posts", label: "Posts" },
    { href: "/admin/pages", label: "Pages" },
  ];

  if (role === "owner") {
    navItems.push({ href: "/admin/users", label: "Users" });
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
          <nav
            aria-label="Admin navigation"
            className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground"
            data-testid="admin-nav"
          >
            {navItems.map((item) => {
              const testId = `admin-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-foreground"
                  data-testid={testId}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
