import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawDatabaseUrl = process.env.DATABASE_URL ?? "fake://stub";
const fallbackDatasourceUrl = "postgresql://stub:stub@127.0.0.1:6543/devlogia_static?schema=public";
const datasourceUrl = rawDatabaseUrl.startsWith("fake://") ? fallbackDatasourceUrl : rawDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: datasourceUrl,
  },
});
