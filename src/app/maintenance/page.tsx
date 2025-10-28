import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Scheduled Maintenance</p>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">We&rsquo;ll be right back</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Devlogia is temporarily offline for maintenance. Editors can still access the admin console to monitor the
          rollout. Public endpoints will return shortly once the deployment is complete.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:bg-foreground/90"
          >
            Try again
          </Link>
          <a
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            href="mailto:ops@devlogia.app"
          >
            Contact operations
          </a>
        </div>
      </div>
    </div>
  );
}
