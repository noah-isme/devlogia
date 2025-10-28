import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

export type UploadResult = {
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  publicUrl: string;
  provider: "supabase" | "stub";
};

export type StorageConfig = {
  supabaseUrl: string;
  supabaseBucket: string;
  supabaseServiceRoleKey: string;
  localUploadDir: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
};

const defaultConfig: StorageConfig = {
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseBucket:
    process.env.SUPABASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  localUploadDir: process.env.LOCAL_UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads"),
  maxFileSizeBytes:
    Number.parseInt(process.env.SUPABASE_MAX_FILE_SIZE_MB ?? "10", 10) * 1024 * 1024 || 10 * 1024 * 1024,
  allowedMimeTypes: (process.env.SUPABASE_ALLOWED_MIME_TYPES ?? "image/*,video/*,audio/*,application/pdf,text/plain")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

let supabaseClient: SupabaseClient | null = null;
let cachedConfig = defaultConfig;

export function configureStorage(overrides: Partial<StorageConfig> = {}) {
  cachedConfig = { ...defaultConfig, ...overrides };
  supabaseClient = null;
}

export function getStorageConfig(): StorageConfig {
  return cachedConfig;
}

export function isSupabaseStorageEnabled() {
  const config = getStorageConfig();
  return Boolean(config.supabaseUrl && config.supabaseBucket && config.supabaseServiceRoleKey);
}

function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseStorageEnabled()) {
    throw new Error("Supabase storage is not fully configured");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(cachedConfig.supabaseUrl, cachedConfig.supabaseServiceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "devlogia-storage" } },
    });
  }

  return supabaseClient;
}

function buildObjectPath(filename: string) {
  const sanitized = filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const extension = sanitized.split(".").pop() ?? "bin";
  const now = new Date();
  const directory = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  return `uploads/${directory}/${randomUUID()}.${extension}`;
}

async function ensureLocalDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function inferMimeType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension) {
    return "application/octet-stream";
  }

  const lookup: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    pdf: "application/pdf",
    txt: "text/plain",
  };

  return lookup[extension] ?? "application/octet-stream";
}

function isMimeAllowed(mimeType: string, allowed: string[]) {
  const [type, subtype] = mimeType.toLowerCase().split("/");
  if (!type || !subtype) {
    return false;
  }

  return allowed.some((pattern) => {
    if (pattern === "*") {
      return true;
    }
    const [allowedType, allowedSubType] = pattern.split("/");
    if (!allowedType) {
      return false;
    }
    if (allowedType === "*") {
      return true;
    }
    if (allowedType !== type) {
      return false;
    }
    if (!allowedSubType || allowedSubType === "*") {
      return true;
    }
    return allowedSubType === subtype;
  });
}

function validateUpload(buffer: Buffer, filename: string, mimeType: string, config: StorageConfig) {
  if (!filename || !filename.trim()) {
    throw new Error("Filename is required for uploads");
  }

  if (buffer.byteLength > config.maxFileSizeBytes) {
    throw new Error(
      `File exceeds maximum size of ${Math.round(config.maxFileSizeBytes / (1024 * 1024))}MB`,
    );
  }

  if (!isMimeAllowed(mimeType, config.allowedMimeTypes)) {
    throw new Error(`Mime type ${mimeType} is not permitted`);
  }
}

