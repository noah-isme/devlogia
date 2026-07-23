import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { CommandPalette, CommandPaletteTrigger } from "@/components/navigation/CommandPalette";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/lib/seo";

type AdminLayoutProps = {
  children: ReactNode;
};

export const runtime = "nodejs"; // Required for auth() with AUTH_SECRET
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  const role = session?.user?.role;
  const maintenanceMode = process.env.MAINTENANCE_MODE === "true";
  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/posts", label: "Posts" },
    { href: "/admin/reviews", label: "Reviews" },
    { href: "/admin/pages", label: "Pages" },
    { href: "/admin/comments", label: "Comments" },
    { href: "/admin/media", label: "Media" },
  ];

  if (role === "superadmin" || role === "admin" || role === "tenantAdmin") {
    navItems.splice(1, 0, { href: "/admin/insights", label: "Insights" });
    navItems.splice(2, 0, { href: "/admin/analytics", label: "Analytics" });
    navItems.splice(3, 0, { href: "/admin/federation", label: "Federation" });
    navItems.push({ href: "/admin/api-keys", label: "API Keys" });
    navItems.push({ href: "/admin/topics", label: "Topics" });
    navItems.push({ href: "/admin/users", label: "Users" });
    navItems.push({ href: "/admin/audit", label: "Audit" });
    navItems.push({ href: "/admin/settings", label: "Settings" });
  } else if (role === "editor") {
    navItems.push({ href: "/admin/topics", label: "Topics" });
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <CommandPalette />
      <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:h-full lg:w-72 lg:flex-shrink-0 lg:overflow-y-auto">
          <div className="overflow-hidden rounded-3xl bg-foreground p-6 text-background shadow-2xl shadow-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/50">
                  {siteConfig.name}
                </p>
                <h1 className="mt-1 text-lg font-semibold text-background">
                  Admin Console
                </h1>
              </div>
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-background/60">
              Manage content, monitor analytics, and collaborate with your team
              in an accessible workspace.
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
          className="premium-surface min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-3xl p-4 sm:p-6 lg:p-9"
        >
          {maintenanceMode && (
            <div className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-100/80 p-4 text-amber-950 shadow-sm">
              <p className="text-sm font-semibold">Maintenance mode enabled</p>
              <p className="mt-1 text-sm text-amber-900/80">
                Public traffic is routed to the maintenance page. Complete
                validation and switch traffic using the rollout playbook before
                disabling maintenance mode.
              </p>
            </div>
          )}
          <header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {session?.user?.name
                  ? `Welcome back, ${session.user.name.split(" ")[0]}!`
                  : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Use the navigation to jump between admin tools. Press ⌘K anywhere to search.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CommandPaletteTrigger />
            </div>
          </header>
          <div className="space-y-8 text-sm leading-6 text-foreground">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
