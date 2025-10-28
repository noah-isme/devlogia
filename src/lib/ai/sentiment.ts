const HF_ENDPOINT = "https://api-inference.huggingface.co/models";

export type SentimentLabel = "positive" | "negative" | "neutral";

export type SentimentResult = {
  label: SentimentLabel;
  score: number;
};

function normalizeScore(label: string, score: number): SentimentResult {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes("neg")) {
    return { label: "negative", score: Math.min(Math.max(score, 0), 1) };
  }
  if (normalizedLabel.includes("pos")) {
    return { label: "positive", score: Math.min(Math.max(score, 0), 1) };
  }
  return { label: "neutral", score: Math.min(Math.max(score, 0), 1) };
}

function heuristicSentiment(text: string): SentimentResult {
  const normalized = text.toLowerCase();
  const positiveKeywords = ["love", "great", "helpful", "excellent", "insightful", "amazing", "useful", "clear"];
  const negativeKeywords = ["bad", "confusing", "poor", "terrible", "hate", "awful", "boring", "missing"];

  let score = 0;
  for (const word of positiveKeywords) {
    if (normalized.includes(word)) {
      score += 1;
    }
  }
  for (const word of negativeKeywords) {
    if (normalized.includes(word)) {
      score -= 1;
    }
  }

  if (score > 0) {
    return { label: "positive", score: Math.min(1, score / positiveKeywords.length) };
  }
  if (score < 0) {
    return { label: "negative", score: Math.min(1, Math.abs(score) / negativeKeywords.length) };
  }
  return { label: "neutral", score: 0.5 };
}

async function requestHFSentiment(texts: string[]): Promise<SentimentResult[]> {
  const token = process.env.HF_API_KEY || process.env.AI_API_KEY || "";
  if (!token) {
    throw new Error("Missing HF_API_KEY/AI_API_KEY for sentiment analysis");
  }

  const model = process.env.SENTIMENT_MODEL || "distilbert-base-uncased-finetuned-sst-2-english";
  const response = await fetch(`${HF_ENDPOINT}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: false },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`HF sentiment failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as Array<
    Array<{
      label: string;
      score: number;
    }>
  >;

  if (!Array.isArray(payload)) {
    throw new Error("Unexpected HF sentiment response");
  }

  return payload.map((scores, index) => {
    const [top] = scores?.sort((a, b) => b.score - a.score) ?? [];
    if (!top) {
      return heuristicSentiment(texts[index] ?? "");
    }
    return normalizeScore(top.label, top.score);
  });
}

export async function classifySentiments(texts: string[]): Promise<SentimentResult[]> {
  if (!texts.length) {
    return [];
  }

  const provider = (process.env.AI_PROVIDER || "none").toLowerCase();

  if ((provider === "hf" || provider === "huggingface") && (process.env.HF_API_KEY || process.env.AI_API_KEY)) {
    try {
      return await requestHFSentiment(texts);
    } catch (error) {
      console.warn("Sentiment analysis via HF failed, falling back to heuristic", error);
    }
  }

  return texts.map((text) => heuristicSentiment(text));
}

export function sentimentScore(result: SentimentResult) {
  if (result.label === "positive") {
    return result.score;
  }
  if (result.label === "negative") {
    return -result.score;
  }
  return 0;
}
