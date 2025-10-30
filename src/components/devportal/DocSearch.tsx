"use client";

import "@docsearch/css";

import type { DocSearchProps } from "@docsearch/react";
import { DocSearch } from "@docsearch/react";
import { useMemo } from "react";

type DeveloperDocSearchProps = {
  appId?: string;
  apiKey?: string;
  indexName?: string;
};

export function DeveloperDocSearch({ appId, apiKey, indexName }: DeveloperDocSearchProps) {
  const props = useMemo<DocSearchProps | null>(() => {
    if (!appId || !apiKey || !indexName) {
      return null;
    }

    return {
      appId,
      apiKey,
      indexName,
      placeholder: "Search docs…",
      translations: {
        button: {
          buttonText: "Search",
          buttonAriaLabel: "Search documentation",
        },
      },
    } satisfies DocSearchProps;
  }, [appId, apiKey, indexName]);

  if (!props) {
    return (
      <input
        type="search"
        placeholder="Configure DocSearch credentials"
        className="w-full rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
        disabled
      />
    );
  }

  return (
    <div className="docsearch">
      <DocSearch {...props} />
    </div>
  );
}
