import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { SocialProof } from "@/components/landing/social-proof";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { PersonalizationSection } from "@/components/landing/personalization-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { billingFrontendEnabled } from "@/lib/features";

import { FeaturedArticles, type FeaturedArticleItem } from "@/components/landing/featured-articles";

export const metadata: Metadata = {
  title: "Devlogia - Publish smarter. Grow faster.",
  description:
    "A modern CMS with AI writing, SEO, and analytics for creators and teams. MDX editor, personalized feeds, and marketplace extensions.",
  openGraph: {
    title: "Devlogia - Modern CMS with AI",
    description:
      "A modern CMS with AI writing, SEO, and analytics for creators and teams.",
    type: "website",
  },
};

export default async function LandingPage() {
  let featuredArticles: FeaturedArticleItem[] = [];

  try {
    const prismaModule = await import("@/lib/prisma");
    const { isDatabaseEnabled, prisma } = prismaModule;
    if (isDatabaseEnabled) {
      const posts = await prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          coverUrl: true,
          publishedAt: true,
          tags: { select: { tag: { select: { name: true, slug: true } } } },
        },
      });
      featuredArticles = posts;
    }
  } catch (error) {
    console.error("Failed to load featured landing articles", error);
  }

  return (
    <div className="space-y-24 pb-24">
      <HeroSection />
      {featuredArticles.length > 0 ? <FeaturedArticles articles={featuredArticles} /> : null}
      <SocialProof />
      <div id="features" className="scroll-mt-24">
        <FeaturesGrid />
      </div>
      <PersonalizationSection />
      <IntegrationsSection showBilling={billingFrontendEnabled} />
      {billingFrontendEnabled ? (
        <div id="pricing" className="scroll-mt-24">
          <PricingSection />
        </div>
      ) : null}
      <FAQSection />
      <FinalCTA />
    </div>
  );
}
