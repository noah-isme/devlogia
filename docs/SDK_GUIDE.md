# Devlogia SDK guide (beta)

`packages/sdk` contains the beta `@devlogia/sdk` TypeScript client. It is source-available in this workspace and is not part of the stable CMS/blog release contract.

## Build and install

Build from the repository:

```bash
pnpm sdk:build
```

The package emits CommonJS, ESM, and declarations to `packages/sdk/dist`. If the package is published to your configured registry, consumers can install it with:

```bash
pnpm add @devlogia/sdk
```

## Client

```ts
import { DevlogiaSDK } from "@devlogia/sdk";

const sdk = new DevlogiaSDK({
  token: process.env.SDK_PUBLISH_TOKEN,
  baseUrl: "http://localhost:3001",
  tenantId: "tenant_123",
});
```

`token` falls back to `SDK_PUBLISH_TOKEN`. `baseUrl` defaults to `https://api.devlogia.com`; override it for local, staging, or self-hosted deployments. When present, `tenantId` is appended to request query strings.

The HTTP client sends JSON-oriented bearer-token requests and records the most recent request latency in `globalThis.__DEVLOGIA_SDK_LAST_LATENCY__`.

## Exported modules

The current `DevlogiaSDK` class exposes:

- `feed` — personal feed requests.
- `insights` — summary/analytics requests.
- `federation` — beta federation queries.
- `auth` — beta SDK token exchange client.
- `ai` — beta extension, workspace, and usage requests.
- `verifyWebhookSignature` — standalone helper for validating Devlogia webhook payloads.

Example:

```ts
const { items } = await sdk.feed.list({ limit: 10, tag: "ai" });
const summary = await sdk.insights.summary("30d");
const recommendations = await sdk.federation.query({
  query: "vector search",
  tags: ["llm"],
  limit: 5,
});
```

## Route compatibility

The SDK is ahead of the stable CMS release in a few places. Before integrating a method, compare its request path in `packages/sdk/src/modules/` with the App Router handlers in `src/app/api/`.

- `feed.list()` targets `/api/feed`, while the repository route is `/api/feed/personal`.
- `insights.summary()` targets `/api/insights`, while the repository route is `/api/insights/summary`.
- `auth.exchange()` targets `/api/auth/sdk-exchange`, which is not implemented.
- `federation.query()` matches `/api/federation/query`.
- AI calls now align with `/api/ai/extensions` and the `/api/workspaces` management endpoints.
- `/api/plugins` and `/api/extensions` support marketplace lifecycle routes.
- `/api/cron/process-outbox` supports the checked-in outbox worker.
- `verifyWebhookSignature` can validate webhook payloads before processing.

Treat mismatched methods as unimplemented previews until the client and server paths are reconciled.

## Publishing

```bash
pnpm sdk:build
pnpm sdk:publish
```

`sdk:publish` publishes `@devlogia/sdk` with public access. Registry authentication is environment-specific; do not confuse the registry token with `SDK_PUBLISH_TOKEN`, which is the SDK client's runtime fallback token.
