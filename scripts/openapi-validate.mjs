import path from "node:path";

import SwaggerParser from "@apidevtools/swagger-parser";

async function main() {
  const file = path.resolve(process.cwd(), "openapi.yaml");
  try {
    await SwaggerParser.validate(file);
    console.log(`[openapi:validate] ${file} is valid`);
  } catch (error) {
    console.error(`[openapi:validate] Validation failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

main();
