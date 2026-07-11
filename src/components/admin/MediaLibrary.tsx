"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MediaLibraryItem = {
  readonly id: string;
  readonly path: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly publicUrl: string;
  readonly alt: string | null;
  readonly createdAt: string;
  readonly unused: boolean;
};

type MediaLibraryProps = {
  readonly initialMedia: readonly MediaLibraryItem[];
};

export function MediaLibrary({ initialMedia }: MediaLibraryProps) {
  const [media, setMedia] = useState<readonly MediaLibraryItem[]>(initialMedia);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return media;
    }
    return media.filter((asset) =>
      [asset.alt ?? "", asset.path, asset.publicUrl, asset.mimeType].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [media, query]);

  async function updateAlt(asset: MediaLibraryItem, alt: string) {
    setPendingId(asset.id);
    const response = await fetch(`/api/admin/media/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ alt: alt || null }),
    });

    setPendingId(null);
    if (!response.ok) {
      toast.error("Unable to update alt text");
      return;
    }
    const data = await response.json();
    setMedia((previous) => previous.map((item) => (item.id === asset.id ? { ...item, alt: data.media.alt } : item)));
    toast.success("Alt text updated");
  }

  async function deleteAsset(asset: MediaLibraryItem) {
    const confirmed = window.confirm(`Delete ${asset.path}?`);
    if (!confirmed) {
      return;
    }

    setPendingId(asset.id);
    const response = await fetch(`/api/admin/media/${asset.id}`, { method: "DELETE", credentials: "include" });
    setPendingId(null);
    if (!response.ok) {
      toast.error("Unable to delete media");
      return;
    }
    setMedia((previous) => previous.filter((item) => item.id !== asset.id));
    toast.success("Media deleted");
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Media URL copied");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="media-search">Search media</Label>
        <Input id="media-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by alt text, path, or MIME type" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((asset) => (
          <article key={asset.id} className="space-y-3 rounded-lg border border-border bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="break-all text-sm font-semibold">{asset.path}</h2>
                <p className="text-xs text-muted-foreground">{asset.mimeType} · {Math.round(asset.sizeBytes / 1024)} KB</p>
              </div>
              {asset.unused ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Unused</span> : null}
            </div>
            {asset.mimeType.startsWith("image/") ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border">
                <Image src={asset.publicUrl} alt={asset.alt ?? ""} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized />
              </div>
            ) : null}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void updateAlt(asset, String(formData.get("alt") ?? ""));
              }}
            >
              <Label htmlFor={`media-alt-${asset.id}`}>Alt text</Label>
              <div className="flex gap-2">
                <Input id={`media-alt-${asset.id}`} name="alt" defaultValue={asset.alt ?? ""} />
                <Button type="submit" variant="outline" disabled={pendingId === asset.id}>Save</Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyUrl(asset.publicUrl)}>Copy URL</Button>
              <Button type="button" variant="destructive" size="sm" disabled={pendingId === asset.id} onClick={() => void deleteAsset(asset)}>Delete</Button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No media matches your search.</p> : null}
      </div>
    </div>
  );
}
