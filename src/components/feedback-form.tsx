"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FeedbackFormProps = {
  slug: string;
};

export function FeedbackForm({ slug }: FeedbackFormProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle");

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
      className="not-prose mt-12 grid gap-6 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm sm:p-8 lg:grid-cols-[0.75fr_1.25fr]"
      aria-label="Reader feedback"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Reader feedback
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
          Was this useful?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tell our editorial team what would make the next piece even more
          valuable.
        </p>
      </div>
      <div className="space-y-3">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="I wish this article also covered..."
          minLength={10}
          maxLength={500}
          required
          className="min-h-28 rounded-xl bg-background/80"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={status === "submitting"}
            className="rounded-full px-5"
          >
            {status === "submitting" ? "Sending…" : "Send feedback"}
          </Button>
          {status === "submitted" ? (
            <p className="text-sm text-emerald-600">
              Thanks! We read every note.
            </p>
          ) : null}
          {status === "error" ? (
            <p className="text-sm text-destructive">
              Something went wrong. Try again?
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
