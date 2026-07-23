"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AdminCommentItem = {
  id: string;
  postId: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  content: string;
  status: "APPROVED" | "PENDING" | "SPAM";
  createdAt: string;
  post: {
    title: string;
    slug: string;
  };
};

type CommentsManagerProps = {
  initialComments: AdminCommentItem[];
};

export function CommentsManager({ initialComments }: CommentsManagerProps) {
  const [comments, setComments] = useState<AdminCommentItem[]>(initialComments);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "APPROVED" | "PENDING" | "SPAM">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      const matchesStatus = statusFilter === "ALL" || comment.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        comment.authorName.toLowerCase().includes(query) ||
        comment.authorEmail.toLowerCase().includes(query) ||
        comment.content.toLowerCase().includes(query) ||
        comment.post.title.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [comments, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      ALL: comments.length,
      PENDING: comments.filter((c) => c.status === "PENDING").length,
      APPROVED: comments.filter((c) => c.status === "APPROVED").length,
      SPAM: comments.filter((c) => c.status === "SPAM").length,
    };
  }, [comments]);

  async function handleUpdateStatus(commentId: string, newStatus: "APPROVED" | "PENDING" | "SPAM") {
    setUpdatingId(commentId);
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, status: newStatus } : c)),
      );
      toast.success(`Comment status updated to ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Unable to update comment status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setUpdatingId(commentId);
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete comment");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "PENDING", "APPROVED", "SPAM"] as const).map((status) => {
            const isActive = statusFilter === status;
            const count = counts[status];
            return (
              <Button
                key={status}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setStatusFilter(status)}
              >
                {status.toLowerCase()}
                <span className="ml-1.5 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search author, email, post..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Comment List */}
      <div className="space-y-3">
        {filteredComments.length > 0 ? (
          filteredComments.map((comment) => {
            const isProcessing = updatingId === comment.id;
            return (
              <div
                key={comment.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-2 text-xs">
                  {/* Author & Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{comment.authorName}</span>
                    <span className="text-muted-foreground">({comment.authorEmail})</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                    <Badge
                      variant={
                        comment.status === "APPROVED"
                          ? "success"
                          : comment.status === "PENDING"
                            ? "warning"
                            : "info"
                      }
                      className="text-[10px]"
                    >
                      {comment.status}
                    </Badge>
                  </div>

                  {/* Post reference */}
                  <div className="text-muted-foreground">
                    On article:{" "}
                    <Link
                      href={`/blog/${comment.post.slug}`}
                      target="_blank"
                      className="font-medium text-foreground hover:underline"
                    >
                      {comment.post.title}
                    </Link>
                  </div>

                  {/* Content body */}
                  <p className="whitespace-pre-wrap rounded-md border border-border/50 bg-muted/20 p-3 text-foreground/90">
                    {comment.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  {comment.status !== "APPROVED" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      disabled={isProcessing}
                      onClick={() => void handleUpdateStatus(comment.id, "APPROVED")}
                    >
                      Approve
                    </Button>
                  ) : null}

                  {comment.status !== "SPAM" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                      disabled={isProcessing}
                      onClick={() => void handleUpdateStatus(comment.id, "SPAM")}
                    >
                      Mark Spam
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={isProcessing}
                    onClick={() => void handleDelete(comment.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
            No comments found matching the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
