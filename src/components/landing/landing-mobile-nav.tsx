"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type LandingMobileNavProps = {
  showPricing?: boolean;
};

export function LandingMobileNav({ showPricing = false }: LandingMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const links = [
    { href: "/#features", label: "Features" },
    ...(showPricing ? [{ href: "/#pricing", label: "Pricing" }] : []),
    { href: "/developers", label: "Docs" },
    { href: "/blog", label: "Journal" },
    { href: "/admin/login", label: "Login" },
  ];

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="landing-mobile-menu"
        aria-label={isOpen ? "Close main menu" : "Open main menu"}
        onClick={() => setIsOpen((prev) => !prev)}
        className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/70 text-foreground shadow-sm transition hover:bg-muted"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {isOpen ? (
        <div
          id="landing-mobile-menu"
          className="absolute inset-x-0 top-full border-b border-border/60 bg-background/95 px-4 pb-6 pt-3 shadow-lg backdrop-blur-xl sm:px-6"
        >
          <nav aria-label="Main">
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className="block rounded-xl px-3 py-3 text-base font-medium text-foreground transition hover:bg-muted hover:no-underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Button
            asChild
            className="mt-4 w-full rounded-full bg-foreground text-background shadow-lg shadow-foreground/10 hover:bg-foreground/90 hover:text-background"
          >
            <Link href="/admin/login" onClick={close}>
              Start writing
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
