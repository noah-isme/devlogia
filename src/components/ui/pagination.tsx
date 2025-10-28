import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PaginationProps = {
  basePath?: string;
  className?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  previousQuery?: Record<string, string | undefined>;
  nextQuery?: Record<string, string | undefined>;
};

function buildHref(basePath: string, query?: Record<string, string | undefined>) {
  if (!query) {
    return basePath;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return `${basePath}${suffix}`;
}

export function Pagination({
  basePath = "/",
  className,
  hasNext,
  hasPrevious,
  nextQuery,
  previousQuery,
}: PaginationProps) {
  if (!hasNext && !hasPrevious) {
    return null;
  }

  return (
    <nav className={cn("flex items-center justify-between gap-4", className)} aria-label="Pagination">
      <Link
        href={buildHref(basePath, previousQuery)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          !hasPrevious && "pointer-events-none opacity-50",
        )}
        aria-disabled={!hasPrevious}
        tabIndex={hasPrevious ? undefined : -1}
      >
        Newer
      </Link>
      <Link
        href={buildHref(basePath, nextQuery)}
        className={cn(buttonVariants({ variant: "outline" }), !hasNext && "pointer-events-none opacity-50")}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
      >
        Older
      </Link>
    </nav>
  );
}
