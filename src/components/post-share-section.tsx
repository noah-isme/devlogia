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

  const heading =
    variant === "immersion"
      ? "Enjoying this read? Share it forward"
      : "Share this post";
  const wrapperClassName =
    variant === "immersion"
      ? "not-prose rounded-2xl border border-border/70 bg-muted/40 p-6"
      : "not-prose grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end";

  return (
    <section className={wrapperClassName} aria-labelledby="share-post">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Pass it forward
        </p>
        <h2
          id="share-post"
          className="text-xl font-semibold tracking-[-0.025em]"
        >
          {heading}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {variant === "immersion"
            ? "Readers in this cohort see social prompts earlier in the article. Let us know if it boosts engagement."
            : "Help another builder discover an idea that could improve their work."}
        </p>
      </div>
      <div>
        <ShareButtons url={url} title={title} />
      </div>
    </section>
  );
}
