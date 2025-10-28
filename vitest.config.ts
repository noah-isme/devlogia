import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "tests/**/*.spec.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      pino: path.resolve(__dirname, "./tests/mocks/pino.ts"),
      ioredis: path.resolve(__dirname, "./tests/mocks/ioredis.ts"),
      "@supabase/supabase-js": path.resolve(__dirname, "./tests/mocks/supabase.ts"),
      "@asteasolutions/zod-to-openapi": path.resolve(__dirname, "./tests/mocks/zod-to-openapi.ts"),
    },
  },
});
