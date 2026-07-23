"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export type AdminPostListProps = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "SCHEDULED";
  updatedAt: string;
  tags: Array<{ tag: { id: string; name: string } }>;
};

type BulkPostManagerProps = {
  posts: AdminPostListProps[];
};

export function BulkPostManager({ posts: initialPosts }: BulkPostManagerProps) {
  const [posts, setPosts] = useState<AdminPostListProps[]>(initialPosts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const isAllSelected = posts.length > 0 && selectedIds.length === posts.length;

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(posts.map((p) => p.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function handleBulkAction(action: "publish" | "draft" | "delete") {
    if (selectedIds.length === 0) return;

    if (action === "delete" && !confirm(`Are you sure you want to delete ${selectedIds.length} post(s)?`)) {
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch("/api/admin/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postIds: selectedIds }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to execute action");
      }

      const data = await response.json();
      const count = data.count || selectedIds.length;

      if (action === "delete") {
        setPosts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
        toast.success(`Successfully deleted ${count} post(s).`);
      } else {
        const newStatus = action === "publish" ? "PUBLISHED" : "DRAFT";
        setPosts((prev) =>
          prev.map((p) => (selectedIds.includes(p.id) ? { ...p, status: newStatus } : p)),
        );
        toast.success(`Successfully updated ${count} post(s) to ${newStatus}.`);
      }

      setSelectedIds([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Bulk action failed";
      console.error(error);
      toast.error(msg);
    } finally {
      setIsExecuting(false);
    }
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No posts found. Create one to start publishing.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Select All & Action Header */}
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-border"
          />
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </label>
        {selectedIds.length > 0 ? (
          <span className="font-semibold text-foreground">
            {selectedIds.length} post(s) selected
          </span>
        ) : null}
      </div>

      {/* Post Items */}
      <ul className="space-y-3">
        {posts.map((post) => {
          const isSelected = selectedIds.includes(post.id);
          return (
            <li
              key={post.id}
              className={`rounded-lg border p-4 shadow-sm transition ${
                isSelected ? "border-primary bg-primary/5" : "border-border bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(post.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="space-y-1">
                    <Link href={`/admin/posts/${post.id}`} className="text-lg font-semibold hover:underline">
                      {post.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">/{post.slug}</p>
                    {post.summary ? <p className="text-sm text-muted-foreground">{post.summary}</p> : null}
                    <p className="text-xs text-muted-foreground">Updated {formatDate(new Date(post.updatedAt))}</p>
                    {post.tags.length ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {post.tags.map(({ tag }) => (
                          <Badge key={tag.id} variant="info">
                            #{tag.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <Badge
                  variant={
                    post.status === "PUBLISHED"
                      ? "success"
                      : post.status === "SCHEDULED"
                        ? "warning"
                        : "default"
                  }
                >
                  {post.status}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 ? (
        <div className="sticky bottom-6 z-40 flex items-center justify-between gap-3 rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-foreground">
            {selectedIds.length} item(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={isExecuting}
              onClick={() => void handleBulkAction("publish")}
            >
              Bulk Publish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isExecuting}
              onClick={() => void handleBulkAction("draft")}
            >
              Bulk Draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isExecuting}
              onClick={() => void handleBulkAction("delete")}
            >
              Bulk Delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
