"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ShareButtonsProps = {
  url: string;
  title: string;
};

function openPopup(url: string) {
  const width = 600;
  const height = 540;
  const left = typeof window !== "undefined" ? window.screenX + (window.outerWidth - width) / 2 : 0;
  const top = typeof window !== "undefined" ? window.screenY + (window.outerHeight - height) / 2 : 0;
  window.open(url, "_blank", `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`);
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareTargets = useMemo(() => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    return {
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
  }, [title, url]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link", error);
      setCopied(false);
    }
  }, [url]);

  return (
    <div className="flex flex-wrap gap-3" aria-label="Share this article">
      <Button type="button" variant="outline" onClick={handleCopy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => openPopup(shareTargets.x)}
        aria-label="Share on X"
      >
        X / Twitter
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => openPopup(shareTargets.linkedin)}
        aria-label="Share on LinkedIn"
      >
        LinkedIn
      </Button>
    </div>
  );
}
