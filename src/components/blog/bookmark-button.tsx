"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type BookmarkButtonProps = {
  readonly postId: string;
  readonly postTitle?: string;
  readonly className?: string;
};

const LOCAL_STORAGE_KEY = "devlogia_saved_bookmarks";

export function BookmarkButton({ postId, postTitle, className }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check local storage fallback first
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      if (saved.includes(postId)) {
        setIsBookmarked(true);
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Check server bookmarks if session exists
    async function checkServerBookmark() {
      try {
        const response = await fetch("/api/bookmarks");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.bookmarks)) {
            const isSavedOnServer = data.bookmarks.some(
              (b: { postId: string }) => b.postId === postId,
            );
            if (isSavedOnServer) {
              setIsBookmarked(true);
            }
          }
        }
      } catch {
        // Fallback silently to local state
      }
    }

    void checkServerBookmark();
  }, [postId]);

  async function handleToggleBookmark() {
    setIsLoading(true);
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    // Update local storage state
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      let updated: string[];
      if (nextState) {
        updated = Array.from(new Set([...saved, postId]));
      } else {
        updated = saved.filter((id) => id !== postId);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to update local bookmarks", error);
    }

    // Update server bookmarks if authenticated
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.bookmarked === "boolean") {
          setIsBookmarked(data.bookmarked);
        }
      }
    } catch (error) {
      console.error("Failed to sync bookmark with server", error);
    } finally {
      setIsLoading(false);
    }

    if (nextState) {
      toast.success("Saved to reading list!", {
        description: postTitle ? `"${postTitle}" is saved to your bookmarks.` : "Article saved.",
      });
    } else {
      toast.info("Removed from reading list.");
    }
  }

  return (
    <Button
      type="button"
      variant={isBookmarked ? "default" : "outline"}
      size="sm"
      disabled={isLoading}
      className={`h-8 rounded-full px-3 text-xs transition-colors ${className || ""}`}
      onClick={() => void handleToggleBookmark()}
      aria-label={isBookmarked ? "Remove from bookmarks" : "Save to bookmarks"}
    >
      <span className="mr-1.5">{isBookmarked ? "🔖" : "📌"}</span>
      <span>{isBookmarked ? "Saved" : "Save article"}</span>
    </Button>
  );
}
