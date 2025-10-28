import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "../src/lib/prisma";
import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "25", 10) : 25;
  const push = process.argv.includes("--push");
  const tenantSlug = process.env.TENANT_SLUG ?? "default";

  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const blocking = readiness.filter((issue) => issue.level === "error");

  if (blocking.length > 0) {
    console.error("❌ Federation publish aborted due to configuration errors:");
    for (const issue of blocking) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(limit) && limit > 0 ? limit : 25,
    include: {
      tags: { include: { tag: true } },
      embedding: true,
    },
  });

  const payload = {
    tenant: {
      slug: tenantSlug,
      plan: config.defaultPlan,
      mode: config.mode,
    },
    generatedAt: new Date().toISOString(),
    items: posts.map((post) => ({
      postId: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: post.tags.map((entry) => entry.tag.slug),
      embedding: post.embedding?.vector ?? null,
      updatedAt: post.updatedAt.toISOString(),
    })),
  };

  if (!push || !config.federation.indexUrl || !config.federation.apiKey) {
    const outputDir = resolve(process.cwd(), ".reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "federation-payload.json");
    await writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log(`📝 Federation payload written to ${outputPath}`);
    if (push) {
      console.warn(
        "⚠️  Federation push requested but missing FEDERATION_INDEX_URL or FEDERATION_API_KEY. Payload saved locally instead.",
      );
    }
    return;
  }

  const endpoint = `${config.federation.indexUrl.replace(/\/$/, "")}/ingest`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.federation.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`❌ Federation index responded with ${response.status} ${response.statusText}`);
    const text = await response.text().catch(() => "");
    if (text) {
      console.error(text);
    }
    process.exitCode = 1;
    return;
  }

  console.log("🚀 Federation payload published successfully.");
}

main().catch((error) => {
  console.error("Federation publish failed", error);
  process.exitCode = 1;
});
