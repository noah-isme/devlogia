import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated and local runtime artifacts:
    "node_modules/**",
    "packages/*/node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/uploads/**",
    ".qwen/**",
    ".omo/**",
  ]),
]);

export default eslintConfig;
