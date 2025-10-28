import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  configureStorage,
  createSignedUrl,
  getObjectMetadata,
  removeObject,
  uploadBuffer,
} from "@/lib/storage";

let originalEnv: NodeJS.ProcessEnv;

beforeAll(() => {
  originalEnv = { ...process.env };
});

afterEach(async () => {
  process.env = { ...originalEnv };
  configureStorage({});
});

describe("storage", () => {
  test("uploadBuffer writes to stub directory with metadata", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "devlogia-storage-"));
    configureStorage({
      supabaseUrl: "",
      supabaseBucket: "",
      supabaseServiceRoleKey: "",
      localUploadDir: tmpDir,
    });

    const buffer = Buffer.from("hello world");
    const result = await uploadBuffer(buffer, "hello.txt", "text/plain");

    expect(result.provider).toBe("stub");
    expect(result.mimeType).toBe("text/plain");
    expect(result.sizeBytes).toBe(buffer.byteLength);
    expect(result.publicUrl).toContain("/uploads/");

    const storedPath = path.join(tmpDir, result.path.replace(/^uploads\//, ""));
    const fileContent = await readFile(storedPath, "utf8");
    expect(fileContent).toBe("hello world");

    const metadata = await getObjectMetadata(result.path);
    expect(metadata?.name).toBe(path.basename(storedPath));
    expect(metadata?.size).toBe(buffer.byteLength);

    const signedUrl = await createSignedUrl(result.path, 60);
    expect(signedUrl).toContain("/uploads/");

    await removeObject(result.path);
    await expect(stat(storedPath)).rejects.toThrow();

    await rm(tmpDir, { recursive: true, force: true });
  });
});
