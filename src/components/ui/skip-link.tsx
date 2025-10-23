import Link from "next/link";

import { cn } from "@/lib/utils";

type SkipLinkProps = {
  targetId?: string;
  className?: string;
};

export function SkipLink({ targetId = "main-content", className }: SkipLinkProps) {
  return (
    <Link
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-foreground focus:px-4 focus:py-2 focus:text-background",
        className,
      )}
    >
      Skip to main content
    </Link>
  );
}
