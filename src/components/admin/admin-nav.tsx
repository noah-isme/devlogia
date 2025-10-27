"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type AdminNavItem = {
  href: string;
  label: string;
  slug: string;
};

type AdminNavProps = {
  items: AdminNavItem[];
};

export function AdminNav({ items }: AdminNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const activeSlug = useMemo(() => {
    const match = items.find((item) => pathname?.startsWith(item.href));
    return match?.slug ?? null;
  }, [items, pathname]);

  const navId = "admin-nav-menu";

  return (
    <div className="w-full sm:w-auto">
      <div className="flex items-center justify-between sm:justify-end">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:hidden"
          )}
          aria-controls={navId}
          aria-expanded={isOpen}
          data-testid="sidebar-toggle"
          onClick={() => setIsOpen((value) => !value)}
        >
          <span aria-hidden="true" className="text-base">
            ☰
          </span>
          <span>Menu</span>
        </button>
      </div>
      <nav
        id={navId}
        aria-label="Admin navigation"
        data-testid="admin-nav"
        className={cn(
          "mt-3 flex flex-col gap-2 text-sm font-medium text-muted-foreground sm:mt-0 sm:flex-row sm:items-center sm:gap-3",
          isOpen ? "flex" : "hidden sm:flex"
        )}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-testid={`nav-${item.slug}`}
            className={cn(
              "rounded-md px-2 py-1 transition hover:text-foreground",
              activeSlug === item.slug ? "bg-muted text-foreground" : undefined
            )}
            onClick={() => setIsOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
