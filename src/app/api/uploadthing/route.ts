import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PROVIDER = "stub";

function getCloudConfig() {
  return {
    provider: process.env.UPLOADTHING_PROVIDER ?? DEFAULT_PROVIDER,
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.S3_REGION ?? "",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
    endpoint: process.env.S3_ENDPOINT ?? "",
    publicUrl: process.env.S3_PUBLIC_URL ?? "",
  };
}

function buildFileKey(originalName: string) {
  const extension = originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  const date = new Date();
  const directory = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return `uploads/${directory}/${crypto.randomUUID()}.${extension}`;
}

async function handleStubUpload(sessionUserId: string, file: File, altText: string) {
  const fakePath = `/uploads/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "png"}`;

  const media = await prisma.media.create({
    data: {
      url: fakePath,
      alt: altText,
      ownerId: sessionUserId,
    },
    select: { id: true, url: true, alt: true, createdAt: true },
  });

  return NextResponse.json({
    success: true,
    files: [
      {
        id: media.id,
        url: media.url,
        alt: media.alt,
        createdAt: media.createdAt,
      },
    ],
    provider: DEFAULT_PROVIDER,
  });
}

async function uploadToS3(config: ReturnType<typeof getCloudConfig>, key: string, file: File) {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  const body = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: file.type || "application/octet-stream",
    }),
  );
}

function resolvePublicUrl(config: ReturnType<typeof getCloudConfig>, key: string) {
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

export async function POST(request: Request) {
  const config = getCloudConfig();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const altText = originalName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded media";

  const hasCloudCredentials =
    config.provider !== DEFAULT_PROVIDER && config.bucket && config.region && config.accessKey && config.secretKey;

  if (!hasCloudCredentials) {
    return handleStubUpload(session.user.id, asFile, altText);
  }

  try {
    const key = buildFileKey(originalName);
    await uploadToS3(config, key, asFile);

    const media = await prisma.media.create({
      data: {
        url: resolvePublicUrl(config, key),
        alt: altText,
        ownerId: session.user.id,
      },
      select: { id: true, url: true, alt: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      files: [
        {
          id: media.id,
          url: media.url,
          alt: media.alt,
          createdAt: media.createdAt,
        },
      ],
      provider: config.provider,
    });
  } catch (error) {
    console.error("Cloud upload failed, falling back to stub", error);
    return handleStubUpload(session.user.id, asFile, altText);
  }
}
