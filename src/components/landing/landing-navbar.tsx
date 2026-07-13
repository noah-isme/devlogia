import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/seo";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex items-center gap-3"
          aria-label={`${siteConfig.name} home`}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-sm font-bold text-background shadow-lg shadow-foreground/10 transition-transform group-hover:-rotate-3">
            D
          </span>
          <span className="text-lg font-semibold tracking-[-0.025em]">
            {siteConfig.name}
          </span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 text-sm font-medium shadow-sm md:flex">
          <Link
            href="/#features"
            className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:no-underline"
          >
            Features
          </Link>
          <Link
            href="/#pricing"
            className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:no-underline"
          >
            Pricing
          </Link>
          <Link
            href="/developers"
            className="rounded-full px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:no-underline"
          >
            Docs
          </Link>
          <Link
            href="/blog"
            className="rounded-full bg-foreground px-4 py-2 text-background transition hover:bg-foreground/90 hover:text-background hover:no-underline"
          >
            Journal
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/admin/login">Login</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full bg-foreground px-5 text-background shadow-lg shadow-foreground/10 hover:bg-foreground/90 hover:text-background"
          >
            <Link href="/admin/login">Start writing</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
