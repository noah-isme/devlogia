"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CommentItem = {
  id: string;
  postId: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
};

type CommentSectionProps = {
  readonly postId: string;
};

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadComments() {
      try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted && Array.isArray(data.comments)) {
            setComments(data.comments);
          }
        }
      } catch (error) {
        console.error("Failed to load comments", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!authorName.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    if (!authorEmail.trim() || !authorEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!content.trim()) {
      toast.error("Please write a comment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim(),
          content: content.trim(),
          parentId: replyToId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to post comment");
      }

      const data = await response.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setContent("");
        setReplyToId(null);
        toast.success("Comment published!", { description: "Thank you for sharing your thoughts." });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to post comment";
      console.error(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Organize comments into top-level and replies
  const topLevelComments = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);
  const replyingToComment = replyToId ? comments.find((c) => c.id === replyToId) : null;

  return (
    <section aria-label="Comments & Discussion" className="my-12 space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Discussion ({comments.length})</h2>
          <p className="text-xs text-muted-foreground">Join the conversation or ask questions about this post.</p>
        </div>
      </div>

      {/* New Comment Form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {replyingToComment ? `Replying to ${replyingToComment.authorName}` : "Leave a comment"}
          </h3>
          {replyingToComment ? (
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setReplyToId(null)}>
              Cancel reply
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="comment-author-name" className="text-xs">
              Your Name *
            </Label>
            <Input
              id="comment-author-name"
              placeholder="e.g. Alex Morgan"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment-author-email" className="text-xs">
              Your Email * (kept private)
            </Label>
            <Input
              id="comment-author-email"
              type="email"
              placeholder="alex@example.com"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="comment-content" className="text-xs">
            Comment *
          </Label>
          <Textarea
            id="comment-content"
            placeholder="Share your thoughts or questions..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] text-xs"
            required
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : replyToId ? "Post Reply" : "Post Comment"}
          </Button>
        </div>
      </form>

      {/* Comment List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : topLevelComments.length > 0 ? (
          <ul className="space-y-4">
            {topLevelComments.map((comment) => {
              const replies = getReplies(comment.id);
              return (
                <li key={comment.id} className="space-y-3 rounded-lg border border-border bg-background p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{comment.authorName}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyToId(comment.id)}
                    >
                      Reply
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{comment.content}</p>

                  {/* Nested Replies */}
                  {replies.length > 0 ? (
                    <ul className="ml-4 space-y-3 border-l-2 border-border pl-4 pt-2">
                      {replies.map((reply) => (
                        <li key={reply.id} className="space-y-1 rounded-md bg-muted/30 p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{reply.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(reply.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-foreground/90">{reply.content}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No comments yet. Be the first to start the discussion!
          </div>
        )}
      </div>
    </section>
  );
}
