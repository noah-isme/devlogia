import type { Metadata } from "next";

import { NewsletterForm } from "@/components/newsletter-form";
import { buildMetadata, siteConfig } from "@/lib/seo";

const provider = (process.env.NEWSLETTER_PROVIDER ?? "").trim().toLowerCase();

export const metadata: Metadata = buildMetadata({
  title: "Subscribe",
  description:
    "Join the Devlogia newsletter to receive new posts, tools, and behind-the-scenes notes.",
});

export default function SubscribePage() {
  const isProviderConfigured = Boolean(provider);

  return (
    <section className="mx-auto max-w-6xl py-6 sm:py-12">
      <div className="overflow-hidden rounded-[2rem] bg-foreground text-background shadow-2xl shadow-foreground/15">
        <div className="editorial-grid grid gap-10 p-7 sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:p-16">
          <header className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-background/55">
              The Devlogia briefing
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">
              One thoughtful email. No noise.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-background/65">
              Subscribe to {siteConfig.name} to receive new essays, product
              updates, and curated resources directly in your inbox. No
              spam—unsubscribe anytime.
            </p>
          </header>
          <div className="rounded-2xl bg-background p-6 text-foreground shadow-xl sm:p-8">
            {isProviderConfigured ? (
              <NewsletterForm />
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="text-lg font-semibold text-foreground">
                  Newsletter coming soon
                </p>
                <p>
                  Configure <code>NEWSLETTER_PROVIDER</code> and API credentials
                  to enable subscriptions. Until then, follow along via RSS or
                  our social channels.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
        <p className="rounded-2xl border border-border/70 bg-card/70 p-5">
          <span className="mb-2 block font-semibold text-foreground">
            Private by default
          </span>
          Your email is stored securely and never shared.
        </p>
        <p className="rounded-2xl border border-border/70 bg-card/70 p-5">
          <span className="mb-2 block font-semibold text-foreground">
            Easy to leave
          </span>
          Unsubscribe instantly from every email.
        </p>
        <p className="rounded-2xl border border-border/70 bg-card/70 p-5">
          <span className="mb-2 block font-semibold text-foreground">
            Respectful analytics
          </span>
          We honor Do Not Track and aggregate trends.
        </p>
      </div>
    </section>
  );
}
