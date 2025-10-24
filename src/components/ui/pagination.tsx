import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath?: string;
  className?: string;
  query?: Record<string, string | undefined>;
};

export function Pagination({
  currentPage,
  totalPages,
  basePath = "/",
  query,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) {
          params.set(key, value);
        }
      }
    }
    params.set("page", String(page));
    const suffix = params.size ? `?${params.toString()}` : "";
    return `${basePath}${suffix}`;
  };

  return (
    <nav className={cn("flex items-center justify-between", className)} aria-label="Pagination">
      <Link
        href={buildHref(prevPage)}
        className={cn(buttonVariants({ variant: "outline" }), currentPage === 1 && "pointer-events-none opacity-50")}
        aria-disabled={currentPage === 1}
      >
        Previous
      </Link>
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <Link
        href={buildHref(nextPage)}
        className={cn(buttonVariants({ variant: "outline" }), currentPage === totalPages && "pointer-events-none opacity-50")}
        aria-disabled={currentPage === totalPages}
      >
        Next
      </Link>
    </nav>
  );
}
