import { NextResponse } from "next/server";

export async function POST() {
  const provider = process.env.UPLOADER_PROVIDER ?? "stub";

  if (provider !== "stub") {
    return NextResponse.json({ error: "Upload provider not configured." }, { status: 503 });
  }

  const fakeUrl = `/uploads/${Date.now()}.png`;

  return NextResponse.json({
    success: true,
    files: [{ url: fakeUrl }],
  });
}
