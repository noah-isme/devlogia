import type { Metadata } from "next";

import { NewsletterForm } from "@/components/newsletter-form";
import { buildMetadata, siteConfig } from "@/lib/seo";

const provider = (process.env.NEWSLETTER_PROVIDER ?? "").trim().toLowerCase();

export const metadata: Metadata = buildMetadata({
  title: "Subscribe",
  description: "Join the Devlogia newsletter to receive new posts, tools, and behind-the-scenes notes.",
});

export default function SubscribePage() {
  const isProviderConfigured = Boolean(provider);

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stay in the loop</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Subscribe to {siteConfig.name} to receive new essays, product updates, and curated resources directly in your inbox.
          No spam—unsubscribe anytime.
        </p>
      </header>
      {isProviderConfigured ? (
        <div className="rounded-lg border border-border bg-muted/20 p-6 shadow-sm">
          <NewsletterForm />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          <p className="font-medium">Newsletter coming soon</p>
          <p>
            Configure <code>NEWSLETTER_PROVIDER</code> and API credentials to enable subscriptions. Until then, follow
            along via RSS or our social channels.
          </p>
        </div>
      )}
      <div className="space-y-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Privacy notice</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Your email is stored securely and never shared with third parties.</li>
          <li>You can unsubscribe instantly via the link in every email.</li>
          <li>Analytics respect Do Not Track settings and only aggregate anonymized trends.</li>
        </ul>
      </div>
    </section>
  );
}
