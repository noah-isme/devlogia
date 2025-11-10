import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/seo";

export function LandingNavbar() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link href="/#features" className="transition hover:text-foreground text-muted-foreground">
              Features
            </Link>
            <Link href="/#pricing" className="transition hover:text-foreground text-muted-foreground">
              Pricing
            </Link>
            <Link href="/developers" className="transition hover:text-foreground text-muted-foreground">
              Docs
            </Link>
            <Link href="/blog" className="transition hover:text-foreground text-muted-foreground">
              Blog
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/admin/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/login">Start Free</Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
