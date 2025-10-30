import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import YAML from "yaml";

let cachedSchema: unknown;

async function loadSchema() {
  if (cachedSchema) {
    return cachedSchema;
  }

  const filePath = path.join(process.cwd(), "openapi.yaml");
  const file = await readFile(filePath, "utf8");
  cachedSchema = YAML.parse(file);
  return cachedSchema;
}

export async function GET() {
  try {
    const schema = await loadSchema();
    return NextResponse.json(schema);
  } catch (error) {
    console.error("Failed to load OpenAPI schema", error);
    return NextResponse.json({ error: "Unable to load schema" }, { status: 500 });
  }
}