export async function uploadBuffer(buffer: Buffer, filename: string, mimeType?: string): Promise<UploadResult> {
  const config = getStorageConfig();
  const resolvedMimeType = mimeType && mimeType.trim() ? mimeType : inferMimeType(filename || "upload.bin");
  validateUpload(buffer, filename, resolvedMimeType, config);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const objectPath = buildObjectPath(filename || "upload.bin");

  if (isSupabaseStorageEnabled()) {
    const client = getSupabaseClient();
    const upload = await client.storage.from(config.supabaseBucket).upload(objectPath, buffer, {
      contentType: resolvedMimeType,
      upsert: false,
    });

    if (upload.error) {
      logger.error({ err: upload.error, objectPath }, "Supabase upload failed");
      throw upload.error;
    }

    const { data } = client.storage.from(config.supabaseBucket).getPublicUrl(objectPath);

    return {
      path: objectPath,
      mimeType: resolvedMimeType,
      sizeBytes: buffer.byteLength,
      checksum,
      publicUrl: data.publicUrl,
      provider: "supabase",
    };
  }

  const targetPath = path.join(config.localUploadDir, objectPath.replace(/^uploads\//, ""));
  const targetDir = path.dirname(targetPath);
  await ensureLocalDir(targetDir);
  await writeFile(targetPath, buffer);

  return {
    path: objectPath,
    mimeType: resolvedMimeType,
    sizeBytes: buffer.byteLength,
    checksum,
    publicUrl: `/uploads/${objectPath.split("/").slice(1).join("/")}`,
    provider: "stub",
  };
}

export async function removeObject(objectPath: string) {
  const config = getStorageConfig();

  if (!objectPath) {
    return;
  }

  if (isSupabaseStorageEnabled()) {
    const client = getSupabaseClient();
    const result = await client.storage.from(config.supabaseBucket).remove([objectPath]);
    if (result.error) {
      logger.warn({ err: result.error, objectPath }, "Failed to remove Supabase object");
    }
    return;
  }

  const targetPath = path.join(config.localUploadDir, objectPath.replace(/^uploads\//, ""));
  try {
    await rm(targetPath, { force: true });
  } catch (error) {
    logger.warn({ err: error, objectPath }, "Failed to remove local object");
  }
}

export async function createSignedUrl(objectPath: string, expiresInSeconds: number) {
  const config = getStorageConfig();

  if (!objectPath) {
    throw new Error("Object path is required");
  }

  if (isSupabaseStorageEnabled()) {
    const client = getSupabaseClient();
    const result = await client.storage.from(config.supabaseBucket).createSignedUrl(objectPath, expiresInSeconds);
    if (result.error) {
      throw result.error;
    }
    return result.data.signedUrl;
  }

  // Stub storage exposes files publicly, so just return the public URL.
  return `/uploads/${objectPath.split("/").slice(1).join("/")}`;
}

export async function getObjectMetadata(objectPath: string) {
  const config = getStorageConfig();

  if (!objectPath) {
    throw new Error("Object path is required");
  }

  if (isSupabaseStorageEnabled()) {
    const client = getSupabaseClient();
    const result = await client.storage.from(config.supabaseBucket).list(objectPath.split("/").slice(0, -1).join("/"), {
      search: objectPath.split("/").pop(),
      limit: 1,
    });
    if (result.error) {
      throw result.error;
    }
    const match = result.data.find((entry) => entry.name === objectPath.split("/").pop());
    return match ?? null;
  }

  const targetPath = path.join(config.localUploadDir, objectPath.replace(/^uploads\//, ""));
  try {
    const fileStat = await stat(targetPath);
    return { name: path.basename(targetPath), size: fileStat.size, updated_at: fileStat.mtime.toISOString() };
  } catch (error) {
    logger.warn({ err: error, objectPath }, "Failed to read local metadata");
    return null;
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export type StorageHealthStatus =
  | { provider: "supabase" | "stub"; status: "ok" }
  | { provider: "supabase" | "stub"; status: "error"; error: Error };

export async function storageHealthCheck(): Promise<StorageHealthStatus> {
  const config = getStorageConfig();

  if (isSupabaseStorageEnabled()) {
    try {
      const client = getSupabaseClient();
      const response = await client.storage.from(config.supabaseBucket).list("", { limit: 1 });
      if (response.error) {
        throw response.error;
      }
      return { provider: "supabase" as const, status: "ok" as const };
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error({ err: normalized }, "Supabase storage health check failed");
      return { provider: "supabase", status: "error", error: normalized };
    }
  }

  try {
    await ensureLocalDir(config.localUploadDir);
    return { provider: "stub", status: "ok" };
  } catch (error) {
    const normalized = normalizeError(error);
    logger.error({ err: normalized }, "Local storage health check failed");
    return { provider: "stub", status: "error", error: normalized };
  }
}
