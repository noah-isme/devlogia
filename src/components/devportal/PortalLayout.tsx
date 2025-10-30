import Link from "next/link";

import { DeveloperDocSearch } from "@/components/devportal/DocSearch";
import type { DeveloperDocNavSection } from "@/lib/devportal/docs";
import { getDeveloperDocNav } from "@/lib/devportal/docs";
import { cn } from "@/lib/utils";

const secondaryNav: DeveloperDocNavSection = {
  title: "Tools",
  items: [
    { title: "API Playground", href: "/developers/playground", description: "Explore the OpenAPI schema and try endpoints." },
    { title: "Submission console", href: "/developers/submissions", description: "Create and track marketplace submissions." },
    { title: "Webhook tester", href: "/developers/webhooks/tester", description: "Send signed events to your staging endpoint." },
    { title: "Review console", href: "/internal/reviews", description: "Internal review workflow for Devlogia staff." },
  ],
};

type DeveloperPortalLayoutProps = {
  children: React.ReactNode;
  activePath?: string;
};

function resolveActive(pathname?: string) {
  if (!pathname) return "";
  return pathname.replace(/\/$/, "");
}

export function DeveloperPortalLayout({ children, activePath }: DeveloperPortalLayoutProps) {
  const navigation = getDeveloperDocNav();
  const fullNav = [...navigation, secondaryNav];
  const searchConfig = {
    appId: process.env.DOCS_SEARCH_APP_ID,
    apiKey: process.env.DOCS_SEARCH_API_KEY,
    indexName: process.env.DOCS_SEARCH_INDEX_NAME ?? "devlogia_docs",
  };

  const current = resolveActive(activePath);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-10 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64 lg:border-r lg:border-border lg:pr-6">
        <div className="sticky top-24 flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Devlogia Developer Portal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Build, test, and launch integrations with docs, playground, submissions, and tooling in one place.
            </p>
          </div>
          <DeveloperDocSearch {...searchConfig} />
          <nav className="space-y-6" aria-label="Developer portal navigation">
            {fullNav.map((section) => (
              <div key={section.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
                <ul className="space-y-2">
                  {section.items.map((item) => {
                    const active = current === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm transition",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span className="font-medium">{item.title}</span>
                          <span className="block text-xs text-muted-foreground">{item.description}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>
      <main className="w-full flex-1 lg:pl-6">{children}</main>
    </div>
  );
}
