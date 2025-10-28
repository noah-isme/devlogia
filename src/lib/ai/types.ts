export type ToneLabel = "informative" | "conversational" | "persuasive";

export type ToneSuggestion = {
  description: string;
  before?: string;
  after?: string;
};

export type ToneAnalysis = {
  tone: ToneLabel;
  readability: number;
  suggestions: ToneSuggestion[];
  adjustments: string[];
};

export type WriterAction =
  | "draft"
  | "continue"
  | "rewrite_clarity"
  | "rewrite_concise"
  | "translate_en"
  | "translate_id";

export type RelatedPost = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
};

export type WriterRequest = {
  action: WriterAction;
  title: string;
  summary?: string;
  tags?: string[];
  content?: string;
  selection?: string;
  language?: "id" | "en";
  targetLanguage?: "id" | "en";
  relatedPosts?: RelatedPost[];
  toneGuide?: string;
  styleGuide?: string;
};

export type WriterResult = {
  content: string;
};

export type OutlinePoint = {
  heading: string;
  bullets: string[];
};

export type OutlineResult = {
  sections: OutlinePoint[];
  introduction?: string;
  conclusion?: string;
};

export type SeoSuggestion = {
  title: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
  faqs: string[];
};

export type HeadlineVariantsResult = {
  variants: string[];
};

export type ModerationResult = {
  flagged: boolean;
  categories?: string[];
  reason?: string;
};

export type AICompletionUsage = {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

export type AICompletionResult = {
  content: string;
  usage: AICompletionUsage;
};

export type ToneAnalysisResult = {
  analysis: ToneAnalysis;
  usage: AICompletionUsage;
};

export type SeoSuggestionResult = {
  suggestion: SeoSuggestion;
  usage: AICompletionUsage;
};

export type OutlineResultWithUsage = {
  outline: OutlineResult;
  usage: AICompletionUsage;
};

export type HeadlineVariantsWithUsage = {
  variants: string[];
  usage: AICompletionUsage;
};

export type SummaryWithUsage = {
  summary: string;
  highlights: string[];
  usage: AICompletionUsage;
  model?: string;
};

export type SEOValidation = {
  slugAvailable: boolean;
  conflictingTitles: Array<{ id: string; title: string; similarity: number }>;
};

export type TonePreset = "Technical Guide" | "Narrative Devlog" | "Brief Note";
