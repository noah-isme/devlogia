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
    <nav aria-label="Admin sections" className="mt-7 space-y-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-background/60 hover:bg-background/10 hover:text-background"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{item.label}</span>
            <span
              className={
                isActive
                  ? "h-1.5 w-1.5 rounded-full bg-primary"
                  : "h-1.5 w-1.5 rounded-full bg-background/20"
              }
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </nav>
  );
}
