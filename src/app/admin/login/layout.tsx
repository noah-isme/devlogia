import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
