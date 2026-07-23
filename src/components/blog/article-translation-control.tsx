"use client";

import { useState } from "react";
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/lib/ai/mdx-translator";
import { Button } from "@/components/ui/button";

type ArticleTranslationControlProps = {
  postId?: string;
  initialTitle: string;
  initialSummary: string;
  initialContentMdx: string;
  onTranslationChange?: (translated: { title: string; summary: string; contentMdx: string } | null) => void;
};

export function ArticleTranslationControl({
  postId,
  initialTitle,
  initialSummary,
  initialContentMdx,
  onTranslationChange,
}: ArticleTranslationControlProps) {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguageCode>("es");
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeTranslation, setActiveTranslation] = useState<{
    languageName: string;
    targetLanguage: SupportedLanguageCode;
    title: string;
    summary: string;
    contentMdx: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTranslate() {
    if (isTranslating) return;
    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch("/api/posts/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          title: initialTitle,
          summary: initialSummary,
          contentMdx: initialContentMdx,
          targetLanguage: selectedLang,
        }),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();
      const translationResult = {
        languageName: data.languageName,
        targetLanguage: data.targetLanguage,
        title: data.title,
        summary: data.summary,
        contentMdx: data.contentMdx,
      };

      setActiveTranslation(translationResult);
      if (onTranslationChange) {
        onTranslationChange(translationResult);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to translate article. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }

  function handleReset() {
    setActiveTranslation(null);
    if (onTranslationChange) {
      onTranslationChange(null);
    }
  }

  return (
    <div className="my-6 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.198 16.598 5 20.001"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multi-Language MDX Translation
            </h3>
            <p className="text-xs text-foreground/80">
              {activeTranslation
                ? `Currently reading in ${activeTranslation.languageName} (Code & formatting preserved)`
                : "Auto-translate this post while keeping code snippets & MDX formatting intact."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!activeTranslation ? (
            <>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value as SupportedLanguageCode)}
                disabled={isTranslating}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Target language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                size="sm"
                onClick={handleTranslate}
                disabled={isTranslating}
                className="gap-1.5 rounded-xl text-xs font-medium"
              >
                {isTranslating ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Translating…
                  </>
                ) : (
                  <>
                    <span>Translate</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="rounded-xl text-xs"
            >
              Show Original (English)
            </Button>
          )}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
