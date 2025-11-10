import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { SocialProof } from "@/components/landing/social-proof";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { PersonalizationSection } from "@/components/landing/personalization-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";

export const metadata: Metadata = {
  title: "Devlogia - Publish smarter. Grow faster.",
  description: "CMS modern dengan AI writing, SEO, dan analytics untuk kreator & tim. MDX editor, personalized feeds, dan marketplace extensions.",
  openGraph: {
    title: "Devlogia - Modern CMS with AI",
    description: "CMS modern dengan AI writing, SEO, dan analytics untuk kreator & tim.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="space-y-24 pb-24">
      <HeroSection />
      <SocialProof />
      <div id="features">
        <FeaturesGrid />
      </div>
      <PersonalizationSection />
      <IntegrationsSection />
      <div id="pricing">
        <PricingSection />
      </div>
      <FAQSection />
      <FinalCTA />
    </div>
  );
}
