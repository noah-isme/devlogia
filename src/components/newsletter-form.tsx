"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setMessage("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setStatus("error");
        setMessage(typeof payload.error === "string" ? payload.error : "Subscription failed. Try again later.");
        return;
      }

      setStatus("success");
      setMessage("Thanks for subscribing! Check your inbox to confirm.");
      setEmail("");
    } catch (error) {
      console.error("Subscription request failed", error);
      setStatus("error");
      setMessage("We could not complete your subscription. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <label className="block text-sm font-medium text-muted-foreground" htmlFor="newsletter-email">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-describedby={message ? "newsletter-feedback" : undefined}
      />
      <Button type="submit" disabled={status === "loading" || status === "success"}>
        {status === "loading" ? "Subscribing…" : status === "success" ? "Subscribed" : "Subscribe"}
      </Button>
      {message ? (
        <p
          id="newsletter-feedback"
          className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-500"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
