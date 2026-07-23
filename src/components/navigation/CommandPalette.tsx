"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResultItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  matchType: string[];
};

type QuickNavItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  category: "Navigation" | "Admin";
};

const QUICK_NAVS: QuickNavItem[] = [
  { id: "nav-home", title: "Home", description: "Main landing page and features", href: "/", icon: "🏠", category: "Navigation" },
  { id: "nav-blog", title: "Journal / Blog", description: "Explore latest technical articles", href: "/blog", icon: "📖", category: "Navigation" },
  { id: "nav-saved", title: "Saved Reading List", description: "View your bookmarked articles", href: "/blog/saved", icon: "🔖", category: "Navigation" },
  { id: "nav-docs", title: "Developer Docs", description: "API documentation & SDK guides", href: "/developers", icon: "📚", category: "Navigation" },
  { id: "admin-posts", title: "Manage Posts", description: "Admin post editor & status manager", href: "/admin/posts", icon: "✍️", category: "Admin" },
  { id: "admin-analytics", title: "Analytics & Telemetry", description: "Real-time traffic and reader engagement", href: "/admin/analytics", icon: "📊", category: "Admin" },
  { id: "admin-settings", title: "AI & System Settings", description: "Privacy preferences & data backup export", href: "/admin/settings", icon: "⚙️", category: "Admin" },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const togglePalette = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setQuery("");
        setResults([]);
        setSelectedIndex(0);
      }
      return next;
    });
  }, []);

  // Global keydown handler for Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePalette();
      } else if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    function handleOpenEvent() {
      setIsOpen(true);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, [isOpen, togglePalette]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search fetch
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/posts/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return (data.results ?? []) as SearchResultItem[];
        })
        .then((items) => {
          setResults(items);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Unified items list for keyboard selection
  const activeItems = query.trim()
    ? results.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.summary || `Tags: ${r.tags.join(", ") || "General"}`,
        href: `/blog/${r.slug}`,
        icon: "📄",
        badge: r.matchType[0] || "Article",
      }))
    : QUICK_NAVS.map((nav) => ({
        id: nav.id,
        title: nav.title,
        description: nav.description,
        href: nav.href,
        icon: nav.icon,
        badge: nav.category,
      }));

  const handleSelect = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, activeItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + activeItems.length) % Math.max(1, activeItems.length));
    } else if (e.key === "Enter" && activeItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(activeItems[selectedIndex].href);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop overlay listener */}
      <div className="fixed inset-0" onClick={() => setIsOpen(false)} aria-hidden="true" />

      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl dark:bg-background/90"
        onKeyDown={handleListKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border/60 px-5 py-4">
          <span className="mr-3 text-lg text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-base font-medium placeholder:text-muted-foreground/60 focus:outline-none"
            placeholder="Type a command or search articles, tags, docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading ? (
            <span className="mr-3 text-xs text-primary animate-pulse font-medium">Searching…</span>
          ) : null}
          <kbd className="rounded-lg border border-border/80 bg-muted/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {query.trim() ? `Search Results (${activeItems.length})` : "Quick Actions & Navigation"}
          </div>

          {activeItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No matching articles found for &quot;{query}&quot;
            </div>
          ) : (
            <ul className="space-y-1">
              {activeItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                        isSelected
                          ? "bg-primary/10 text-foreground dark:bg-primary/20"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-xl shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{item.description}</p>
                        </div>
                      </div>
                      <span className="ml-3 shrink-0 rounded-full bg-muted/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                        {item.badge}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] shadow-sm">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] shadow-sm">↵</kbd> select
            </span>
          </div>
          <span>Devlogia Instant Search</span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger() {
  const trigger = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <button
      type="button"
      onClick={trigger}
      className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      aria-label="Open command search palette"
    >
      <span className="text-sm">🔍</span>
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden rounded-md border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground group-hover:text-foreground sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
