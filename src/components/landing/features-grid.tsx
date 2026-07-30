import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const features = [
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "AI Writer",
    description: "Draft, refine, and publish with guardrails and a full audit trail.",
  },
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "SEO Suite",
    description: "Automatic schema, Open Graph, JSON-LD, and sitemaps.",
  },
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: "MDX Editor",
    description: "Live React components inside your content.",
  },
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Analytics",
    description: "Engagement, feed, and revenue insights in one view.",
  },
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: "Marketplace",
    description: "Ready-made plugins and AI extensions.",
  },
  {
    icon: (
      <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Multi-tenant",
    description: "Teams and brands under one roof.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-16 space-y-8">
      <ScrollReveal direction="up">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to publish
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            A complete platform for writing, shipping, and growing quality content.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <ScrollReveal key={feature.title} direction="up" staggerIndex={index}>
            <Card className="group interactive-card border-border/80 bg-card hover:border-primary/40 h-full">
              <CardHeader>
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground shadow-sm">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors duration-200">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground/90">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
