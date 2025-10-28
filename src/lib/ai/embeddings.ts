import crypto from "node:crypto";

const OPENAI_EMBEDDING_ENDPOINT = "https://api.openai.com/v1/embeddings";
const HF_EMBEDDING_ENDPOINT = "https://api-inference.huggingface.co/embeddings";

export type EmbeddingVector = number[];

export type EmbeddingResponse = {
  vector: EmbeddingVector;
  model: string;
  provider: "openai" | "hf" | "local";
};

export type EmbeddingOptions = {
  model?: string;
  signal?: AbortSignal;
};

function normalizeVector(vector: EmbeddingVector): EmbeddingVector {
  const norm = Math.hypot(...vector);
  if (!isFinite(norm) || norm === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}

function pseudoRandomVector(text: string, dimension = 128): EmbeddingVector {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vector: number[] = new Array(dimension).fill(0);

  for (let i = 0; i < dimension; i += 1) {
    const offset = i % hash.length;
    const byte = hash[offset];
    const normalized = ((byte / 255) * 2 - 1) * 0.5;
    vector[i] = normalized;
  }

  return normalizeVector(vector);
}

function sanitizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function pickModel(defaultModel: string) {
  const envModel = process.env.AI_MODEL?.trim();
  return envModel && envModel.length > 1 ? envModel : defaultModel;
}

async function requestOpenAIEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResponse> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set AI_API_KEY or OPENAI_API_KEY.");
  }

  const model = options?.model ?? pickModel("text-embedding-3-small");
  const response = await fetch(OPENAI_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options?.signal,
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI embedding failed: ${response.status} ${message}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
    model?: string;
  };

  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI embedding response missing vector");
  }

  return {
    vector: normalizeVector(embedding),
    model: data.model ?? model,
    provider: "openai",
  };
}

async function requestHFEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResponse> {
  const apiKey = process.env.HF_API_KEY || process.env.AI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing Hugging Face API key. Set HF_API_KEY or AI_API_KEY.");
  }

  const model = options?.model ?? pickModel("sentence-transformers/all-MiniLM-L6-v2");
  const response = await fetch(`${HF_EMBEDDING_ENDPOINT}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options?.signal,
    body: JSON.stringify({
      inputs: text,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`HF embedding failed: ${response.status} ${message}`);
  }

  const data = (await response.json()) as { data?: number[] } | number[];
  const vector = Array.isArray(data) ? data : data.data;

  if (!vector || !Array.isArray(vector)) {
    throw new Error("HF embedding response missing vector");
  }

  return {
    vector: normalizeVector(vector.map((value) => Number(value) || 0)),
    model,
    provider: "hf",
  };
}

export async function generateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResponse> {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return { vector: pseudoRandomVector("devlogia-empty"), model: options?.model ?? "local-empty", provider: "local" };
  }

  const provider = (process.env.AI_PROVIDER || "none").toLowerCase();

  try {
    if (provider === "openai") {
      return await requestOpenAIEmbedding(cleaned, options);
    }

    if (provider === "hf" || provider === "huggingface") {
      return await requestHFEmbedding(cleaned, options);
    }
  } catch (error) {
    console.warn("Embedding generation failed, falling back to local vector", error);
  }

  return { vector: pseudoRandomVector(cleaned), model: "local-fingerprint", provider: "local" };
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / Math.sqrt(normA * normB);
}

export function averageVectors(vectors: EmbeddingVector[]): EmbeddingVector {
  if (!vectors.length) {
    return [];
  }
  const dimension = vectors[0]?.length ?? 0;
  if (!dimension) {
    return [];
  }
  const accumulator = new Array<number>(dimension).fill(0);
  for (const vector of vectors) {
    if (vector.length !== dimension) {
      continue;
    }
    for (let i = 0; i < dimension; i += 1) {
      accumulator[i] += vector[i];
    }
  }
  return normalizeVector(accumulator.map((value) => value / vectors.length));
}

export function serializeVector(vector: EmbeddingVector) {
  return vector.map((value) => Number(value.toFixed(6)));
}

export function deserializeVector(value: unknown): EmbeddingVector {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const num = Number(entry);
    return Number.isFinite(num) ? num : 0;
  });
}
