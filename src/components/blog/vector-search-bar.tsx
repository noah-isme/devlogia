"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type SearchResultItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  tags: string[];
  score: number;
  matchType: string[];
};

export function VectorSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const handler = setTimeout(() => {
      async function executeSearch() {
        try {
          const response = await fetch(`/api/posts/search?q=${encodeURIComponent(trimmed)}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.results)) {
              setResults(data.results);
            }
          }
        } catch (error) {
          console.error("Vector search failed", error);
        } finally {
          setIsSearching(false);
        }
      }

      void executeSearch();
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <Input
          type="search"
          placeholder="Search articles with vector & topic matching..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          className="h-11 rounded-full border-border bg-background px-4 pr-10 text-sm shadow-sm transition hover:border-primary focus:border-primary"
        />
        <div className="absolute right-3.5 flex items-center gap-1.5 text-muted-foreground">
          {isSearching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <span className="text-xs font-semibold">⚡ Vector</span>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim() ? (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-2xl border border-border bg-popover p-3 shadow-xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Semantic Results ({results.length})</span>
            <span>Powered by Content Vectors</span>
          </div>

          {results.length > 0 ? (
            <ul className="space-y-2">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/blog/${item.slug}`}
                    className="block rounded-xl border border-transparent p-3 text-xs transition hover:border-border hover:bg-accent hover:no-underline"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-foreground text-sm leading-snug">{item.title}</span>
                      <div className="flex items-center gap-1">
                        {item.matchType.map((match) => (
                          <Badge
                            key={match}
                            variant={match === "Vector Match" ? "info" : "default"}
                            className="text-[9px] px-1.5 py-0.2"
                          >
                            {match}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {item.summary ? (
                      <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">{item.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : !isSearching ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No matching articles found for &quot;{query}&quot;. Try searching for another topic.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
