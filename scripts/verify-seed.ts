import { PrismaClient } from "@prisma/client";

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
    process.exitCode = 1;
    return;
  }

  console.log(
    "[verify-seed] Seeded users:",
    expectedUsers.map((user) => user.email).join(", "),
  );
}

main()
  .catch((error) => {
    console.error("[verify-seed] Failed to verify seeded users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
