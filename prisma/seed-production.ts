import bcrypt from "bcrypt";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

function requireProductionSeedConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const parsedDatabaseUrl = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname)) {
    throw new Error(
      "Refusing production seed because DATABASE_URL points to a local host",
    );
  }

  if (!email || email.endsWith(".test")) {
    throw new Error(
      "SEED_SUPERADMIN_EMAIL must be a non-test production email",
    );
  }

  if (password.length < 16 || ["owner123", "admin123"].includes(password)) {
    throw new Error(
      "SEED_SUPERADMIN_PASSWORD must contain at least 16 characters and must not use a test default",
    );
  }

  return { email, password };
}

async function main() {
  const { email, password } = requireProductionSeedConfig();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { name: RoleName.SUPERADMIN },
      update: { description: "Full control over Devlogia" },
      create: {
        name: RoleName.SUPERADMIN,
        description: "Full control over Devlogia",
      },
    });

    const user = await tx.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { email, passwordHash, isActive: true },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  });

  console.log(`Production superadmin is ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
