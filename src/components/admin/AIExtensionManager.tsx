"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CreateDraft = {
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  capability: string;
  tokenCost: string;
  description: string;
};

const INITIAL_DRAFT: CreateDraft = {
  tenantId: "",
  name: "",
  provider: "openai",
  model: "",
  capability: "writer",
  tokenCost: "0",
  description: "",
};

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "huggingface", label: "HuggingFace" },
];

const CAPABILITY_OPTIONS = [
  { value: "writer", label: "Writer" },
  { value: "optimizer", label: "Optimizer" },
  { value: "seo", label: "SEO" },
  { value: "summarizer", label: "Summarizer" },
];

export function AIExtensionManager() {
  const [draft, setDraft] = useState<CreateDraft>(INITIAL_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof CreateDraft>(field: K, value: CreateDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ai/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          tokenCost: Number(draft.tokenCost ?? 0),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.error === "string" ? body.error : "Unable to create AI extension";
        throw new Error(message);
      }

      toast.success("AI extension created", { description: `${draft.name} is now available.` });
      setDraft(INITIAL_DRAFT);
    } catch (error) {
      toast.error("Unable to create AI extension", { description: error instanceof Error ? error.message : "Create failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Register AI extension</h3>
        <p className="text-xs text-muted-foreground">Add a new tenant AI capability to the hub.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ai-tenant">Tenant ID</Label>
          <Input id="ai-tenant" value={draft.tenantId} onChange={(event) => updateField("tenantId", event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-name">Name</Label>
          <Input id="ai-name" value={draft.name} onChange={(event) => updateField("name", event.target.value)} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select id="ai-provider" value={draft.provider} onChange={(event) => updateField("provider", event.target.value)}>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-model">Model</Label>
          <Input id="ai-model" value={draft.model} onChange={(event) => updateField("model", event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-capability">Capability</Label>
          <Select id="ai-capability" value={draft.capability} onChange={(event) => updateField("capability", event.target.value)}>
            {CAPABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ai-token-cost">Monthly token cost</Label>
          <Input id="ai-token-cost" type="number" min={0} value={draft.tokenCost} onChange={(event) => updateField("tokenCost", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-description">Description</Label>
          <Textarea id="ai-description" value={draft.description} onChange={(event) => updateField("description", event.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create extension"}
        </Button>
      </div>
    </form>
  );
}
