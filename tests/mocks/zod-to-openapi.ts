export class OpenAPIRegistry {
  components: Record<string, Record<string, unknown>> = {};
  paths: Record<string, Record<string, unknown>> = {};
  definitions: this;

  constructor() {
    this.definitions = this;
  }

  registerComponent(type: string, name: string, component: unknown) {
    if (!this.components[type]) {
      this.components[type] = {};
    }
    this.components[type][name] = component;
    return component;
  }

  register<T>(_name: string, schema: T): T {
    return schema;
  }

  registerPath(route: { method: string; path: string } & Record<string, unknown>) {
    const method = route.method.toLowerCase();
    if (!this.paths[route.path]) {
      this.paths[route.path] = {};
    }
    this.paths[route.path][method] = route;
  }
}

export class OpenApiGeneratorV31 {
  constructor(private registry: OpenAPIRegistry) {}

  generateDocument(options?: Record<string, unknown>) {
    return {
      openapi: "3.1.0",
      info: { title: "Mock", version: "1.0.0" },
      paths: this.registry?.paths ?? {},
      components: this.registry?.components ?? {},
      ...(options ?? {}),
    };
  }
}

export const extendZodWithOpenApi = (z: { ZodType?: { prototype: Record<string, unknown> } }) => {
  if (z?.ZodType && typeof z.ZodType.prototype === "object") {
    (z.ZodType.prototype as Record<string, unknown>).openapi = function openapi() {
      return this;
    };
  }
};
