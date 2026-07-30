import { ScrollReveal } from "@/components/ui/scroll-reveal";

const badges = [
  { name: "CMS Blog", icon: "✍️" },
  { name: "MDX Editor", icon: "⚡" },
  { name: "RBAC Admin", icon: "🛡️" },
  { name: "SEO Feeds", icon: "🚀" },
];

export function SocialProof() {
  return (
    <section className="py-8">
      <ScrollReveal direction="up" delay={100}>
        <div className="text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Built for release-ready publishing teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            {badges.map((badge, index) => (
              <div
                key={badge.name}
                className="group flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:border-primary/40 hover:bg-card hover:text-foreground hover:shadow-sm hover:-translate-y-0.5"
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <span className="transition-transform duration-300 group-hover:scale-125">
                  {badge.icon}
                </span>
                <span>{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
