import { cache } from "react";

export type DeveloperDoc = {
  slug: string[];
  title: string;
  description: string;
  category: string;
  order: number;
  content: string;
};

const docs: DeveloperDoc[] = [
  {
    slug: ["auth"],
    title: "Authentication & Access",
    description:
      "Exercise the beta playground with short-lived sandbox tokens.",
    category: "Getting started",
    order: 1,
    content: `
# Authentication

The current developer portal is beta. Use the [sandbox token minting endpoint](/developers/playground) to exercise the playground, then verify authentication on each target API route before integrating.

<Callout title="Local development" type="info">
  Configure \`DEVPORTAL_SANDBOX_API_KEY\` for the playground. The route validates a supplied \`X-Devportal-Sandbox-Key\`; returned random tokens expire after one hour and are not persisted.
</Callout>

## Sandbox token flow

<CodeSnippet
  title="Minting a sandbox token"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'import fetch from "node-fetch";\n\nconst response = await fetch("/api/devportal/playground/token", {\n  method: "POST",\n  headers: { "X-Devportal-Sandbox-Key": process.env.DEVPORTAL_SANDBOX_API_KEY! },\n});\n\nconst { token } = await response.json();\n'
    },
    {
      id: "js",
      label: "JavaScript",
      language: "js",
      code: 'fetch("/api/devportal/playground/token", {\n  method: "POST",\n  headers: { "X-Devportal-Sandbox-Key": window.DEVPORTAL_SANDBOX_API_KEY },\n}).then((res) => res.json());\n'
    },
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: 'curl -X POST -H "X-Devportal-Sandbox-Key: $DEVPORTAL_SANDBOX_API_KEY" https://devlogia.app/api/devportal/playground/token\n'
    }
  ]}
/>

Tokens expire after 1 hour. The repository does not currently implement OAuth authorize/token routes, and the sandbox token is not a production tenant credential. Production ecosystem authentication remains future work.
`,
  },
  {
    slug: ["sdk"],
    title: "TypeScript SDK",
    description:
      "Inspect the beta typed client and its current route compatibility.",
    category: "Getting started",
    order: 2,
    content: `
# TypeScript SDK

The beta \`@devlogia/sdk\` package exposes feed, insights, federation, auth, and AI clients. Build it from this repository and verify route compatibility before use.

\`\`\`bash
pnpm add @devlogia/sdk
\`\`\`

## Initialising the client

<CodeSnippet
  title="SDK client"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'import { DevlogiaSDK } from "@devlogia/sdk";\n\nconst client = new DevlogiaSDK({\n  token: process.env.SDK_PUBLISH_TOKEN!,\n  baseUrl: "http://localhost:3001",\n});\n\nconst extensions = await client.ai.listExtensions({ tenantId: "tenant_123" });\n'
    },
    {
      id: "js",
      label: "JavaScript",
      language: "js",
      code: 'const { DevlogiaSDK } = require("@devlogia/sdk");\n\nconst client = new DevlogiaSDK({ token: process.env.SDK_PUBLISH_TOKEN });\nclient.federation.query({ query: "publishing" }).then(console.log);\n'
    },
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: 'curl -X POST -H "Authorization: Bearer $SDK_PUBLISH_TOKEN" -H "Content-Type: application/json" -d \'{"query":"publishing"}\' https://devlogia.app/api/federation/query\n'
    }
  ]}
/>

## Compatibility note

The SDK is ahead of stable CMS routes: feed, insights, and auth modules currently target paths that are not implemented under those exact names. Federation targets \`/api/federation/query\`; AI targets beta routes backed by models that may not be migrated. The SDK does not export a webhook verifier. See \`docs/SDK_GUIDE.md\` in the repository for the current mismatch inventory.
`,
  },
  {
    slug: ["plugin", "api"],
    title: "Plugin API",
    description:
      "Prototype plugin manifests and the in-memory review workflow.",
    category: "Build integrations",
    order: 1,
    content: `
# Plugin API

Plugins can render components inside the Devlogia editor, dashboard, or analytics views. Each plugin declares capabilities in a manifest file.

## Manifest schema

<CodeSnippet
  title="plugin.devlogia.json"
  tabs={[
    {
      id: "ts",
      label: "JSON",
      language: "json",
      code: '{\n  "name": "devlogia-sample-plugin",\n  "version": "1.0.0",\n  "capabilities": ["editor", "analytics"],\n  "webhooks": ["submission.updated"],\n  "permissions": ["content:read", "content:write"]\n}\n'
    }
  ]}
/>

## Submission lifecycle

1. Draft your manifest locally.
2. Upload via the [submission console](/developers/submissions).
3. Wait for review feedback on the [internal console](/internal/reviews).
4. Inspect the review decision in the prototype console.

Submission/review records currently use an in-memory store; they are lost on restart and do not publish to a marketplace. Use the Webhook Tester to validate \`submission.updated\` payload delivery during prototype review cycles.
`,
  },
  {
    slug: ["ai", "extensions"],
    title: "AI Extensions",
    description:
      "Inspect the beta AI-extension API and its migration requirements.",
    category: "Build integrations",
    order: 2,
    content: `
# AI Extensions

AI extensions augment author workflows with summarisation, rewriting, and federation insights. Each extension specifies a runtime and required scopes.

## Defining an extension

<CodeSnippet
  title="extension.config.ts"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'const extension = await client.ai.createExtension({\n  tenantId: "tenant_123",\n  name: "Editorial helper",\n  provider: "openai",\n  model: "gpt-4o-mini",\n  capability: "writer",\n});\n'
    }
  ]}
/>

The package does not currently export \`defineExtension\` or an \`@devlogia/sdk/extensions\` entry point. Extension persistence depends on beta tables that are not covered by the checked-in migrations.

## Usage metrics

Monitor \`playground_requests\`, \`submission_created\`, and \`submission_approval_rate\` metrics in the telemetry dashboard to gauge adoption.
`,
  },
  {
    slug: ["billing"],
    title: "Billing & Monetisation",
    description:
      "Review the beta Stripe route foundation and release constraints.",
    category: "Operate",
    order: 1,
    content: `
# Billing

Billing routes and Stripe helpers exist as beta foundation code. Billing, product, order, revenue-split, and payout models are not covered by the checked-in migrations, so this flow is not part of the stable CMS release.

## Checkout session

<CodeSnippet
  title="Create checkout"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'const response = await fetch("/api/billing/checkout", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ productId: "prod_123", returnUrl: "https://example.com/success" }),\n});\n'
    },
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: 'curl -X POST https://api.devlogia.app/billing/checkout -H "Authorization: Bearer $DEVLOGIA_TOKEN" -d \'{"productId":"prod_123","returnUrl":"https://example.com/success"}\'\n'
    }
  ]}
/>

The current SDK has no \`billing\` module. Do not promise settlement cadence or payouts until migrations, entitlement checks, Stripe lifecycle E2E coverage, and reconciliation operations are complete.
`,
  },
  {
    slug: ["federation"],
    title: "Federation & Webhooks",
    description:
      "Federate content across the Devlogia network and validate webhook signatures.",
    category: "Operate",
    order: 2,
    content: `
# Federation & Webhooks

Federation lets you broadcast updates to partner tenants via signed webhook events.

## Testing webhooks

Use the [Webhook Tester](/developers/webhooks/tester) to send signed payloads to your staging endpoint. The tester applies replay protection using the \`WEBHOOK_REPLAY_TTL_SEC\` window.

<CodeSnippet
  title="Webhook handler"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'export async function handler(request: Request) {\n  const body = await request.text();\n  const signature = request.headers.get("x-devlogia-signature");\n  const timestamp = request.headers.get("x-devlogia-timestamp");\n  const nonce = request.headers.get("x-devlogia-nonce");\n\n  // Recompute HMAC-SHA256 over the exact body with WEBHOOK_SIGNING_KEY,\n  // compare signatures timing-safely, and reject stale or repeated nonces.\n  return new Response(null, { status: signature && timestamp && nonce ? 204 : 400 });\n}\n'
    }
  ]}
/>

The current SDK does not export a webhook verifier. The tester signs the serialized envelope with HMAC-SHA256 and sends signature, timestamp, and nonce headers; receiver-side verification remains the integrator's responsibility.

## Federation query

The beta SDK federation module posts to \`/api/federation/query\`. It depends on federation data/models that are not in the stable CMS migration scope.
`,
  },
];

