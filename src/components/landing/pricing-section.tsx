"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/bulan",
    description: "Sempurna untuk memulai",
    features: [
      "1 workspace",
      "AI basic (1000 tokens/bulan)",
      "Custom domain (add-on)",
      "10 posts published",
      "Community support",
    ],
    cta: "Mulai Gratis",
    href: "/admin/login",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/bulan",
    description: "Untuk kreator serius",
    features: [
      "Semua fitur Free",
      "AI advanced (50k tokens/bulan)",
      "Analytics pro & heatmaps",
      "Unlimited posts",
      "Priority support",
      "Custom integrations",
    ],
    cta: "Coba Pro",
    href: "/admin/login?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Untuk tim & organisasi",
    features: [
      "Semua fitur Pro",
      "SSO & advanced security",
      "SLA & dedicated support",
      "Custom AI quota",
      "White-label options",
      "On-premise deployment",
    ],
    cta: "Kontak Sales",
    href: "/subscribe",
    popular: false,
  },
];

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  return (
    <section className="py-16 space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Harga yang transparan
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Mulai gratis, upgrade kapan saja. Tanpa biaya tersembunyi.
        </p>
        <div className="inline-flex items-center rounded-lg border border-border bg-muted p-1">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              billingPeriod === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setBillingPeriod("annual")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              billingPeriod === "annual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tahunan
            <span className="ml-1.5 text-xs text-primary">Save 20%</span>
          </button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.popular ? "border-primary shadow-lg" : ""}
          >
            {plan.popular && (
              <div className="bg-primary text-primary-foreground text-center text-sm font-medium py-1 rounded-t-2xl">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant={plan.popular ? "default" : "outline"}>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
