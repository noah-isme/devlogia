import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const queryMock = vi.fn();
const schemaMock = vi.fn(async () => ({ version: "2024-01-01", pending: 0 }));
const loggerError = vi.fn();

const dbState = { enabled: true };

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    $queryRawUnsafe: queryMock,
  },
}));

vi.mock("@/lib/version", () => ({
  fetchSchemaState: schemaMock,
}));

describe("/api/ready", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "false";
    dbState.enabled = true;
    queryMock.mockReset();
    queryMock.mockResolvedValue(undefined);
    schemaMock.mockReset();
    schemaMock.mockResolvedValue({ version: "2024-01-01", pending: 0 });
    loggerError.mockClear();
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
  });

  test("fails when maintenance mode active", async () => {
    process.env.MAINTENANCE_MODE = "true";
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ready"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.checks.maintenance.status).toBe("fail");
  });

  test("fails when migrations pending", async () => {
    schemaMock.mockResolvedValueOnce({ version: "2024-02-01", pending: 2 });
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ready"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.checks.database.details.pendingMigrations).toBe(2);
  });

  test("skips database when disabled", async () => {
    dbState.enabled = false;
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/ready"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checks.database.status).toBe("skip");
  });
});
