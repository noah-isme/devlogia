import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDeveloperDocNav } from "@/lib/devportal/docs";

export default function DevelopersLandingPage() {
  const nav = getDeveloperDocNav();
  const featured = nav.flatMap((section) => section.items).slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-gradient-to-br from-background via-background to-muted/40 p-10 shadow-sm">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Phase 12B · Developer experience
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Build, launch, and scale on Devlogia</h1>
          <p className="text-lg text-muted-foreground">
            Access production-ready documentation, OpenAPI playground, submission workflow, and secure webhook tooling in a single portal.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/developers/docs/auth">Read the docs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/developers/playground">Open API playground</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {featured.map((item) => (
          <article key={item.href} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-6 shadow-sm transition hover:-translate-y-1 hover:shadow">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Featured doc</p>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <Link href={item.href} className="mt-auto text-sm font-medium text-primary hover:underline">
              Explore →
            </Link>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-6">
          <h2 className="text-xl font-semibold">Submission workflow</h2>
          <p className="text-sm text-muted-foreground">
            Submit plugins and AI extensions, monitor review status, and capture marketplace badges. Real-time updates keep partners aligned with internal reviewers.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Draft manifests and upload via the submission console.</li>
            <li>• Reviewers collaborate in the internal console with checklists and notes.</li>
            <li>• Approved integrations automatically surface in the marketplace with earned badges.</li>
          </ul>
          <div className="flex gap-3">
            <Button asChild size="sm">
              <Link href="/developers/submissions">Partner console</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/internal/reviews">Review console</Link>
            </Button>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-6">
          <h2 className="text-xl font-semibold">Telemetry & tooling</h2>
          <p className="text-sm text-muted-foreground">
            Track key metrics like <code>playground_requests</code>, <code>submission_created</code>, and <code>rate_limit_block_count</code> across the portal. Use the webhook tester to validate signatures before going live.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Sandbox API playground with automatic bearer tokens.</li>
            <li>• Signed webhook tester with nonce-based replay guard.</li>
            <li>• DocSearch integration for fast discovery across guides.</li>
          </ul>
          <div className="flex gap-3">
            <Button asChild size="sm">
              <Link href="/developers/playground">Launch playground</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/developers/webhooks/tester">Test webhooks</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
