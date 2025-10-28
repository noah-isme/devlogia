import bcrypt from "bcrypt";
import { PrismaClient, PostStatus, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureRole(name: RoleName, description: string) {
  await prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

async function upsertUser(email: string, password: string, role: RoleName) {
  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.toLowerCase();

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      isActive: true,
      roles: {
        deleteMany: {},
        create: { role: { connect: { name: role } } },
      },
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      isActive: true,
      roles: {
        create: { role: { connect: { name: role } } },
      },
    },
  });
}

async function main() {
  await Promise.all([
    ensureRole(RoleName.SUPERADMIN, "Full control over Devlogia"),
    ensureRole(RoleName.TENANTADMIN, "Manage a single tenant including billing and members"),
    ensureRole(RoleName.ADMIN, "Manage content and system settings"),
    ensureRole(RoleName.EDITOR, "Edit all posts and pages"),
    ensureRole(RoleName.WRITER, "Draft and manage own posts"),
    ensureRole(RoleName.VIEWER, "Read-only access to dashboards and insights"),
  ]);

  const superadminEmail =
    process.env.SEED_SUPERADMIN_EMAIL ?? process.env.SEED_OWNER_EMAIL ?? "owner@devlogia.test";
  const superadminPassword =
    process.env.SEED_SUPERADMIN_PASSWORD ?? process.env.SEED_OWNER_PASSWORD ?? "owner123";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@devlogia.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const editorEmail = process.env.SEED_EDITOR_EMAIL ?? "editor@devlogia.test";
  const editorPassword = process.env.SEED_EDITOR_PASSWORD ?? "editor123";
  const writerEmail = process.env.SEED_WRITER_EMAIL ?? "writer@devlogia.test";
  const writerPassword = process.env.SEED_WRITER_PASSWORD ?? "writer123";
  const tenantAdminEmail = process.env.SEED_TENANT_ADMIN_EMAIL ?? "tenantadmin@devlogia.test";
  const tenantAdminPassword = process.env.SEED_TENANT_ADMIN_PASSWORD ?? "tenantadmin123";
  const viewerEmail = process.env.SEED_VIEWER_EMAIL ?? "viewer@devlogia.test";
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "viewer123";

  const superadmin = await upsertUser(superadminEmail, superadminPassword, RoleName.SUPERADMIN);
  await Promise.all([
    upsertUser(tenantAdminEmail, tenantAdminPassword, RoleName.TENANTADMIN),
    upsertUser(adminEmail, adminPassword, RoleName.ADMIN),
    upsertUser(editorEmail, editorPassword, RoleName.EDITOR),
    upsertUser(writerEmail, writerPassword, RoleName.WRITER),
    upsertUser(viewerEmail, viewerPassword, RoleName.VIEWER),
  ]);

  const tags = [
    { name: "Next.js", slug: "nextjs" },
    { name: "TypeScript", slug: "typescript" },
    { name: "Prisma", slug: "prisma" },
    { name: "DevOps", slug: "devops" },
    { name: "Product", slug: "product" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: tag,
    });
  }

  const now = Date.now();
  const postsSeed = [
    {
      slug: "hello-world",
      title: "Hello World",
      summary: "Welcome to Devlogia, a modern MDX-first CMS for developers.",
      contentMdx: `# Hello World\n\nThis is your first post inside **Devlogia**.\n\n- Customize this post in the admin dashboard\n- Manage draft or published status\n- Write using MDX components`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 1,
      tags: ["nextjs", "typescript"],
    },
    {
      slug: "nextjs-edge-rendering",
      title: "Deploying Edge Rendering with Next.js 16",
      summary: "A production-ready checklist for shipping on the edge.",
      contentMdx: `# Edge rendering in practice\n\n## Why edge?\nEdge runtimes remove cold-starts and unlock global first-byte performance.\n\n## Observability\nInstrumenting observability is critical when you move to the edge.\n\n### Metrics to capture\n- cache hit rate\n- request latency\n- error boundaries`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 2,
      tags: ["nextjs", "devops"],
    },
    {
      slug: "prisma-optimizing-queries",
      title: "Optimizing Prisma queries for large deployments",
      summary: "Connection pooling, prepared statements, and log-driven tuning.",
      contentMdx: `# Scaling Prisma\n\n## Connection management\nUse PgBouncer or Prisma Accelerate to reuse connections.\n\n## Observing slow queries\nLog slow queries and correlate with API traces.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 3,
      tags: ["prisma", "devops"],
    },
    {
      slug: "designing-analytics-for-privacy",
      title: "Designing privacy-first analytics",
      summary: "Respecting user choice while keeping product telemetry useful.",
      contentMdx: `# Privacy-first analytics\n\n## Principles\nUsers deserve respectful defaults and transparency.\n\n## Implementation\nUse tools that respect DNT headers and avoid fingerprinting.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 4,
      tags: ["product"],
    },
    {
      slug: "mdx-authoring-workflows",
      title: "Authoring workflows that keep MDX fast",
      summary: "Autosave, sync, and linting strategies that scale with your team.",
      contentMdx: `# MDX authoring workflows\n\n## Autosave\nPersist drafts locally before sending them to the server.\n\n## Collaboration\nLeverage CRDTs or review apps for distributed teams.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 5,
      tags: ["typescript", "product"],
    },
    {
      slug: "playwright-e2e-checklist",
      title: "A resilient Playwright E2E checklist",
      summary: "Nine tactics for reliable browser automation in CI.",
      contentMdx: `# Playwright checklist\n\n## Keep fixtures lean\nMock what you must, seed the rest.\n\n## Prefer semantic locators\nTarget labels and roles to keep tests accessible.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 6,
      tags: ["devops"],
    },
    {
      slug: "seo-strategy-for-developers",
      title: "SEO strategy for developer-focused content",
      summary: "Metadata, structured data, and automation tips for engineers.",
      contentMdx: `# SEO for developers\n\n## Canonicals\nEnsure every page declares its canonical URL.\n\n## Automation\nGenerate sitemaps and RSS feeds on deploy.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 7,
      tags: ["product"],
    },
    {
      slug: "tailwind-accessibility",
      title: "Accessibility-first Tailwind patterns",
      summary: "Focus rings, skip links, and color systems that hold up.",
      contentMdx: `# Accessibility first\n\n## Focus styles\nNever remove outlines—design them.\n\n## Skip links\nGive keyboard users a fast lane to content.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 8,
      tags: ["product"],
    },
    {
      slug: "postgres-search-playbook",
      title: "Postgres full-text search playbook",
      summary: "From tsvector migrations to ranking with ts_rank.",
      contentMdx: `# Postgres search\n\n## Tokenization\nChoose dictionaries that match your domain.\n\n## Ranking\nCombine recency with lexical relevance.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 9,
      tags: ["prisma"],
    },
    {
      slug: "content-ops-for-solo-creators",
      title: "Content ops for solo technical creators",
      summary: "Templates and automation that remove overhead.",
      contentMdx: `# Content ops\n\n## Templates\nAutomate your post skeletons with MDX components.\n\n## Distribution\nBatch schedule posts and repurpose highlights.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 10,
      tags: ["product"],
    },
    {
      slug: "edge-cache-strategies",
      title: "Edge cache strategies that scale",
      summary: "Designing caching layers for global applications.",
      contentMdx: `# Edge cache strategies\n\n## Layered caching\nPair CDN caches with application-aware revalidation.\n\n## Purge policies\nAutomate purges with build metadata and webhooks.`,
      status: PostStatus.PUBLISHED,
      publishedAtOffset: 11,
      tags: ["nextjs", "devops"],
    },
    {
      slug: "scheduling-content-with-cron",
      title: "Scheduling content with modern cron tooling",
      summary: "Reliable scheduling for newsletters and post publishing.",
      contentMdx: `# Scheduling content\n\n## Managed cron\nUse managed schedulers with retries and monitoring.\n\n## Feature toggles\nWrap scheduled posts with feature flags to test safely.`,
      status: PostStatus.SCHEDULED,
      publishedAtOffset: -3,
      tags: ["devops"],
    },
    {
      slug: "ideas-backlog",
      title: "Ideas backlog",
      summary: "Upcoming experiments and questions for the community.",
      contentMdx: `# Ideas backlog\n\n## Topics on deck\n- data pipelines\n- realtime collaboration\n- platform reliability`,
      status: PostStatus.DRAFT,
      publishedAtOffset: null,
      tags: ["product"],
    },
  ];

  for (const [index, data] of postsSeed.entries()) {
    const publishedAt =
      data.status === PostStatus.PUBLISHED
        ? new Date(now - (data.publishedAtOffset ?? index + 1) * 24 * 60 * 60 * 1000)
        : data.status === PostStatus.SCHEDULED && data.publishedAtOffset
          ? new Date(now + Math.abs(data.publishedAtOffset) * 24 * 60 * 60 * 1000)
          : null;

    const post = await prisma.post.upsert({
      where: { slug: data.slug },
      update: {
        title: data.title,
        summary: data.summary,
        contentMdx: data.contentMdx,
        status: data.status,
        publishedAt,
        authorId: superadmin.id,
      },
      create: {
        title: data.title,
        slug: data.slug,
        summary: data.summary,
        contentMdx: data.contentMdx,
        status: data.status,
        publishedAt,
        authorId: superadmin.id,
      },
    });

    await prisma.post.update({
      where: { id: post.id },
      data: {
        tags: {
          deleteMany: {},
          create: data.tags?.map((slug) => ({
            tag: { connect: { slug } },
          })),
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
