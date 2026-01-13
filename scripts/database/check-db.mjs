import net from "node:net";
import { URL, pathToFileURL } from "node:url";

function resolveConnectionTarget() {
  const fallbackPort = 5432;
  let host = process.env.POSTGRES_HOST || process.env.DB_HOST;
  let port = Number(process.env.POSTGRES_PORT || process.env.DB_PORT) || undefined;

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      host = host || parsed.hostname;
      port = port || Number(parsed.port);
    } catch (error) {
      console.warn(`[Devlogia] Unable to parse DATABASE_URL: ${error instanceof Error ? error.message : error}`);
    }
  }

  return {
    host: host || "localhost",
    port: port || fallbackPort,
  };
}

export function checkDatabaseConnection(timeoutMs = 1500) {
  const { host, port } = resolveConnectionTarget();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const close = (result) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ ok: result, host, port });
      }
    };

    socket.setTimeout(timeoutMs, () => {
      console.warn(`[Devlogia] Connection to ${host}:${port} timed out after ${timeoutMs}ms.`);
      close(false);
    });

    socket.once("error", () => {
      close(false);
    });

    socket.connect(port, host, () => {
      close(true);
    });
  });
}

async function runCli() {
  const { ok, host, port } = await checkDatabaseConnection();

  if (ok) {
    console.log(`✅ PostgreSQL is reachable at ${host}:${port}.`);
  } else {
    console.warn("⚠️  PostgreSQL is not reachable. Start it with 'pnpm db:up' before running Playwright tests.");
  }

  process.exit(0);
}

const executedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;

if (executedDirectly) {
  runCli();
}
