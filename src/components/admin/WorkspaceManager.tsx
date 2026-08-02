"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

type CreateDraft = {
  name: string;
  slug: string;
};

const INITIAL_DRAFT: CreateDraft = {
  name: "",
  slug: "",
};

export function WorkspaceManager({ tenantId }: { tenantId: string }) {
  const [draft, setDraft] = useState<CreateDraft>(INITIAL_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof CreateDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, tenantId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.error === "string" ? body.error : "Unable to create workspace";
        throw new Error(message);
      }

      toast.success("Workspace created", { description: `${draft.name} is ready for collaboration.` });
      setDraft(INITIAL_DRAFT);
    } catch (error) {
      toast.error("Unable to create workspace", { description: error instanceof Error ? error.message : "Create failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Create workspace</h3>
        <p className="text-xs text-muted-foreground">Create a new collaboration workspace for this tenant.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            value={draft.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Engineering workspace"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="workspace-slug">Slug</Label>
          <Input
            id="workspace-slug"
            value={draft.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            placeholder="engineering"
            required
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create workspace"}
        </Button>
      </div>
    </form>
  );
}
