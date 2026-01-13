import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=");
    if (key && value) {
      args[key.replace(/^--/, "")] = value;
    }
  }
  return args;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 191);
}

async function main() {
  const { tenant, owner, name = "Collaboration Workspace" } = parseArgs();
  if (!tenant || !owner) {
    throw new Error("Usage: pnpm workspace:seed --tenant=<tenantId> --owner=<userId> [--name=Workspace]");
  }

  const workspace = await prisma.workspace.create({
    data: {
      tenantId: tenant,
      name,
      slug: slugify(name),
      createdBy: owner,
      members: {
        create: {
          userId: owner,
          role: "OWNER",
        },
      },
    },
  });

  console.log("Created workspace", workspace.id, "for tenant", tenant);
}

main()
  .catch((error) => {
    console.error("Failed to seed workspace", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
