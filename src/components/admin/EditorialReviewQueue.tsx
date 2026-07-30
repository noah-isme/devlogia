"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ReviewPost = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "SCHEDULED";
  updatedAt: string;
  author?: {
    id: string;
    email: string;
  } | null;
  tags?: Array<{ tag: { id: string; name: string } }>;
};

type EditorialReviewQueueProps = {
  initialPosts: ReviewPost[];
  currentUserRole: string;
};

export function EditorialReviewQueue({ initialPosts, currentUserRole }: EditorialReviewQueueProps) {
  const [posts, setPosts] = useState<ReviewPost[]>(initialPosts);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [activeFeedbackPostId, setActiveFeedbackPostId] = useState<string | null>(null);
  const [aiReviewByPostId, setAiReviewByPostId] = useState<Record<string, string>>({});
  const [aiReviewingId, setAiReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const canRequestAiReview = currentUserRole === "admin" || currentUserRole === "superadmin";

  const filteredPosts = posts.filter((post) => {
    if (activeTab === "all") return true;
    return post.status === activeTab;
  });

  async function handleReviewAction(postId: string, action: "submit" | "request_changes" | "approve" | "publish") {
    setProcessingId(postId);
    setMessage(null);

    const feedback = feedbackInput[postId] || undefined;

    try {
      const response = await fetch(`/api/admin/posts/${postId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      // Update local state with updated post status
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status: data.post.status } : p)),
      );

      setMessage({ type: "success", text: data.message || "Status updated successfully" });
      setActiveFeedbackPostId(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: (err as Error).message || "Failed to update review status" });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAiReview(postId: string) {
    setAiReviewingId(postId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/posts/${postId}/ai-review`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { review?: string; error?: string };
      if (!response.ok || !data.review) {
        throw new Error(data.error || "AI editorial review failed");
      }
      setAiReviewByPostId((current) => ({ ...current, [postId]: data.review! }));
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "AI editorial review failed" });
    } finally {
      setAiReviewingId(null);
    }
  }

  function getStatusBadge(status: ReviewPost["status"]) {
    switch (status) {
      case "IN_REVIEW":
        return <Badge variant="warning">In Review</Badge>;
      case "CHANGES_REQUESTED":
        return <Badge variant="warning">Changes Requested</Badge>;
      case "APPROVED":
        return <Badge variant="info">Approved</Badge>;
      case "PUBLISHED":
        return <Badge variant="success">Published</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  }

  const inReviewCount = posts.filter((p) => p.status === "IN_REVIEW").length;
  const changesCount = posts.filter((p) => p.status === "CHANGES_REQUESTED").length;
  const approvedCount = posts.filter((p) => p.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {message ? (
        <div
          className={`rounded-2xl p-4 text-xs font-medium ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "all"
              ? "bg-foreground text-background shadow-xs"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All Tasks ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("IN_REVIEW")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "IN_REVIEW"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          In Review ({inReviewCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("CHANGES_REQUESTED")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "CHANGES_REQUESTED"
              ? "bg-red-500 text-white shadow-xs"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Changes Requested ({changesCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("APPROVED")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "APPROVED"
              ? "bg-blue-500 text-white shadow-xs"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Approved ({approvedCount})
        </button>
      </div>

      {/* Task Cards List */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 p-12 text-center">
          <p className="text-sm font-semibold text-foreground">No review tasks found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeTab === "all"
              ? "No drafts are currently in the review pipeline."
              : `No posts with status "${activeTab}".`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPosts.map((post) => {
            const isProcessing = processingId === post.id;
            const isFeedbackOpen = activeFeedbackPostId === post.id;
            const aiReview = aiReviewByPostId[post.id];

            return (
              <div
                key={post.id}
                className="group rounded-3xl border border-border/80 bg-card/70 p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(post.status)}
                      <span className="text-xs text-muted-foreground">
                        Author: <strong className="text-foreground">{post.author?.email ?? "Unknown"}</strong>
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-foreground hover:text-primary">
                      <Link href={`/admin/posts/${post.id}`}>{post.title}</Link>
                    </h3>

                    {post.summary ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.summary}</p>
                    ) : null}

                    {post.tags?.length ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {post.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="rounded-md bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-foreground/60"
                    >
                      Open Editor
                    </Link>

                    {canRequestAiReview ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleAiReview(post.id)}
                        disabled={isProcessing || aiReviewingId === post.id}
                        className="rounded-xl text-xs"
                      >
                        {aiReviewingId === post.id ? "Reviewing…" : aiReview ? "Refresh AI Review" : "AI Review"}
                      </Button>
                    ) : null}

                    {/* Writers: Submit for review if DRAFT or CHANGES_REQUESTED */}
                    {currentUserRole === "writer" &&
                      (post.status === "DRAFT" || post.status === "CHANGES_REQUESTED") && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleReviewAction(post.id, "submit")}
                          disabled={isProcessing}
                          className="rounded-xl text-xs"
                        >
                          Submit for Review
                        </Button>
                      )}

                    {/* Editors/Admins: Review Actions */}
                    {currentUserRole !== "writer" && (
                      <>
                        {/* Request Changes toggle feedback input */}
                        {post.status === "IN_REVIEW" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setActiveFeedbackPostId(isFeedbackOpen ? null : post.id)
                            }
                            className="rounded-xl text-xs text-red-600 hover:bg-red-50 dark:text-red-400"
                          >
                            Request Changes
                          </Button>
                        )}

                        {/* Approve Post */}
                        {(post.status === "IN_REVIEW" || post.status === "CHANGES_REQUESTED") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewAction(post.id, "approve")}
                            disabled={isProcessing}
                            className="rounded-xl text-xs"
                          >
                            Approve
                          </Button>
                        )}

                        {/* Approve & Publish (Admin) */}
                        {post.status !== "PUBLISHED" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleReviewAction(post.id, "publish")}
                            disabled={isProcessing}
                            className="rounded-xl text-xs"
                          >
                            Approve & Publish
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Feedback Input Drawer when Editor clicks "Request Changes" */}
                {isFeedbackOpen ? (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                    <label
                      htmlFor={`feedback-${post.id}`}
                      className="block text-xs font-semibold text-foreground"
                    >
                      Feedback for Author:
                    </label>
                    <textarea
                      id={`feedback-${post.id}`}
                      value={feedbackInput[post.id] || ""}
                      onChange={(e) =>
                        setFeedbackInput({ ...feedbackInput, [post.id]: e.target.value })
                      }
                      placeholder="Specify requested improvements or notes for writer..."
                      className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveFeedbackPostId(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReviewAction(post.id, "request_changes")}
                        disabled={isProcessing}
                        className="rounded-xl text-xs"
                      >
                        Send Feedback
                      </Button>
                    </div>
                  </div>
                ) : null}

                {aiReview ? (
                  <section className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold text-foreground">AI editorial feedback</h4>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">Advisory only</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">A human administrator remains responsible for the review and publication decision.</p>
                    <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground">{aiReview}</pre>
                  </section>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
