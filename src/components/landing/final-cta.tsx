import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function FinalCTA() {
  return (
    <section className="py-16">
      <ScrollReveal direction="up">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-8 md:p-12 text-center space-y-6 shadow-xl transition-all duration-300 hover:border-primary/30">
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse-subtle" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-secondary/20 blur-3xl pointer-events-none animate-pulse-subtle" />

          <h2 className="relative z-10 text-3xl font-bold tracking-tight sm:text-4xl">
            Start writing today
          </h2>
          <p className="relative z-10 mx-auto max-w-2xl text-lg text-muted-foreground">
            Set up a workspace, import your archive, and publish your first post in
            an afternoon.
          </p>
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="min-w-[180px] btn-interactive shadow-md shadow-primary/20">
              <Link href="/admin/login">Create a free account</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[180px] btn-interactive">
              <Link href="/developers">Read the docs</Link>
            </Button>
          </div>
          <p className="relative z-10 text-xs text-muted-foreground font-medium">
            Free forever. No credit card required.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
