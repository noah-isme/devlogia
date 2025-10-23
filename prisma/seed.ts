import bcrypt from "bcrypt";
import { PrismaClient, PostStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@devlogia.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: "admin",
    },
  });

  const helloWorldPost = await prisma.post.upsert({
    where: { slug: "hello-world" },
    update: {},
    create: {
      title: "Hello World",
      slug: "hello-world",
      summary: "Welcome to Devlogia, a modern MDX-first CMS for developers.",
      contentMdx: `# Hello World\n\nThis is your first post inside **Devlogia**.\n\n- Customize this post in the admin dashboard\n- Manage draft or published status\n- Write using MDX components`,
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
    },
  });

  await prisma.page.upsert({
    where: { slug: "about" },
    update: {},
    create: {
      title: "About",
      slug: "about",
      contentMdx:
        "# About Devlogia\n\nDevlogia is a focused writing experience for developers who love shipping fast.",
      published: true,
    },
  });

  console.log(`Seed completed. Admin credentials: ${adminEmail} / ${adminPassword}`);
  console.log(`Sample post created: ${helloWorldPost.title}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
