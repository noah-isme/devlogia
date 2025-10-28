import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "CookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "next-auth.session-token",
  description: "Session token issued by NextAuth. In browsers it is managed automatically after sign-in.",
});

const SessionUserSchema = registry.register(
  "SessionUser",
  z
    .object({
      name: z.string().nullable().openapi({ example: "Amalia" }),
      email: z.string().email().nullable().openapi({ example: "editor@devlogia.test" }),
      image: z.string().url().nullable().optional(),
      role: z.string().optional().openapi({ example: "admin" }),
    })
    .openapi({ description: "Authenticated user metadata." }),
);

const SessionSchema = registry.register(
  "Session",
  z
    .object({
      user: SessionUserSchema.optional(),
      expires: z.string().datetime().openapi({ example: new Date().toISOString() }),
    })
    .openapi({ title: "NextAuth Session" }),
);

const PostSchema = registry.register(
  "Post",
  z
    .object({
      id: z.string().openapi({ example: "post_123" }),
      title: z.string().openapi({ example: "Introducing Devlogia" }),
      slug: z.string().openapi({ example: "introducing-devlogia" }),
      summary: z.string().nullable().openapi({ example: "Learn how Devlogia keeps your content workflow nimble." }),
      publishedAt: z.string().datetime().nullable(),
      updatedAt: z.string().datetime(),
      url: z.string().url(),
    })
    .openapi({ title: "PublicPost" }),
);

const PageSchema = registry.register(
  "Page",
  z
    .object({
      id: z.string().openapi({ example: "page_123" }),
      title: z.string(),
      slug: z.string().openapi({ example: "about" }),
      published: z.boolean(),
      updatedAt: z.string().datetime(),
      url: z.string().url(),
    })
    .openapi({ title: "PublicPage" }),
);

const AnalyticsTrafficPoint = registry.register(
  "TrafficPoint",
  z
    .object({
      month: z.string().openapi({ example: "2024-06" }),
      views: z.number().int().nonnegative().openapi({ example: 1200 }),
    })
    .openapi({ description: "Monthly view summary." }),
);

const AnalyticsResponse = registry.register(
  "AnalyticsResponse",
  z.object({
    posts: z.object({
      drafts: z.number().int().nonnegative(),
      published: z.number().int().nonnegative(),
      scheduled: z.number().int().nonnegative(),
      views: z.number().int().nonnegative(),
    }),
    pages: z.object({ total: z.number().int().nonnegative(), published: z.number().int().nonnegative() }),
    users: z.object({ total: z.number().int().nonnegative(), active: z.number().int().nonnegative(), inactive: z.number().int().nonnegative() }),
    tags: z.object({
      total: z.number().int().nonnegative(),
      top: z
        .array(
          z.object({
            tag: z.string(),
            count: z.number().int().nonnegative(),
          }),
        )
        .openapi({ description: "Top tags with usage frequency." }),
    }),
    traffic: z.object({
      timeframe: z.string().openapi({ example: "6 months" }),
      points: z.array(AnalyticsTrafficPoint),
    }),
    generatedAt: z.string().datetime(),
  }),
);

const UploadFileSchema = registry.register(
  "UploadFile",
  z.object({
    id: z.string().openapi({ example: "media_123" }),
    url: z.string().url().openapi({ example: "https://cdn.devlogia.test/uploads/2024-04-01/header.png" }),
    path: z.string().openapi({ example: "uploads/2024-04-01/header.png" }),
    mimeType: z.string().openapi({ example: "image/png" }),
    sizeBytes: z.number().openapi({ example: 24576 }),
    checksum: z.string().length(64).openapi({ example: "0f343b0931126a20f133d67c2b018a3b" }),
    alt: z.string().openapi({ example: "Team photo" }),
    createdAt: z.string().datetime(),
  }),
);

const UploadResponseSchema = registry.register(
  "UploadResponse",
  z.object({
    success: z.boolean(),
    provider: z.enum(["supabase", "stub"]),
    files: z.array(UploadFileSchema),
  }),
);

const ErrorResponse = registry.register(
  "ErrorResponse",
  z.object({
    error: z.string().openapi({ example: "Unauthorized" }),
  }),
);

const cacheHeadersDescription =
  "Responses include `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to keep content fresh while allowing CDN reuse.";

function registerPath(route: RouteConfig) {
  registry.registerPath(route);
}

registerPath({
  method: "get",
  path: "/api/auth/session",
  tags: ["Auth"],
  summary: "Read the active session",
  responses: {
    200: {
      description: "Current NextAuth session for the authenticated user.",
      content: { "application/json": { schema: SessionSchema } },
    },
    401: { description: "No active session.", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registerPath({
  method: "get",
  path: "/api/posts",
  tags: ["Content"],
  summary: "List published posts",
  description: cacheHeadersDescription,
  responses: {
    200: {
      description: "Published posts ordered by publish date.",
      content: { "application/json": { schema: z.object({ posts: z.array(PostSchema) }) } },
    },
  },
});

registerPath({
  method: "get",
  path: "/api/pages",
  tags: ["Content"],
  summary: "List site pages",
  description: cacheHeadersDescription,
  responses: {
    200: {
      description: "All CMS pages with visibility flags.",
      content: { "application/json": { schema: z.object({ pages: z.array(PageSchema) }) } },
    },
  },
});

registerPath({
  method: "get",
  path: "/api/rss",
  tags: ["Content"],
  summary: "RSS feed",
  responses: {
    200: {
      description: "RSS 2.0 XML feed.",
      content: { "application/rss+xml": { schema: z.string() } },
    },
  },
});

registerPath({
  method: "get",
  path: "/api/sitemap",
  tags: ["Content"],
  summary: "XML sitemap",
  responses: {
    200: {
      description: "Sitemap XML for search crawlers.",
      content: { "application/xml": { schema: z.string() } },
    },
  },
});

registerPath({
  method: "get",
  path: "/api/analytics",
  tags: ["Analytics"],
  summary: "Content analytics overview",
  security: [{ CookieAuth: [] }],
  responses: {
    200: {
      description: "Aggregated metrics for authenticated admins.",
      content: { "application/json": { schema: AnalyticsResponse } },
    },
    401: { description: "Not authenticated", content: { "application/json": { schema: ErrorResponse } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registerPath({
  method: "post",
  path: "/api/uploadthing",
  tags: ["Uploads"],
  summary: "Upload media to the configured storage provider",
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.string().openapi({ type: "string", format: "binary", description: "File contents" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Upload succeeded (returns stub provider when S3 isn't configured).",
      content: { "application/json": { schema: UploadResponseSchema } },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registerPath({
  method: "get",
  path: "/api/openapi.json",
  tags: ["Auth"],
  summary: "Download the OpenAPI schema",
  responses: {
    200: {
      description: "OpenAPI 3.1 definition for Devlogia's public API.",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Devlogia Public API",
    version: "1.0.0",
    description:
      "OpenAPI definition covering the public content and analytics endpoints exposed by Devlogia. Authentication is handled via NextAuth session cookies.",
    contact: {
      name: "Devlogia Engineering",
      url: "https://devlogia.test",
      email: "engineering@devlogia.test",
    },
  },
  servers: [
    { url: "https://devlogia.test", description: "Production" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  security: [{ CookieAuth: [] }],
});
