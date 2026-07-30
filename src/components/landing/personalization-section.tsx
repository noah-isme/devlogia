"use client";

import { useState } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const demoRecommendations = [
  {
    topic: "AI & Engineering",
    title: "Building LLM Agents in Next.js 16",
    matchScore: "98% Match",
    reads: "4.2k readers",
    tag: "Trending Now",
  },
  {
    topic: "Productivity",
    title: "How We Optimized MDX Build Times by 80%",
    matchScore: "95% Match",
    reads: "3.1k readers",
    tag: "High Engagement",
  },
  {
    topic: "Architecture",
    title: "Multi-Tenant Database Design Patterns",
    matchScore: "91% Match",
    reads: "5.8k readers",
    tag: "Recommended for You",
  },
];

export function PersonalizationSection() {
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const currentDemo = demoRecommendations[activeTopicIndex];

  return (
    <section className="py-16">
      <ScrollReveal direction="up">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-muted/40 p-8 md:p-12 shadow-xl transition-all duration-300 hover:border-primary/30">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                ✨ Dynamic Feed Engine
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
                A feed that adapts to your audience
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Recommendations drawn from reader profiles, topics, and content
                performance, so every visitor lands on something relevant.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "Learning algorithms driven by reader behaviour",
                  "Automatic A/B testing for headlines and CTAs",
                  "Audience segments based on interest and engagement",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold" aria-hidden="true">
                      ✓
                    </span>
                    <span className="font-medium text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Demo Box */}
            <div className="space-y-4 rounded-xl border border-border/80 bg-background/80 p-6 shadow-md backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Live Personalization Demo
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {currentDemo.matchScore}
                </span>
              </div>

              {/* Topic Selector Tabs */}
              <div className="flex gap-2">
                {demoRecommendations.map((item, idx) => (
                  <button
                    key={item.topic}
                    type="button"
                    onClick={() => setActiveTopicIndex(idx)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      activeTopicIndex === idx
                        ? "bg-primary text-primary-foreground shadow-sm scale-105"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {item.topic}
                  </button>
                ))}
              </div>

              {/* Animated Article Card Preview */}
              <div className="rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:border-primary/40 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-primary">{currentDemo.tag}</span>
                  <span className="text-muted-foreground">{currentDemo.reads}</span>
                </div>
                <h4 className="text-base font-bold text-foreground">
                  {currentDemo.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Tailored content delivered based on reader affinity and past engagement metrics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
