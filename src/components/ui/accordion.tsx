"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openItems: Set<string>;
  toggleItem: (id: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within Accordion");
  }
  return context;
}

type AccordionProps = {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: string[];
};

export function Accordion({ children, className, defaultOpen = [] }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set(defaultOpen));

  const toggleItem = React.useCallback((id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

type AccordionItemProps = {
  id: string;
  children: React.ReactNode;
  className?: string;
};

export function AccordionItem({ id, children, className }: AccordionItemProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card", className)} data-accordion-item={id}>
      {children}
    </div>
  );
}

type AccordionTriggerProps = {
  id: string;
  children: React.ReactNode;
  className?: string;
};

export function AccordionTrigger({ id, children, className }: AccordionTriggerProps) {
  const { openItems, toggleItem } = useAccordion();
  const isOpen = openItems.has(id);

  return (
    <button
      type="button"
      onClick={() => toggleItem(id)}
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${id}`}
      id={`accordion-trigger-${id}`}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-left font-medium transition-colors hover:bg-muted/50",
        className
      )}
    >
      {children}
      <svg
        className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

type AccordionContentProps = {
  id: string;
  children: React.ReactNode;
  className?: string;
};

export function AccordionContent({ id, children, className }: AccordionContentProps) {
  const { openItems } = useAccordion();
  const isOpen = openItems.has(id);

  return (
    <div
      id={`accordion-content-${id}`}
      role="region"
      aria-labelledby={`accordion-trigger-${id}`}
      className={cn(
        "overflow-hidden transition-all",
        isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
      )}
    >
      <div className={cn("px-4 pb-3 pt-1 text-sm text-muted-foreground", className)}>{children}</div>
    </div>
  );
}
