"use client";

import { useEffect, useState } from "react";

import { extractHeadings, type TocHeading } from "@/lib/toc";

export { extractHeadings, type TocHeading };

type TableOfContentsProps = {
  headings: TocHeading[];
};

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0 || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0.1 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-24 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-border/50 pb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span>Table of Contents</span>
      </div>

      <ul className="mt-4 space-y-2.5 text-xs">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          return (
            <li
              key={heading.id}
              className={heading.level === 3 ? "pl-3" : "pl-0"}
            >
              <a
                href={`#${heading.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(heading.id);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                    setActiveId(heading.id);
                  }
                }}
                className={`block transition hover:text-primary ${
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:no-underline"
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
