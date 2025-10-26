import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.startsWith("fake://")) {
  console.error("[verify-seed] Invalid DATABASE_URL:", databaseUrl ?? "<undefined>");
  process.exit(1);
}

const prisma = new PrismaClient();

const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
const editorEmail = process.env.SEED_EDITOR_EMAIL ?? "editor@devlogia.test";
const writerEmail = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";

const expectedUsers = [
  { email: ownerEmail, role: "owner" },
  { email: editorEmail, role: "editor" },
  { email: writerEmail, role: "writer" },
] as const;

async function main() {
  console.log("[verify-seed] Using DATABASE_URL:", databaseUrl);

  const users = await prisma.user.findMany({
    where: { email: { in: expectedUsers.map((user) => user.email) } },
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });

  const normalizedUsers = new Map(
    users.map((user) => [user.email.toLowerCase(), user.role?.toLowerCase()]),
  );

  const missing = expectedUsers.filter((expected) => {
    const role = normalizedUsers.get(expected.email.toLowerCase());
    return role !== expected.role;
  });

  if (missing.length > 0) {
    console.error("[verify-seed] Missing or mismatched users:", missing);
    console.error("[verify-seed] Users found:", users);
    process.exit(1);
  }

  console.log("[verify-seed] Seeded users:", users);
}

main()
  .catch((error) => {
    console.error("[verify-seed] Failed to verify seeded users:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
