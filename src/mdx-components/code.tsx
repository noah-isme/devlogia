import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { InteractiveCodeBlock } from "@/mdx-components/InteractiveCodeBlock";

export function Pre(props: ComponentPropsWithoutRef<"pre">) {
  return <InteractiveCodeBlock {...props} />;
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
