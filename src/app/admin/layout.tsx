import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
  const maintenanceMode = process.env.MAINTENANCE_MODE === "true";
  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/posts", label: "Posts" },
    { href: "/admin/pages", label: "Pages" },
  ];

  if (role === "superadmin") {
    navItems.splice(1, 0, { href: "/admin/insights", label: "Insights" });
    navItems.splice(2, 0, { href: "/admin/analytics", label: "Analytics" });
    navItems.push({ href: "/admin/topics", label: "Topics" });
    navItems.push({ href: "/admin/users", label: "Users" });
    navItems.push({ href: "/admin/settings", label: "Settings" });
  } else if (role === "editor") {
    navItems.push({ href: "/admin/topics", label: "Topics" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:sticky lg:top-6 lg:w-72 lg:flex-shrink-0">
          <div className="rounded-3xl border border-border/60 bg-muted/50 p-6 shadow-sm backdrop-blur-lg supports-[backdrop-filter]:bg-muted/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{siteConfig.name}</p>
                <h1 className="mt-1 text-lg font-semibold text-foreground">Admin Console</h1>
              </div>
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Manage content, monitor analytics, and collaborate with your team in an accessible workspace.
            </p>
            <AdminNavigation items={navItems} />
            <div className="mt-8 flex flex-col gap-3">
              <div className="lg:hidden">
                <ThemeToggle />
              </div>
              <SignOutButton />
            </div>
          </div>
        </aside>
        <main
          id="main-content"
          className="flex-1 rounded-3xl border border-border/60 bg-background/90 p-4 shadow-sm sm:p-6 lg:p-8"
        >
          {maintenanceMode && (
            <div className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-100/80 p-4 text-amber-950 shadow-sm">
              <p className="text-sm font-semibold">Maintenance mode enabled</p>
              <p className="mt-1 text-sm text-amber-900/80">
                Public traffic is routed to the maintenance page. Complete validation and switch traffic using the
                rollout playbook before disabling maintenance mode.
              </p>
            </div>
          )}
          <header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {session?.user?.name ? `Welcome back, ${session.user.name.split(" ")[0]}!` : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Use the navigation to jump between admin tools. Keyboard users can press Tab to skip straight to the content area.
              </p>
            </div>
          </header>
          <div className="space-y-8 text-sm leading-6 text-foreground">{children}</div>
        </main>
      </div>
    </div>
  );
}
