import { NextResponse } from "next/server";

import { fetchSchemaState, getVersionMetadata } from "@/lib/version";

export async function GET() {
  const version = getVersionMetadata();
  const schema = await fetchSchemaState();

  return NextResponse.json(
    {
      version,
      schema,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
