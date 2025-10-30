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
    description: "Authenticate requests with sandbox tokens and OAuth flows.",
    category: "Getting started",
    order: 1,
    content: `
# Authentication

Devlogia APIs require a bearer token on every request. Use the [sandbox token minting endpoint](/developers/playground) during development and switch to OAuth when publishing to production tenants.

<Callout title="Local development" type="info">
  Configure \`DEVPORTAL_SANDBOX_API_KEY\` and run \`pnpm devportal:seed\` to mint scoped tokens for your sandbox workspace.
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

Tokens expire after 1 hour. Refresh proactively using the \`X-Devportal-Sandbox-Key\` header.

## OAuth for production

1. Redirect users to \`https://devlogia.app/oauth/authorize\` with your client ID and requested scopes.
2. Exchange the authorization code at \`https://api.devlogia.app/oauth/token\`.
3. Store the returned access token securely and refresh before expiry.

Scopes map directly to plugin permissions. Request the minimum set that unlocks your integration features.
`,
  },
  {
    slug: ["sdk"],
    title: "TypeScript SDK",
    description: "Use the official SDK for typed API calls and webhook helpers.",
    category: "Getting started",
    order: 2,
    content: `
# TypeScript SDK

Install \`@devlogia/sdk\` to quickly integrate with APIs, webhook verifiers, and realtime helpers.

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
      code: 'import { Devlogia } from "@devlogia/sdk";\n\nconst client = new Devlogia({\n  token: process.env.DEVLOGIA_TOKEN!,\n});\n\nconst submissions = await client.submissions.list();\n'
    },
    {
      id: "js",
      label: "JavaScript",
      language: "js",
      code: 'const { Devlogia } = require("@devlogia/sdk");\n\nconst client = new Devlogia({ token: process.env.DEVLOGIA_TOKEN });\nclient.submissions.list().then(console.log);\n'
    },
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: 'curl -H "Authorization: Bearer $DEVLOGIA_TOKEN" https://api.devlogia.app/submissions\n'
    }
  ]}
/>

## Webhook utilities

The SDK exports a \`createWebhookVerifier\` helper that understands the Devlogia signature scheme.

\`\`\`ts
import { createWebhookVerifier } from "@devlogia/sdk";

const verify = createWebhookVerifier({ signingKey: process.env.WEBHOOK_SIGNING_KEY! });
const result = verify({
  payload: requestBody,
  signature: request.headers.get("x-devlogia-signature")!,
  timestamp: request.headers.get("x-devlogia-timestamp")!,
  nonce: request.headers.get("x-devlogia-nonce")!,
});
\`\`\`

The verifier automatically enforces the replay protection window defined by \`WEBHOOK_REPLAY_TTL_SEC\`.
`,
  },
  {
    slug: ["plugin", "api"],
    title: "Plugin API",
    description: "Publish UI plugins that extend the editor and dashboard surfaces.",
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
4. Receive marketplace badges after approval.

Use the Webhook Tester to validate \`submission.updated\` payloads during review cycles.
`,
  },
  {
    slug: ["ai", "extensions"],
    title: "AI Extensions",
    description: "Build AI-powered extensions that run on server, edge, or client runtimes.",
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
      code: 'import { defineExtension } from "@devlogia/sdk/extensions";\n\nexport default defineExtension({\n  surface: "editor",\n  runtime: "edge",\n  entry: "./src/index.ts",\n  scopes: ["ai:write", "content:read"],\n});\n'
    }
  ]}
/>

Edge extensions run inside the Devlogia global edge runtime with access to fetch, cache, and KV primitives. Server extensions execute in your infrastructure and communicate using signed webhooks.

## Usage metrics

Monitor \`playground_requests\`, \`submission_created\`, and \`submission_approval_rate\` metrics in the telemetry dashboard to gauge adoption.
`,
  },
  {
    slug: ["billing"],
    title: "Billing & Monetisation",
    description: "Charge customers for premium extensions using Devlogia billing flows.",
    category: "Operate",
    order: 1,
    content: `
# Billing

Devlogia handles subscription checkout, invoicing, and payouts. Configure pricing in the partner console and handle lifecycle webhooks.

## Checkout session

<CodeSnippet
  title="Create checkout"
  tabs={[
    {
      id: "ts",
      label: "TypeScript",
      language: "ts",
      code: 'const response = await client.billing.createCheckout({\n  productId: "prod_123",\n  returnUrl: "https://example.com/success",\n});\nwindow.location.href = response.url;\n'
    },
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: 'curl -X POST https://api.devlogia.app/billing/checkout -H "Authorization: Bearer $DEVLOGIA_TOKEN" -d \'{"productId":"prod_123","returnUrl":"https://example.com/success"}\'\n'
    }
  ]}
/>

Payouts settle weekly once balances exceed your threshold. Track \`submission_approval_rate\` and \`avg_review_time_hours\` to optimise go-to-market velocity.
`,
  },
  {
    slug: ["federation"],
    title: "Federation & Webhooks",
    description: "Federate content across the Devlogia network and validate webhook signatures.",
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
      code: 'import { createWebhookVerifier } from "@devlogia/sdk";\n\nconst verify = createWebhookVerifier({ signingKey: process.env.WEBHOOK_SIGNING_KEY! });\n\nexport async function handler(request: Request) {\n  const signature = request.headers.get("x-devlogia-signature");\n  const timestamp = request.headers.get("x-devlogia-timestamp");\n  const nonce = request.headers.get("x-devlogia-nonce");\n  const body = await request.text();\n\n  if (!verify({ payload: body, signature, timestamp, nonce })) {\n    return new Response("Invalid signature", { status: 400 });\n  }\n\n  console.log("Received webhook", body);\n  return new Response(null, { status: 204 });\n}\n'
    }
  ]}
/>

## Federation index

Fetch the [Federation index](/developers/docs/federation) to discover partner surfaces and capabilities. Cache the response for at least 15 minutes to avoid unnecessary load.
`,
  },
];

export const developerDocs = docs;

export const getDeveloperDocs = cache(() => developerDocs.slice().sort((a, b) => a.order - b.order));

export function findDeveloperDoc(slug: string[]): DeveloperDoc | undefined {
  const normalised = slug.filter(Boolean).map((part) => part.toLowerCase());
  return developerDocs.find(
    (doc) => doc.slug.length === normalised.length && doc.slug.every((part, index) => part === normalised[index]),
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

    section.items.push({ title: doc.title, href, description: doc.description });
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
      const cleaned = title.replace(/<[^>]+>/g, "").replace(/\`([^`]+)\`/g, "$1").trim();
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
    .filter((entry): entry is { id: string; title: string; level: number } => Boolean(entry));
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
