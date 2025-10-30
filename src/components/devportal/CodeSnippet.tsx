"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CodeTab = {
  id: string;
  label: string;
  language: string;
  code: string;
};

type CodeSnippetProps = {
  title?: string;
  tabs: CodeTab[];
};

export function CodeSnippet({ title, tabs }: CodeSnippetProps) {
  const availableTabs = useMemo(() => (tabs.length ? tabs : [{ id: "text", label: "Code", language: "text", code: "" }]), [tabs]);
  const [activeTab, setActiveTab] = useState(() => availableTabs[0]?.id ?? "text");
  const selected = availableTabs.find((tab) => tab.id === activeTab) ?? availableTabs[0];
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code snippet", error);
    }
  }

  return (
    <div className="not-prose overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2">
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {title ?? selected?.label ?? "Code"}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-col gap-0">
        {availableTabs.length > 1 ? (
          <div className="flex flex-wrap gap-2 border-b border-border bg-muted/40 px-4 py-2 text-sm">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1 transition",
                  tab.id === (selected?.id ?? activeTab)
                    ? "bg-primary/10 text-primary font-medium"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        <pre className="relative overflow-x-auto bg-muted/50 p-4 text-sm" data-language={selected?.language}>
          <code>{selected?.code ?? ""}</code>
        </pre>
      </div>
    </div>
  );
}
