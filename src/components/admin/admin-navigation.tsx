"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
};

type AdminNavigationProps = {
  items: AdminNavItem[];
};

export function AdminNavigation({ items }: AdminNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="mt-6 space-y-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{item.label}</span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Go</span>
          </Link>
        );
      })}
    </nav>
  );
}
