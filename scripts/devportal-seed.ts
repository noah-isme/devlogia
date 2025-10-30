export {};

import { createSubmission, resetSubmissionStore } from "@/lib/devportal/submission-store";

async function main() {
  resetSubmissionStore();

  const seeded = [
    createSubmission("partner-seed", {
      repoUrl: "https://github.com/devlogia/plugin-starter",
      version: "1.0.0",
      manifest: JSON.stringify({ name: "Plugin starter", capabilities: ["editor"] }, null, 2),
      scopes: ["content:read", "content:write"],
    }),
    createSubmission("partner-seed", {
      repoUrl: "https://github.com/devlogia/ai-extension",
      version: "0.5.2",
      manifest: JSON.stringify({ name: "AI Extension", runtime: "edge" }, null, 2),
      scopes: ["ai:write"],
    }),
  ];

  console.log(`Seeded ${seeded.length} developer submissions.`);
}

void main().catch((error) => {
  console.error("Failed to seed developer portal data", error);
  process.exitCode = 1;
});
