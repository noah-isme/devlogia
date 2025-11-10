const integrations = [
  { name: "Stripe", logo: "💳" },
  { name: "Supabase", logo: "⚡" },
  { name: "S3/R2", logo: "📦" },
  { name: "NextAuth", logo: "🔐" },
  { name: "PostHog", logo: "📊" },
  { name: "Sentry", logo: "🐛" },
  { name: "Algolia", logo: "🔍" },
];

export function IntegrationsSection() {
  return (
    <section className="py-16 space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Terhubung dengan stack Anda
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Integrasi siap pakai dengan tools favorit developer dan marketer.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4 shadow-sm transition hover:shadow-md"
          >
            <span className="text-2xl">{integration.logo}</span>
            <span className="font-medium">{integration.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
