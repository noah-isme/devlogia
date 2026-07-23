import { type ChangeEvent, useRef, useState } from "react";

import type { AutosaveState, EditorPost, UploadState } from "@/components/editor/types";

type UseEditorUploadOptions = {
  latestState: React.MutableRefObject<EditorPost>;
  setPost: React.Dispatch<React.SetStateAction<EditorPost>>;
  setAutosaveState: (state: AutosaveState) => void;
};

export function useEditorUpload({ latestState, setPost, setAutosaveState }: UseEditorUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setUploadState("error");
      setUploadMessage("Tidak dapat mengunggah saat offline.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadState("uploading");
    setUploadMessage(null);

    try {
      const response = await fetch("/api/uploadthing", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const uploaded = data.files?.[0];

      if (!uploaded?.url) {
        throw new Error("Upload response missing URL");
      }

      const fallbackAlt = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const alt = uploaded.alt ?? (fallbackAlt || "Image");

      setPost((prev) => {
        const next = {
          ...prev,
          coverUrl: uploaded.url,
          contentMdx: `${prev.contentMdx.trimEnd()}\n\n![${alt}](${uploaded.url})\n`,
        };
        latestState.current = next;
        return next;
      });
      setAutosaveState("idle");
      setUploadState("success");
      setUploadMessage("Gambar diunggah. Cover diperbarui dan markdown disisipkan.");
    } catch (error) {
      console.error("Upload failed", error);
      setUploadState("error");
      setUploadMessage("Gagal mengunggah media.");
    }
  }

  async function handleUrlImport(imageUrl: string) {
    if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
      setUploadState("error");
      setUploadMessage("Masukkan URL gambar yang valid (http/https).");
      return;
    }

    setUploadState("uploading");
    setUploadMessage(null);

    try {
      const response = await fetch("/api/uploadthing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`URL import failed with status ${response.status}`);
      }

      const data = await response.json();
      const uploaded = data.files?.[0];

      if (!uploaded?.url) {
        throw new Error("Import response missing URL");
      }

      const alt = uploaded.alt || "Imported Image";

      setPost((prev) => {
        const next = {
          ...prev,
          coverUrl: uploaded.url,
          contentMdx: `${prev.contentMdx.trimEnd()}\n\n![${alt}](${uploaded.url})\n`,
        };
        latestState.current = next;
        return next;
      });
      setAutosaveState("idle");
      setUploadState("success");
      setUploadMessage("Gambar dari URL berhasil diimpor dan disimpan.");
    } catch (error) {
      console.error("URL import failed", error);
      setUploadState("error");
      setUploadMessage("Gagal mengimpor gambar dari URL.");
    }
  }

  return { fileInputRef, uploadState, uploadMessage, openFileDialog, handleFileChange, handleUrlImport };
}
