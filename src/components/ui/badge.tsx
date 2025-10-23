import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "info" | "warning";
};

const badgeStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-600/10 text-emerald-600",
  info: "bg-sky-600/10 text-sky-600",
  warning: "bg-amber-500/10 text-amber-600",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgeStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
