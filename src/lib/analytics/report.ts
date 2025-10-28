import { InsightsSummary } from "@/lib/analytics/insights";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const HF_ENDPOINT = "https://api-inference.huggingface.co/models";

export type ReportOptions = {
  timeframe?: string;
  format?: "markdown" | "text";
};

function buildPrompt(summary: InsightsSummary, timeframe: string) {
  const lines = [
    `You are an editorial analyst creating a ${timeframe} engagement report for Devlogia.`,
    "Summarize trends, highlight top posts, identify underperforming content, and capture reader sentiment.",
    "Use markdown headings and bullet lists. Include sections: Top 5 Trending, Underperforming Signals, Tone Analysis, Action Items.",
    "Keep each section concise (<=4 bullets).",
    "Data:",
    JSON.stringify(summary),
  ];
  return lines.join("\n");
}

async function requestOpenAI(prompt: string) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing AI_API_KEY/OPENAI_API_KEY for report generation");
  }
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI report failed: ${response.status} ${message}`);
  }
  const data = (await response.json()) as { output_text?: string; choices?: Array<{ message?: { content?: string } }> };
  const text = data.output_text || data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI response missing content");
  }
  return text.trim();
}

async function requestHF(prompt: string) {
  const apiKey = process.env.HF_API_KEY || process.env.AI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing HF_API_KEY/AI_API_KEY for report generation");
  }
  const model = process.env.AI_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
  const response = await fetch(`${HF_ENDPOINT}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`HF report failed: ${response.status} ${message}`);
  }
  const data = (await response.json()) as Array<{ generated_text?: string }> | { generated_text?: string };
  const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
  if (!text) {
    throw new Error("HF response missing content");
  }
  return text.trim();
}

function fallbackReport(summary: InsightsSummary, timeframe: string) {
  const topPages = summary.topPages.slice(0, 5);
  const sortedDaily = [...summary.daily].sort((a, b) => b.sessionCount - a.sessionCount);
  const underperforming = sortedDaily.slice(-3);
  const positiveRatio = summary.totals.positiveFeedbackRatio * 100;

  const lines = [
    `# Devlogia ${timeframe} Insights`,
    "",
    "## Top 5 Trending",
    ...topPages.map((page, index) => `- ${index + 1}. ${page.page} — ${page.sessions} sessions, ${page.views} views`),
    "",
    "## Underperforming Signals",
  ];

  if (underperforming.length) {
    for (const day of underperforming) {
      lines.push(`- ${day.date}: bounce ${(day.bounceRate * 100).toFixed(1)}%, sentiment ${(day.sentiment.score * 100).toFixed(1)}%`);
    }
  } else {
    lines.push("- Engagement steady across monitored period.");
  }

  lines.push("", "## Tone Analysis");
  lines.push(`- Overall sentiment score ${(summary.totals.sentimentScore * 100).toFixed(1)}%`);
  lines.push(`- Positive feedback ratio ${positiveRatio.toFixed(1)}% (${summary.feedback.positive}/${summary.feedback.total})`);

  lines.push("", "## Action Items");
  lines.push("- Double down on trending themes in upcoming editorials.");
  lines.push("- Address negative feedback with targeted follow-ups and FAQs.");
  lines.push("- Share highlights with the community team for amplification.");

  return lines.join("\n");
}

export async function generateInsightsReport(summary: InsightsSummary, options: ReportOptions = {}) {
  const timeframe = options.timeframe ?? `${summary.range.days}-day`;
  const prompt = buildPrompt(summary, timeframe);
  const provider = (process.env.AI_PROVIDER || "none").toLowerCase();

  try {
    if (provider === "openai") {
      const markdown = await requestOpenAI(prompt);
      return markdown;
    }
    if (provider === "hf" || provider === "huggingface") {
      const markdown = await requestHF(prompt);
      return markdown;
    }
  } catch (error) {
    console.warn("AI report generation failed, falling back to deterministic summary", error);
  }

  return fallbackReport(summary, timeframe);
}
