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
          <div className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
            {children}
          </div>
        </main>
        <footer className="border-t border-border/70 bg-foreground text-background">
          <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
            <div className="grid gap-12 border-b border-background/15 pb-14 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
              <div className="max-w-sm space-y-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-background text-sm font-bold text-foreground">
                    D
                  </span>
                  <span className="text-xl font-semibold tracking-tight">
                    {siteConfig.name}
                  </span>
                </div>
                <p className="text-sm leading-7 text-background/65">
                  A publishing workspace for teams who believe thoughtful ideas
                  deserve exceptional presentation.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Product</h3>
                <ul className="space-y-3 text-sm text-background/60">
                  <li>
                    <Link
                      href="/#features"
                      className="transition hover:text-background"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#pricing"
                      className="transition hover:text-background"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/marketplace"
                      className="transition hover:text-background"
                    >
                      Marketplace
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Resources</h3>
                <ul className="space-y-3 text-sm text-background/60">
                  <li>
                    <Link
                      href="/developers"
                      className="transition hover:text-background"
                    >
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/blog"
                      className="transition hover:text-background"
                    >
                      Journal
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/subscribe"
                      className="transition hover:text-background"
                    >
                      Newsletter
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Company</h3>
                <ul className="space-y-3 text-sm text-background/60">
                  <li>
                    <Link
                      href="/subscribe"
                      className="transition hover:text-background"
                    >
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/posts"
                      className="transition hover:text-background"
                    >
                      Admin
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Legal</h3>
                <ul className="space-y-3 text-sm text-background/60">
                  <li>
                    <Link
                      href="/subscribe"
                      className="transition hover:text-background"
                    >
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/subscribe"
                      className="transition hover:text-background"
                    >
                      Terms
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-8 text-xs text-background/50 sm:flex-row sm:items-center sm:justify-between">
              <p>
                © {new Date().getFullYear()} {siteConfig.name}. Built for deep
                writing.
              </p>
              <p>Clarity in every detail.</p>
            </div>
          </div>
        </footer>
        <JsonLd id="organization-jsonld" data={buildOrganizationJsonLd()} />
        <Analytics />
      </div>
    </TelemetryProvider>
  );
}
