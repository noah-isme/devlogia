import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath?: string;
  className?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  basePath = "/",
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav className={cn("flex items-center justify-between", className)} aria-label="Pagination">
      <Link
        href={`${basePath}?page=${prevPage}`}
        className={cn(buttonVariants({ variant: "outline" }), currentPage === 1 && "pointer-events-none opacity-50")}
        aria-disabled={currentPage === 1}
      >
        Previous
      </Link>
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <Link
        href={`${basePath}?page=${nextPage}`}
        className={cn(buttonVariants({ variant: "outline" }), currentPage === totalPages && "pointer-events-none opacity-50")}
        aria-disabled={currentPage === totalPages}
      >
        Next
      </Link>
    </nav>
  );
}
