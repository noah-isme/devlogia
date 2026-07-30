"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const ANNUAL_DISCOUNT = 0.2;

type BillingPeriod = "monthly" | "annual";

type Plan = {
  name: string;
  monthlyPrice: number | null;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    description: "Perfect for getting started",
    features: [
      "1 workspace",
      "AI basic (1,000 tokens/month)",
      "Custom domain (paid add-on)",
      "10 published posts",
      "Community support",
    ],
    cta: "Start free",
    href: "/admin/login",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: 19,
    description: "For serious creators",
    features: [
      "Everything in Free",
      "AI advanced (50,000 tokens/month)",
      "Analytics pro & heatmaps",
      "Unlimited posts",
      "Priority support",
      "Custom integrations",
    ],
    cta: "Try Pro",
    href: "/admin/login?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: null,
    description: "For teams & organisations",
    features: [
      "Everything in Pro",
      "SSO & advanced security",
      "SLA & dedicated support",
      "Custom AI quota",
      "White-label options",
      "On-premise deployment",
    ],
    cta: "Contact sales",
    href: "/subscribe",
    popular: false,
  },
];

function formatPrice(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function priceFor(plan: Plan, period: BillingPeriod) {
  if (plan.monthlyPrice === null) {
    return { amount: "Custom", period: "", note: null };
  }

  if (period === "monthly" || plan.monthlyPrice === 0) {
    return { amount: formatPrice(plan.monthlyPrice), period: "/month", note: null };
  }

  const discountedMonthly = plan.monthlyPrice * (1 - ANNUAL_DISCOUNT);
  return {
    amount: formatPrice(discountedMonthly),
    period: "/month",
    note: `${formatPrice(discountedMonthly * 12)} billed annually`,
  };
}

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const savingLabel = `Save ${Math.round(ANNUAL_DISCOUNT * 100)}%`;

  return (
    <section className="py-16 space-y-8">
      <ScrollReveal direction="up">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Transparent pricing
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Start free and upgrade whenever you are ready. No hidden fees.
          </p>

          <div
            role="group"
            aria-label="Billing period"
            className="relative inline-flex items-center rounded-xl border border-border bg-muted/80 p-1 shadow-inner"
          >
            <button
              type="button"
              aria-pressed={billingPeriod === "monthly"}
              onClick={() => setBillingPeriod("monthly")}
              className={`relative z-10 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                billingPeriod === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={billingPeriod === "annual"}
              onClick={() => setBillingPeriod("annual")}
              className={`relative z-10 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                billingPeriod === "annual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary animate-pulse-subtle">
                {savingLabel}
              </span>
            </button>
          </div>
        </div>
      </ScrollReveal>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const price = priceFor(plan, billingPeriod);

          return (
            <ScrollReveal key={plan.name} direction="up" staggerIndex={index}>
              <Card
                className={`group interactive-card relative h-full flex flex-col justify-between overflow-hidden border ${
                  plan.popular
                    ? "border-primary shadow-xl ring-2 ring-primary/20 bg-card"
                    : "border-border/80 bg-card hover:border-primary/40"
                }`}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground text-center text-xs font-bold uppercase tracking-wider py-1.5">
                    ★ Most Popular Choice
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4 transition-all duration-300">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight transition-all duration-300">
                        {price.amount}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">
                        {price.period}
                      </span>
                    </div>
                    <p className="mt-1 h-4 text-xs text-muted-foreground font-medium">
                      {price.note}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2.5 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className="text-primary mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold" aria-hidden="true">
                          ✓
                        </span>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-6">
                  <Button
                    asChild
                    className={`w-full btn-interactive ${
                      plan.popular ? "shadow-md shadow-primary/25" : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
