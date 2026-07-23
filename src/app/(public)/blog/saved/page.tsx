"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookmarkButton } from "@/components/blog/bookmark-button";
import { Button } from "@/components/ui/button";

export type SavedPostItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  tags: string[];
};

const LOCAL_STORAGE_KEY = "devlogia_saved_bookmarks";

export default function SavedArticlesPage() {
  const [savedPosts, setSavedPosts] = useState<SavedPostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedArticles() {
      try {
        // 1. Try server bookmarks first
        const response = await fetch("/api/bookmarks");
        if (response.ok) {
          const data = await response.json();
          if (isMounted && Array.isArray(data.bookmarks) && data.bookmarks.length > 0) {
            const items: SavedPostItem[] = data.bookmarks.map((b: { post: { id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; publishedAt: string | null; tags: Array<{ tag: { name: string } }> } }) => ({
              id: b.post.id,
              slug: b.post.slug,
              title: b.post.title,
              summary: b.post.summary,
              coverUrl: b.post.coverUrl,
              publishedAt: b.post.publishedAt,
              tags: b.post.tags ? b.post.tags.map((t) => t.tag.name) : [],
            }));
            setSavedPosts(items);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Continue to localStorage fallback
      }

      // 2. Fallback to localStorage saved IDs and query post details via search API
      try {
        const savedIds: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        if (savedIds.length > 0) {
          const searchRes = await fetch("/api/posts/search?q=");
          if (searchRes.ok) {
            const data = await searchRes.json();
            if (isMounted && Array.isArray(data.results)) {
              const matched = data.results.filter((p: SavedPostItem) => savedIds.includes(p.id));
              setSavedPosts(matched);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load local bookmarks", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSavedArticles();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <nav aria-label="Breadcrumb" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">Home</Link>
          </li>
          <li aria-hidden="true" className="text-border">/</li>
          <li>
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
          </li>
          <li aria-hidden="true" className="text-border">/</li>
          <li aria-current="page" className="text-foreground">Saved Articles</li>
        </ol>
      </nav>

      <header className="border-b border-border/70 pb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your Saved Reading List</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Articles and stories you&apos;ve bookmarked for later reading.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : savedPosts.length > 0 ? (
        <div className="space-y-4">
          {savedPosts.map((post) => (
            <div key={post.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Article"}</span>
                  {post.tags.length ? (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-primary">{post.tags[0]}</span>
                    </>
                  ) : null}
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:text-primary hover:no-underline">
                    {post.title}
                  </Link>
                </h2>
                {post.summary ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.summary}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3 sm:flex-shrink-0">
                <BookmarkButton postId={post.id} postTitle={post.title} />
                <Button asChild size="sm" variant="outline">
                  <Link href={`/blog/${post.slug}`}>Read Article →</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          <p className="text-base font-semibold text-foreground">No saved articles yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Click the &quot;📌 Save article&quot; button on any post to add it to your reading list.</p>
          <Button asChild className="mt-6" size="sm">
            <Link href="/blog">Browse Articles</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
