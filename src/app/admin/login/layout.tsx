import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-foreground px-4 py-12 text-background">
      <div
        className="editorial-grid absolute inset-0 opacity-40"
        aria-hidden="true"
      />
      <div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-background/10 bg-background text-foreground shadow-2xl lg:grid-cols-[1fr_0.85fr]">
        <div className="hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-background font-bold text-foreground">
              D
            </span>
            <span className="text-lg font-semibold">Devlogia</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/50">
              Editorial workspace
            </p>
            <p className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em]">
              Your best work starts with a clear space.
            </p>
          </div>
        </div>
        <main className="p-7 sm:p-12">{children}</main>
      </div>
    </div>
  );
}
