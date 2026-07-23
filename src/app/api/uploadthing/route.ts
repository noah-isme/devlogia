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
      configureStorage({ supabaseUrl: "", supabaseBucket: "", supabaseSecretKey: "" });
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

  let buffer: Buffer;
  let originalName: string;
  let mimeType: string | undefined;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    const imageUrl = typeof json.url === "string" ? json.url.trim() : "";

    if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
      return NextResponse.json({ error: "Valid HTTP/HTTPS image URL is required" }, { status: 400 });
    }

    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        return NextResponse.json({ error: `Failed to fetch image from URL: ${res.statusText}` }, { status: 400 });
      }

      const fetchedBlob = await res.blob();
      buffer = Buffer.from(await fetchedBlob.arrayBuffer());
      mimeType = fetchedBlob.type || "image/jpeg";
      
      const parsedUrl = new URL(imageUrl);
      const pathnameName = parsedUrl.pathname.split("/").pop();
      originalName = pathnameName && pathnameName.includes(".") ? pathnameName : "imported-image.jpg";
    } catch (err) {
      logger.error({ err }, `Failed to import image from URL: ${imageUrl}`);
      return NextResponse.json({ error: "Failed to download image from URL" }, { status: 400 });
    }
  } else {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data or JSON body" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file in upload form" }, { status: 400 });
    }

    const asFile = file as File;
    originalName = typeof asFile.name === "string" && asFile.name ? asFile.name : "upload.bin";
    mimeType = asFile.type;
    buffer = Buffer.from(await asFile.arrayBuffer());
  }

  const altText = normalizeFileName(originalName);

  try {
    const uploadResult = await uploadWithFallback(buffer, originalName, mimeType);

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
