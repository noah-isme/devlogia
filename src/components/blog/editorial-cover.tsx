import { cn } from "@/lib/utils";

type EditorialCoverProps = {
  title: string;
  eyebrow?: string;
  className?: string;
  compact?: boolean;
};

const palettes = [
  "editorial-cover-indigo",
  "editorial-cover-midnight",
  "editorial-cover-emerald",
  "editorial-cover-violet",
] as const;

function paletteFor(title: string) {
  const seed = Array.from(title).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return palettes[seed % palettes.length];
}

export function EditorialCover({
  title,
  eyebrow = "Devlogia Journal",
  className,
  compact = false,
}: EditorialCoverProps) {
  return (
    <div
      className={cn(
        "editorial-grid relative isolate overflow-hidden rounded-[1.75rem] text-white shadow-2xl shadow-slate-950/15",
        paletteFor(title),
        compact ? "min-h-52" : "min-h-[22rem]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/20 bg-white/10 blur-sm" />
      <div className="absolute -bottom-20 -left-12 h-60 w-60 rounded-full border-[32px] border-white/10" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/50 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
          <span>{eyebrow}</span>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur">
            Ideas that ship
          </span>
        </div>
        <p
          className={cn(
            "max-w-xl font-semibold leading-[1.05] tracking-[-0.035em] text-white",
            compact ? "text-2xl" : "text-3xl sm:text-4xl",
          )}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
