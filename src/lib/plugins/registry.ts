import {
  ExtensionRuntime,
  ExtensionSurface,
  PluginInstallStatus,
  PluginVisibility,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";

const slugSchema = z
  .string()
  .min(2)
  .max(191)
  .regex(/^[a-z0-9\-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");

const urlSchema = z.string().url().max(512);

export const pluginPublishSchema = z
  .object({
    name: z.string().min(3).max(191),
    slug: z.string().min(3).max(191).optional(),
    summary: z.string().max(512).optional(),
    description: z.string().max(4096).optional(),
    version: z.string().min(1).max(32).default("0.1.0"),
    visibility: z.nativeEnum(PluginVisibility).default(PluginVisibility.PRIVATE),
    repositoryUrl: urlSchema.optional(),
    websiteUrl: urlSchema.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    publisherTenantId: z.string().cuid().optional(),
  })
  .refine((data) => data.slug || data.name, {
    message: "Plugin requires either a slug or name",
    path: ["slug"],
  });

export type PluginPublishPayload = z.infer<typeof pluginPublishSchema>;

const pluginListOptionsSchema = z.object({
  tenantId: z.string().cuid().optional(),
  includePrivate: z.boolean().optional(),
});

export type PluginListOptions = z.infer<typeof pluginListOptionsSchema>;

const extensionRegistrationSchema = z.object({
  pluginId: z.string().cuid(),
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9\-]+$/, "Key must contain only lowercase letters, numbers, and hyphens"),
  name: z.string().min(3).max(191),
  description: z.string().max(512).optional(),
  surface: z.nativeEnum(ExtensionSurface).default(ExtensionSurface.EDITOR),
  runtime: z.nativeEnum(ExtensionRuntime).default(ExtensionRuntime.EDGE),
  entrypoint: z.string().min(1).max(512),
  configSchema: z.record(z.string(), z.any()).optional(),
  sandbox: z
    .object({
      permissions: z.array(z.string()).max(32).optional(),
      timeoutMs: z.number().int().positive().max(30_000).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  targetTenantId: z.string().cuid().optional(),
});

export type ExtensionRegistrationPayload = z.infer<typeof extensionRegistrationSchema>;

const extensionListOptionsSchema = z.object({
  tenantId: z.string().cuid().optional(),
  pluginId: z.string().cuid().optional(),
  includePrivate: z.boolean().optional(),
});

export type ExtensionListOptions = z.infer<typeof extensionListOptionsSchema>;

export type RegistryPlugin = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  version: string;
  visibility: PluginVisibility;
  repositoryUrl: string | null;
  websiteUrl: string | null;
  publisherTenantId: string | null;
  installCount: number;
  installed: boolean;
  extensions: RegistryExtension[];
};

export type RegistryExtension = {
  id: string;
  pluginId: string;
  key: string;
  name: string;
  description: string | null;
  surface: ExtensionSurface;
  runtime: ExtensionRuntime;
  entrypoint: string;
  targetTenantId: string | null;
  usageCount: number;
};

export type PluginMutationContext = {
  actorId: string;
  publisherTenantId?: string | null;
};

export type ExtensionMutationContext = PluginMutationContext;

const toJsonValue = (value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined =>
  value as Prisma.InputJsonValue | undefined;

export async function publishPlugin(payload: unknown, context: PluginMutationContext) {
  const parsed = pluginPublishSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    throw new Error("Database is not available");
  }

  const derivedSlug = slugify(parsed.slug ?? parsed.name).slice(0, 191);
  const slug = slugSchema.safeParse(derivedSlug).success ? derivedSlug : `plugin-${Date.now()}`;

  const metadata = toJsonValue(parsed.metadata);
  const plugin = await prisma.plugin.create({
    data: {
      slug,
      name: parsed.name.trim(),
      summary: parsed.summary?.trim() ?? null,
      description: parsed.description?.trim() ?? null,
      version: parsed.version,
      visibility: parsed.visibility,
      repositoryUrl: parsed.repositoryUrl ?? null,
      websiteUrl: parsed.websiteUrl ?? null,
      publisherTenantId: parsed.publisherTenantId ?? context.publisherTenantId ?? null,
      createdById: context.actorId,
      ...(metadata !== undefined ? { metadata } : {}),
    },
    include: {
      extensions: true,
      _count: { select: { installs: true } },
      installs: context.publisherTenantId
        ? { where: { tenantId: context.publisherTenantId }, select: { tenantId: true } }
        : false,
    },
  });

  return normalizePlugin(plugin, context.publisherTenantId ?? null);
}

export async function listPlugins(options: PluginListOptions = {}) {
  const parsed = pluginListOptionsSchema.parse(options);
  const tenantId = parsed.tenantId ?? null;
  const includePrivate = parsed.includePrivate ?? false;

  if (!isDatabaseEnabled) {
    return [] as RegistryPlugin[];
  }

  const visibilityFilter = includePrivate
    ? undefined
    : {
        OR: [
          { visibility: PluginVisibility.PUBLIC },
          ...(tenantId ? [{ publisherTenantId: tenantId }] : []),
        ],
      };

  const plugins = await prisma.plugin.findMany({
    where: visibilityFilter,
    include: {
      extensions: true,
      _count: { select: { installs: true } },
      ...(tenantId
        ? { installs: { where: { tenantId }, select: { tenantId: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return plugins.map((plugin) => normalizePlugin(plugin, tenantId));
}

export async function registerExtension(payload: unknown, context: ExtensionMutationContext) {
  const parsed = extensionRegistrationSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    throw new Error("Database is not available");
  }

  const plugin = await prisma.plugin.findUnique({
    where: { id: parsed.pluginId },
    select: {
      id: true,
      publisherTenantId: true,
      visibility: true,
    },
  });

  if (!plugin) {
    throw new Error("Plugin not found");
  }

  if (
    plugin.visibility !== PluginVisibility.PUBLIC &&
    plugin.publisherTenantId &&
    plugin.publisherTenantId !== (context.publisherTenantId ?? null)
  ) {
    throw new Error("Forbidden");
  }

  try {
    const configSchema = toJsonValue(parsed.configSchema);
    const sandbox = toJsonValue(parsed.sandbox);
    const metadata = toJsonValue(parsed.metadata);
    const extension = await prisma.extension.create({
      data: {
        pluginId: parsed.pluginId,
        key: slugify(parsed.key).slice(0, 64),
        name: parsed.name.trim(),
        description: parsed.description?.trim() ?? null,
        surface: parsed.surface,
        runtime: parsed.runtime,
        entrypoint: parsed.entrypoint,
        targetTenantId: parsed.targetTenantId ?? null,
        ...(configSchema !== undefined ? { configSchema } : {}),
        ...(sandbox !== undefined ? { sandboxConfig: sandbox } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
      include: { _count: { select: { usages: true } } },
    });

    return normalizeExtension(extension);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.warn({ key: parsed.key, pluginId: parsed.pluginId }, "Extension key already exists");
      throw new Error("Extension key already exists for plugin");
    }

    logger.error({ error, pluginId: parsed.pluginId }, "Failed to register extension");
    throw error;
  }
}

export async function listExtensions(options: ExtensionListOptions = {}) {
  const parsed = extensionListOptionsSchema.parse(options);
  const tenantId = parsed.tenantId ?? null;
  const includePrivate = parsed.includePrivate ?? false;

  if (!isDatabaseEnabled) {
    return [] as RegistryExtension[];
  }

  const pluginVisibilityFilter = includePrivate
    ? undefined
    : {
        OR: [
          { visibility: PluginVisibility.PUBLIC },
          ...(tenantId ? [{ publisherTenantId: tenantId }] : []),
        ],
      };

  const tenantTargetFilter = includePrivate
    ? undefined
    : {
        OR: [
          { targetTenantId: null },
          ...(tenantId ? [{ targetTenantId: tenantId }] : []),
        ],
      };

  const extensions = await prisma.extension.findMany({
    where: {
      ...(parsed.pluginId ? { pluginId: parsed.pluginId } : {}),
      ...(tenantTargetFilter ?? {}),
      plugin: pluginVisibilityFilter ? pluginVisibilityFilter : undefined,
    },
    include: {
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return extensions.map((extension) => normalizeExtension(extension));
}

export async function markPluginInstalled(
  pluginId: string,
  tenantId: string,
  actorId: string,
  status: PluginInstallStatus = PluginInstallStatus.ACTIVE,
) {
  if (!isDatabaseEnabled) {
    throw new Error("Database is not available");
  }

  const data = {
    pluginId,
    tenantId,
    status,
    installedById: actorId,
  };

  await prisma.pluginInstall.upsert({
    where: { pluginId_tenantId: { pluginId, tenantId } },
    update: { status, updatedAt: new Date() },
    create: data,
  });
}

function normalizePlugin(
  plugin: {
    id: string;
    slug: string;
    name: string;
    summary: string | null;
    description: string | null;
    version: string;
    visibility: PluginVisibility;
    repositoryUrl: string | null;
    websiteUrl: string | null;
    publisherTenantId: string | null;
    extensions: Array<{
      id: string;
      pluginId: string;
      key: string;
      name: string;
      description: string | null;
      surface: ExtensionSurface;
      runtime: ExtensionRuntime;
      entrypoint: string;
      targetTenantId: string | null;
      _count?: { usages: number };
    }>;
    _count: { installs: number };
    installs?: Array<{ tenantId: string }>;
  },
  tenantId: string | null,
): RegistryPlugin {
  return {
    id: plugin.id,
    slug: plugin.slug,
    name: plugin.name,
    summary: plugin.summary,
    description: plugin.description,
    version: plugin.version,
    visibility: plugin.visibility,
    repositoryUrl: plugin.repositoryUrl,
    websiteUrl: plugin.websiteUrl,
    publisherTenantId: plugin.publisherTenantId,
    installCount: plugin._count.installs,
    installed: Boolean(tenantId && plugin.installs?.some((install) => install.tenantId === tenantId)),
    extensions: plugin.extensions.map((extension) => ({
      id: extension.id,
      pluginId: extension.pluginId,
      key: extension.key,
      name: extension.name,
      description: extension.description,
      surface: extension.surface,
      runtime: extension.runtime,
      entrypoint: extension.entrypoint,
      targetTenantId: extension.targetTenantId,
      usageCount: extension._count?.usages ?? 0,
    })),
  };
}

function normalizeExtension(
  extension: {
    id: string;
    pluginId: string;
    key: string;
    name: string;
    description: string | null;
    surface: ExtensionSurface;
    runtime: ExtensionRuntime;
    entrypoint: string;
    targetTenantId: string | null;
    _count?: { usages: number };
  },
): RegistryExtension {
  return {
    id: extension.id,
    pluginId: extension.pluginId,
    key: extension.key,
    name: extension.name,
    description: extension.description,
    surface: extension.surface,
    runtime: extension.runtime,
    entrypoint: extension.entrypoint,
    targetTenantId: extension.targetTenantId,
    usageCount: extension._count?.usages ?? 0,
  };
}
