import { useCallback, useState } from "react";

type EditorView = "write" | "preview";

export function useEditorPreview(getContent: () => string) {
  const [activeView, setActiveView] = useState<EditorView>("write");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setPreviewError(null);
    setActiveView("preview");

    try {
      const response = await fetch("/api/mdx/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: getContent() }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(data.detail || data.error || "Failed to render preview");
      }

      const data = await response.json();
      setPreviewHtml(data.html ?? "");
    } catch (error) {
      console.error(error);
      setPreviewError(`Unable to render preview. ${(error as Error).message}`);
    }
  }, [getContent]);

  const handleSwitchView = useCallback(
    (view: EditorView) => {
      if (view === "preview") {
        void handlePreview();
      } else {
        setActiveView("write");
      }
    },
    [handlePreview],
  );

  return { activeView, previewHtml, previewError, handleSwitchView };
}
