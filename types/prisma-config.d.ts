declare module "prisma/config" {
  type EngineType = "classic" | "prisma" | (string & {});

  interface DatasourceConfig {
    url: string;
  }

  interface MigrationConfig {
    path?: string;
  }

  interface PrismaConfig {
    schema?: string;
    datasource?: DatasourceConfig;
    migrations?: MigrationConfig;
    engine?: EngineType;
  }

  export function defineConfig(config: PrismaConfig): PrismaConfig;
  export function env(key: string): string;
}
