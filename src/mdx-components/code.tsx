import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export function Pre({ className, ...props }: ComponentPropsWithoutRef<"pre">) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function InlineCode({
  className,
  ...props
}: ComponentPropsWithoutRef<"code">) {
  return (
    <code
      className={cn("rounded bg-muted px-1 py-0.5 text-xs", className)}
      {...props}
    />
  );
}
