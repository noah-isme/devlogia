import { Fragment } from "react";
import type {
  ComponentsObject,
  OperationObject,
  PathItemObject,
  PathsObject,
  ReferenceObject,
  SchemaObject,
} from "openapi3-ts/oas31";

import { openApiDocument } from "@/lib/openapi/document";

const categories = [
  { id: "Auth", title: "Authentication" },
  { id: "Content", title: "Content Delivery" },
  { id: "Analytics", title: "Analytics" },
  { id: "Uploads", title: "Uploads" },
] as const;

type Operation = {
  id: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  requestExample?: unknown;
  responseExample?: unknown;
  requiresAuth: boolean;
};

type OperationMap = Record<(typeof categories)[number]["id"], Operation[]>;

function getOperationsByCategory(): OperationMap {
  const grouped = Object.fromEntries(categories.map((category) => [category.id, [] as Operation[]])) as OperationMap;
  const paths = (openApiDocument.paths ?? {}) as PathsObject;
  const methodKeys: (keyof PathItemObject)[] = [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
  ];

  for (const [path, pathItem] of Object.entries(paths)) {
    const operations = (pathItem ?? {}) as PathItemObject;
    for (const method of methodKeys) {
      const operation = operations[method];
      if (!operation) continue;

      const tags: string[] = Array.isArray(operation.tags) ? operation.tags : [];
      for (const tag of tags) {
        if (!grouped[tag as keyof OperationMap]) continue;
        const requestExample = buildRequestExample(operation);
        const responseExample = buildResponseExample(operation);
        grouped[tag as keyof OperationMap].push({
          id: `${String(method)}-${path}`,
          method: String(method),
          path,
          summary: operation.summary ?? "",
          description: operation.description,
          requestExample,
          responseExample,
          requiresAuth: Array.isArray(operation.security) && operation.security.length > 0,
        });
      }
    }
  }

  for (const category of categories) {
    grouped[category.id].sort((a, b) => a.path.localeCompare(b.path));
  }

  return grouped;
}

function buildRequestExample(operation: OperationObject) {
  const requestBody = operation.requestBody;
  if (!requestBody || isReferenceObject(requestBody)) {
    return undefined;
  }

  const json = requestBody.content?.["application/json"]?.schema;
  if (json) {
    return buildExampleFromSchema(json);
  }
  const form = requestBody.content?.["multipart/form-data"]?.schema;
  if (form) {
    return buildExampleFromSchema(form);
  }
  return undefined;
}

function buildResponseExample(operation: OperationObject) {
  const response = operation.responses?.["200"];
  if (!response || isReferenceObject(response)) {
    return undefined;
  }
  const json = response.content?.["application/json"]?.schema;
  if (json) {
    return buildExampleFromSchema(json);
  }
  return undefined;
}

function isReferenceObject<T extends object>(value: T | ReferenceObject): value is ReferenceObject {
  return Boolean(value && typeof value === "object" && "$ref" in value);
}

function buildExampleFromSchema(schema?: SchemaObject | ReferenceObject): unknown {
  if (!schema) return undefined;
  if (isReferenceObject(schema)) {
    const ref = schema.$ref;
    const key = ref.split("/").pop();
    const resolved = key
      ? ((openApiDocument.components as ComponentsObject | undefined)?.schemas?.[key] as SchemaObject | ReferenceObject | undefined)
      : undefined;
    if (resolved && !isReferenceObject(resolved)) {
      return buildExampleFromSchema(resolved);
    }
    return undefined;
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (!type) {
    const composed = schema.anyOf?.[0] ?? schema.oneOf?.[0] ?? schema.allOf?.[0];
    return composed ? buildExampleFromSchema(composed) : undefined;
  }
  switch (type) {
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        result[key] = buildExampleFromSchema(value);
      }
      return result;
    }
    case "array": {
      const item = buildExampleFromSchema(schema.items ?? {});
      return item === undefined ? [] : [item];
    }
    case "boolean":
      return true;
    case "number":
    case "integer":
      return 1;
    case "string":
    default:
      return "";
  }
}

function formatJson(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function methodBadge(method: string) {
  const upper = method.toUpperCase();
  const palette: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/40",
    POST: "bg-blue-500/10 text-blue-600 border-blue-500/40",
    PUT: "bg-orange-500/10 text-orange-600 border-orange-500/40",
    PATCH: "bg-amber-500/10 text-amber-700 border-amber-500/40",
    DELETE: "bg-rose-500/10 text-rose-600 border-rose-500/40",
  };
  const classes = palette[upper] ?? "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>{upper}</span>;
}

export function ApiDocsContent() {
  const operations = getOperationsByCategory();

  return (
    <div className="space-y-16">
      {categories.map((category) => {
        const entries = operations[category.id];
        if (!entries || entries.length === 0) {
          return null;
        }
        return (
          <section key={category.id} id={category.id.toLowerCase()} className="scroll-mt-32 space-y-6">
            <header className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">{category.title}</h2>
              <p className="text-sm text-muted-foreground">
                {describeCategory(category.id)}
              </p>
            </header>
            <div className="space-y-8">
              {entries.map((operation) => (
                <article key={operation.id} className="rounded-2xl border border-border/60 bg-background/80 p-6 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    {methodBadge(operation.method)}
                    <code className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/90">{operation.path}</code>
                    {operation.requiresAuth ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">
                        <span aria-hidden>🔒</span> Auth required
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{operation.summary}</h3>
                  {operation.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{operation.description}</p>
                  ) : null}

                  {operation.requestExample !== undefined ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Request example</p>
                      <pre className="rounded-lg border border-border/60 bg-muted/40 p-4 text-xs text-left text-foreground">
                        <code>{formatJson(operation.requestExample)}</code>
                      </pre>
                    </div>
                  ) : null}

                  {operation.responseExample !== undefined ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Response example</p>
                      <pre className="rounded-lg border border-border/60 bg-muted/40 p-4 text-xs text-left text-foreground">
                        <code>{formatJson(operation.responseExample)}</code>
                      </pre>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function describeCategory(id: (typeof categories)[number]["id"]) {
  switch (id) {
    case "Auth":
      return "Handle session management for secure administrative access.";
    case "Content":
      return "Serve published posts, pages, and machine-readable feeds for the Devlogia site.";
    case "Analytics":
      return "Summarise content performance and engagement metrics (requires admin session).";
    case "Uploads":
      return "Upload media assets to Supabase Storage (with a local stub fallback for development).";
    default:
      return "";
  }
}

export function ApiDocsNavigation() {
  return (
    <nav aria-label="API categories" className="sticky top-28 space-y-3">
      {categories.map((category) => (
        <a
          key={category.id}
          href={`#${category.id.toLowerCase()}`}
          className="block rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
        >
          {category.title}
        </a>
      ))}
    </nav>
  );
}

export function ApiHero() {
  const { info, servers } = openApiDocument;
  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-background p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{info.title}</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Developer API Reference</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        {info.description}
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {servers?.map((server) => (
          <Fragment key={server.url}>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1">
              <span aria-hidden>🌐</span>
              {server.url}
            </span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
