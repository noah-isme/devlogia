import { createHash } from "node:crypto";

const legacyBaseEnv = process.env.LEGACY_API_BASE_URL;
const currentBaseEnv =
  process.env.NEW_API_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const sampleSize = Number(process.env.SHADOW_COMPARE_SAMPLE_SIZE ?? "5");
const threshold = Number(process.env.SHADOW_COMPARE_THRESHOLD ?? "0.01");

if (!legacyBaseEnv) {
  console.warn("LEGACY_API_BASE_URL is not set. Skipping shadow compare.");
  process.exit(0);
}

const legacyBase = legacyBaseEnv;
const currentBase = currentBaseEnv;

type ComparableRecord = { id?: string; slug?: string } & Record<string, unknown>;

const endpoints: Array<{ path: string; field: "posts" | "pages" }> = [
  { path: "/api/posts", field: "posts" },
  { path: "/api/pages", field: "pages" },
];

function hashPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function fetchJson(base: string, path: string) {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`).toString();
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }
  return response.json();
}

function toComparableArray(payload: unknown, field: "posts" | "pages"): ComparableRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ComparableRecord => typeof item === "object" && item !== null);
  }

  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const collection = record[field];
    if (Array.isArray(collection)) {
      return collection.filter((item): item is ComparableRecord => typeof item === "object" && item !== null);
    }
  }

  return [];
}

function extractKey(item: ComparableRecord) {
  return (typeof item.id === "string" && item.id) || (typeof item.slug === "string" && item.slug) || undefined;
}

async function compareEndpoint(endpoint: { path: string; field: "posts" | "pages" }) {
  const legacyPayload = await fetchJson(legacyBase, endpoint.path);
  const currentPayload = await fetchJson(currentBase, endpoint.path);

  const legacyItems = toComparableArray(legacyPayload, endpoint.field);
  const currentItems = toComparableArray(currentPayload, endpoint.field);

  const sample = legacyItems.slice(0, Math.max(sampleSize, 1));
  let mismatches = 0;

  for (const item of sample) {
    const key = extractKey(item);
    if (!key) {
      continue;
    }
    const match = currentItems.find((candidate) => extractKey(candidate) === key);
    if (!match) {
      mismatches += 1;
      continue;
    }
    if (hashPayload(item) !== hashPayload(match)) {
      mismatches += 1;
    }
  }

  const ratio = sample.length > 0 ? mismatches / sample.length : 0;
  const percent = (ratio * 100).toFixed(2);
  console.log(`Shadow compare for ${endpoint.path}: ${mismatches}/${sample.length} mismatches (${percent}%).`);
  return ratio;
}

async function main() {
  let violation = false;
  for (const endpoint of endpoints) {
    const ratio = await compareEndpoint(endpoint);
    if (ratio > threshold) {
      violation = true;
    }
  }

  if (violation) {
    console.error(`Shadow compare exceeded threshold of ${(threshold * 100).toFixed(2)}%.`);
    process.exit(1);
  }

  console.log("Shadow compare finished within threshold.");
}

main().catch((error) => {
  console.error("Shadow compare failed", error);
  process.exit(1);
});