export const developerDocs = docs;

export const getDeveloperDocs = cache(() =>
  developerDocs.slice().sort((a, b) => a.order - b.order),
);

export function findDeveloperDoc(slug: string[]): DeveloperDoc | undefined {
  const normalised = slug.filter(Boolean).map((part) => part.toLowerCase());
  return developerDocs.find(
    (doc) =>
      doc.slug.length === normalised.length &&
      doc.slug.every((part, index) => part === normalised[index]),
  );
}

export type DeveloperDocNavSection = {
  title: string;
  items: Array<{ title: string; href: string; description: string }>;
};

export const getDeveloperDocNav = cache(() => {
  const grouped = new Map<string, DeveloperDocNavSection>();

  for (const doc of developerDocs) {
    const href = `/developers/docs/${doc.slug.join("/")}`;
    const section = grouped.get(doc.category) ?? {
      title: doc.category,
      items: [],
    };

    section.items.push({
      title: doc.title,
      href,
      description: doc.description,
    });
    grouped.set(doc.category, section);
  }

  return Array.from(grouped.values()).map((section) => ({
    ...section,
    items: section.items.sort((a, b) => a.title.localeCompare(b.title)),
  }));
});

export function extractDocHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{2,4}\s+/.test(line))
    .map((line) => {
      const match = /^(#{2,4})\s+(.+)$/.exec(line);
      if (!match) {
        return null;
      }
      const [, hashes, title] = match;
      const level = hashes.length;
      const cleaned = title
        .replace(/<[^>]+>/g, "")
        .replace(/\`([^`]+)\`/g, "$1")
        .trim();
      return cleaned
        ? {
            id: cleaned
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .trim()
              .replace(/\s+/g, "-"),
            title: cleaned,
            level,
          }
        : null;
    })
    .filter((entry): entry is { id: string; title: string; level: number } =>
      Boolean(entry),
    );
}

export function listDocInternalLinks() {
  const linkPattern = /\[.+?\]\((\/developers\/docs\/[^)]+)\)/g;
  const entries: Array<{ from: string; to: string }> = [];

  for (const doc of developerDocs) {
    const href = `/developers/docs/${doc.slug.join("/")}`;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(doc.content))) {
      entries.push({ from: href, to: match[1] });
    }
  }

  return entries;
}
