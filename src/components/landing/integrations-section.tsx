import { ScrollReveal } from "@/components/ui/scroll-reveal";

const integrations = [
  { name: "Stripe", logo: "💳" },
  { name: "Supabase", logo: "⚡" },
  { name: "S3/R2", logo: "📦" },
  { name: "NextAuth", logo: "🔐" },
  { name: "PostHog", logo: "📊" },
  { name: "Sentry", logo: "🐛" },
  { name: "Algolia", logo: "🔍" },
];

type IntegrationsSectionProps = {
  showBilling?: boolean;
};

export function IntegrationsSection({
  showBilling = false,
}: IntegrationsSectionProps) {
  const visibleIntegrations = showBilling
    ? integrations
    : integrations.filter((integration) => integration.name !== "Stripe");

  return (
    <section className="py-16 space-y-8">
      <ScrollReveal direction="up">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Connects to your stack
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Ready-made integrations with the tools developers and marketers already use.
          </p>
        </div>
      </ScrollReveal>

      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        {visibleIntegrations.map((integration, index) => (
          <ScrollReveal key={integration.name} direction="up" staggerIndex={index}>
            <div className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card px-6 py-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md hover:bg-muted/40 cursor-default">
              <span className="text-2xl transition-transform duration-300 group-hover:scale-125">
                {integration.logo}
              </span>
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                {integration.name}
              </span>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
