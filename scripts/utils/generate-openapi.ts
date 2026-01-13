import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { openApiDocument } from "@/lib/openapi/document";
import { stringify } from "yaml";

const outputPath = resolve(process.cwd(), "openapi.yaml");
const yaml = stringify(openApiDocument, { lineWidth: 120 });

writeFileSync(outputPath, yaml, "utf8");
console.log(`✅ openapi.yaml generated at ${outputPath}`);
