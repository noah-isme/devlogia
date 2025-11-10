import Link from "next/link";
import type { ReactNode } from "react";

import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";
import { TelemetryProvider } from "@/components/telemetry-provider";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { buildOrganizationJsonLd, siteConfig } from "@/lib/seo";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <TelemetryProvider page="public">
      <div className="flex min-h-screen w-full flex-col">
        <LandingNavbar />
        <main id="main-content" className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <footer className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Product</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/#features" className="hover:text-foreground transition">Features</Link></li>
                  <li><Link href="/#pricing" className="hover:text-foreground transition">Pricing</Link></li>
                  <li><Link href="/admin/marketplace" className="hover:text-foreground transition">Marketplace</Link></li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Resources</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/developers" className="hover:text-foreground transition">Documentation</Link></li>
                  <li><Link href="/blog" className="hover:text-foreground transition">Blog</Link></li>
                  <li><Link href="/subscribe" className="hover:text-foreground transition">Newsletter</Link></li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Company</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/subscribe" className="hover:text-foreground transition">Contact</Link></li>
                  <li><Link href="/admin/posts" className="hover:text-foreground transition">Admin</Link></li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Legal</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/subscribe" className="hover:text-foreground transition">Privacy</Link></li>
                  <li><Link href="/subscribe" className="hover:text-foreground transition">Terms</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} {siteConfig.name}. Built for deep writing.</p>
            </div>
          </div>
        </footer>
        <JsonLd id="organization-jsonld" data={buildOrganizationJsonLd()} />
        <Analytics />
      </div>
    </TelemetryProvider>
  );
}
