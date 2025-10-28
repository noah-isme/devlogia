"use client";

import { useEffect, useState } from "react";

import { ShareButtons } from "@/components/share-buttons";
import { usePostLayoutVariant } from "@/components/telemetry-provider";

const DEFAULT_VARIANT: Variant = "control";

type Variant = "control" | "immersion";

type PostShareSectionProps = {
  url: string;
  title: string;
};

export function PostShareSection({ url, title }: PostShareSectionProps) {
  const resolved = usePostLayoutVariant();
  const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);

  useEffect(() => {
    setVariant(resolved);
  }, [resolved]);

  const heading = variant === "immersion" ? "Enjoying this read? Share it forward" : "Share this post";
  const wrapperClassName =
    variant === "immersion"
      ? "not-prose mb-10 rounded-xl border border-border bg-muted/40 p-6"
      : "not-prose mb-8 space-y-3";

  return (
    <section className={wrapperClassName} aria-labelledby="share-post">
      <h2 id="share-post" className="text-lg font-semibold tracking-tight">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {variant === "immersion"
          ? "Readers in this cohort see social prompts earlier in the article. Let us know if it boosts engagement."
          : "Share Devlogia with your network to help other builders discover deep dives."}
      </p>
      <div className="mt-4">
        <ShareButtons url={url} title={title} />
      </div>
    </section>
  );
}
