import Link from "next/link";
import type { ReactNode } from "react";

import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";
import { TelemetryProvider } from "@/components/telemetry-provider";
import { buildOrganizationJsonLd, siteConfig } from "@/lib/seo";
import { cn } from "@/lib/utils";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <TelemetryProvider page="public">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-8 pt-12 sm:px-6">
        <header className="mb-12">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/" className="transition hover:text-foreground">
                Home
              </Link>
              <Link href="/subscribe" className="transition hover:text-foreground">
                Subscribe
              </Link>
              <Link href="/admin/posts" className={cn("transition hover:text-foreground")}>
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {siteConfig.name}. Built for deep writing.</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/subscribe" className="underline-offset-4 hover:underline">
                Join the newsletter
              </Link>
              <Link href="/rss" className="underline-offset-4 hover:underline">
                RSS
              </Link>
            </div>
          </div>
        </footer>
        <JsonLd id="organization-jsonld" data={buildOrganizationJsonLd()} />
        <Analytics />
      </div>
    </TelemetryProvider>
  );
}
