import { NextResponse } from "next/server";

import type { PrismaClient } from "@prisma/client";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { configureStorage, getStorageConfig, isSupabaseStorageEnabled, uploadBuffer } from "@/lib/storage";

function normalizeFileName(originalName: string) {
  return originalName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded media";
}

async function persistMedia(
  prisma: PrismaClient,
  data: {
    path: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    publicUrl: string;
    alt: string;
    ownerId: string;
  },
) {
  return prisma.media.create({
    data,
    select: {
      id: true,
      path: true,
      mimeType: true,
      sizeBytes: true,
      checksum: true,
      publicUrl: true,
      alt: true,
      createdAt: true,
    },
  });
}

async function uploadWithFallback(buffer: Buffer, filename: string, mimeType: string | undefined) {
  const originalConfig = getStorageConfig();

  try {
    return await uploadBuffer(buffer, filename, mimeType);
  } catch (error) {
    if (isSupabaseStorageEnabled()) {
      logger.error({ err: error }, "Supabase upload failed, switching to stub storage");
      configureStorage({ supabaseUrl: "", supabaseBucket: "", supabaseServiceRoleKey: "" });
      try {
        return await uploadBuffer(buffer, filename, mimeType);
      } finally {
        configureStorage(originalConfig);
      }
    }

    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const asFile = file as File;
  const originalName = typeof asFile.name === "string" && asFile.name ? asFile.name : "upload.bin";
  const altText = normalizeFileName(originalName);

  const buffer = Buffer.from(await asFile.arrayBuffer());

  try {
    const uploadResult = await uploadWithFallback(buffer, originalName, asFile.type);

    const media = await persistMedia(prisma, {
      path: uploadResult.path,
      mimeType: uploadResult.mimeType,
      sizeBytes: uploadResult.sizeBytes,
      checksum: uploadResult.checksum,
      publicUrl: uploadResult.publicUrl,
      alt: altText,
      ownerId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      files: [
        {
          id: media.id,
          url: media.publicUrl,
          path: media.path,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          checksum: media.checksum,
          alt: media.alt,
          createdAt: media.createdAt,
        },
      ],
      provider: uploadResult.provider,
    });
  } catch (error) {
    logger.error({ err: error }, "Upload failed");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
