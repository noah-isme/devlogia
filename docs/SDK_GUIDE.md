# Devlogia SDK Guide

The Devlogia SDK packages frequently used API flows into a lightweight TypeScript client. This guide covers installation, authentication, and module usage.

## Installation

```bash
pnpm add @devlogia/sdk
```

If you prefer npm or yarn:

```bash
npm install @devlogia/sdk
# or
yarn add @devlogia/sdk
```

## Authentication

Obtain an SDK token from the Devlogia admin console. Set it in the environment as `SDK_PUBLISH_TOKEN` or pass it explicitly when instantiating the client:

```ts
import { DevlogiaSDK } from "@devlogia/sdk";

const sdk = new DevlogiaSDK({
  token: process.env.DEVLOGIA_PARTNER_TOKEN!,
  baseUrl: "https://api.devlogia.com",
  tenantId: "tenant_123",
});
```

The SDK automatically adds the bearer token to all requests and scopes queries to the optional `tenantId` query parameter.

## Modules

### Feed

```ts
const { items } = await sdk.feed.list({ limit: 10, tag: "ai" });
```

### Insights

```ts
const summary = await sdk.insights.summary("30d");
console.log(summary.topPages);
```

### Federation

```ts
const recommendations = await sdk.federation.query({
  query: "vector search",
  tags: ["llm"],
  limit: 5,
});
```

### Auth

```ts
const session = await sdk.auth.exchange({ apiKey: "tenant-api-key" });
```

## Publishing Workflow

The repository exposes helper scripts:

- `pnpm sdk:build` – Builds the SDK with `tsup`.
- `pnpm sdk:publish` – Publishes the package from `packages/sdk`.

Ensure the environment variable `SDK_PUBLISH_TOKEN` is set in CI so SDK builds run authenticated end-to-end.

## Observability

SDK requests record latency in `globalThis.__DEVLOGIA_SDK_LAST_LATENCY__`. This integrates with the `sdk_latency_ms` metric surfaced in the admin metrics dashboard.
