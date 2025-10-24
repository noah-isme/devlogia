import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const provider = process.env.UPLOADER_PROVIDER ?? "stub";

  if (provider !== "stub") {
    return NextResponse.json({ error: "Upload provider not configured." }, { status: 503 });
  }

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
  const originalName = typeof asFile.name === "string" && asFile.name ? asFile.name : "upload.png";
  const extensionMatch = originalName.split(".").pop();
  const normalizedExtension = extensionMatch?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const fakePath = `/uploads/${crypto.randomUUID()}.${normalizedExtension}`;
  const altText = originalName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded media";

  try {
    const media = await prisma.media.create({
      data: {
        url: fakePath,
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
    });
  } catch (error) {
    console.error("Upload stub failed", error);
    return NextResponse.json({ error: "Unable to persist media" }, { status: 500 });
  }
}
