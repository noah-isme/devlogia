import { NextResponse } from "next/server";

import { openApiDocument } from "@/lib/openapi/document";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(openApiDocument, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
