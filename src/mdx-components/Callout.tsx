import { cn } from "@/lib/utils";

type CalloutProps = {
  title?: string;
  type?: "info" | "success" | "warning";
  children: React.ReactNode;
};

const colors: Record<NonNullable<CalloutProps["type"]>, string> = {
  info: "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-200",
  success:
    "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-200",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

export function Callout({ title, type = "info", children }: CalloutProps) {
  return (
    <div
      className={cn(
        "my-6 rounded-lg border px-4 py-3 text-sm",
        colors[type] ?? colors.info,
      )}
      role="note"
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
