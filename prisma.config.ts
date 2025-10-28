import "dotenv/config";
import { defineConfig } from "prisma/config";

const rawDatabaseUrl = process.env.DATABASE_URL ?? "fake://stub";
const fallbackDatasourceUrl = "mysql://stub:stub@127.0.0.1:3306/devlogia_static";
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
