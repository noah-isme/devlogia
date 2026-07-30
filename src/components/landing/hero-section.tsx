"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const previews = [
  {
    value: "editor",
    label: "Editor",
    src: "/landing/hero-editor.png",
    alt: "Devlogia MDX editor with live preview",
    width: 1280,
    height: 1200,
    bullets: [
      "MDX + live preview with real-time rendering",
      "Autosave and versioning for every change",
      "Blocks and embeds for interactive content",
    ],
  },
  {
    value: "ai",
    label: "AI Assist",
    src: "/landing/hero-ai.png",
    alt: "Devlogia product workspace with writing and publishing tools",
    width: 1280,
    height: 1100,
    bullets: [
      "Tone adjustment and outline generation",
      "Headline ideas with A/B testing",
      "SEO suggestions and keyword optimization",
    ],
  },
  {
    value: "analytics",
    label: "Analytics",
    src: "/landing/hero-analytics.png",
    alt: "Devlogia admin analytics dashboard",
    width: 1280,
    height: 871,
    bullets: [
      "Reading heatmap and engagement metrics",
      "Conversion tracking for every CTA",
      "Personalized feed based on reader behavior",
    ],
  },
] as const;

export function HeroSection() {
  const [activeTab, setActiveTab] = useState<string>("editor");
  const activePreview = previews.find((p) => p.value === activeTab) || previews[0];

  return (
    <section className="space-y-12 pt-4">
      <ScrollReveal direction="up" delay={0} duration={700}>
        <div className="space-y-6 text-center">
          {/* Announcement pill badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:border-primary/40 hover:bg-primary/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            <span>Next-Gen CMS with AI & Analytics</span>
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-balance">
            <span className="animated-gradient-text">Publish smarter.</span>{" "}
            <span>Grow faster.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed text-balance">
            A modern CMS with AI writing assistance, automated SEO, and reader engagement analytics for creators and teams.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-2">
            <Button asChild size="lg" className="min-w-[150px] btn-interactive shadow-md shadow-primary/20">
              <Link href="/blog" className="gap-2">
                Explore Articles
                <svg
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[150px] btn-interactive">
              <Link href="/admin/login">Start Writing</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="min-w-[140px] btn-interactive">
              <Link href="/developers">API Docs</Link>
            </Button>
          </div>
        </div>
      </ScrollReveal>

      {/* Product Preview Tabs with Sliding Tab Indicator */}
      <ScrollReveal direction="up" delay={200} duration={750}>
        <div className="w-full space-y-6">
          <div
            className="relative mx-auto grid w-full max-w-md grid-cols-3 rounded-xl border border-border bg-muted/60 p-1 shadow-inner"
            role="tablist"
            aria-label="Product preview tabs"
          >
            {previews.map((preview) => {
              const isActive = activeTab === preview.value;
              return (
                <button
                  key={preview.value}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(preview.value)}
                  className={`relative z-10 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? "text-foreground shadow-sm bg-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preview.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-gradient-to-b from-card/80 to-muted/30 p-4 sm:p-8 shadow-xl transition-all duration-300 hover:border-primary/30">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-background shadow-md group">
              <Image
                key={activePreview.value}
                src={activePreview.src}
                alt={activePreview.alt}
                width={activePreview.width}
                height={activePreview.height}
                className="h-full w-full object-cover object-top transition-all duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 960px"
                priority={activePreview.value === "editor"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            </div>

            <ul className="grid gap-2 sm:grid-cols-3 pt-2 text-sm text-muted-foreground">
              {activePreview.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2.5 rounded-lg border border-transparent p-2 transition-all duration-200 hover:border-border hover:bg-muted/50"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold transition-transform duration-300 hover:scale-110" aria-hidden="true">
                    ✓
                  </span>
                  <span className="leading-tight">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
