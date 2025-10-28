"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FeedbackFormProps = {
  slug: string;
};

export function FeedbackForm({ slug }: FeedbackFormProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "feedback",
          payload: { slug, message: message.trim() },
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      setMessage("");
      setStatus("submitted");
    } catch (error) {
      console.error("Feedback submission failed", error);
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="not-prose mt-12 space-y-3 rounded-lg border border-border bg-muted/20 p-4"
      aria-label="Reader feedback"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Was this helpful?</h2>
        <p className="text-sm text-muted-foreground">Share quick feedback to help us improve future pieces.</p>
      </div>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="I wish this article also covered..."
        minLength={10}
        maxLength={500}
        required
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send feedback"}
        </Button>
        {status === "submitted" ? (
          <p className="text-sm text-emerald-600">Thanks! We read every note.</p>
        ) : null}
        {status === "error" ? <p className="text-sm text-destructive">Something went wrong. Try again?</p> : null}
      </div>
    </form>
  );
}
