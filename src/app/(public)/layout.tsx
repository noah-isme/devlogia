import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "@/lib/seo";
import { cn } from "@/lib/utils";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
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
            <Link
              href="/admin/posts"
              className={cn("transition hover:text-foreground")}
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        © {new Date().getFullYear()} {siteConfig.name}. Built for deep writing.
      </footer>
    </div>
  );
}
