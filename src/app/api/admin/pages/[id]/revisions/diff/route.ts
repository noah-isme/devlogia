import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

type DiffLine = {
  type: "add" | "delete" | "same";
  line: string;
  lineNumFrom?: number;
  lineNumTo?: number;
};

function computeLineDiff(fromText: string, toText: string): DiffLine[] {
  const fromLines = fromText.split("\n");
  const toLines = toText.split("\n");
  const diffs: DiffLine[] = [];

  let fromIdx = 0;
  let toIdx = 0;

  while (fromIdx < fromLines.length || toIdx < toLines.length) {
    const fromLine = fromLines[fromIdx];
    const toLine = toLines[toIdx];

    if (fromLine === toLine) {
      if (fromLine !== undefined) {
        diffs.push({ type: "same", line: fromLine, lineNumFrom: fromIdx + 1, lineNumTo: toIdx + 1 });
      }
      fromIdx++;
      toIdx++;
    } else if (toLine !== undefined && (!fromLines.slice(fromIdx).includes(toLine) || toLines.slice(toIdx).includes(fromLine))) {
      diffs.push({ type: "add", line: toLine, lineNumTo: toIdx + 1 });
      toIdx++;
    } else if (fromLine !== undefined) {
      diffs.push({ type: "delete", line: fromLine, lineNumFrom: fromIdx + 1 });
      fromIdx++;
    }
  }

  return diffs;
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "page:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { from: fromId, to: toId } = parsed.data;

  const page = await prisma.page.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, contentMdx: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const [fromRevision, toRevision] = await Promise.all([
    prisma.pageRevision.findFirst({
      where: { id: fromId, pageId: id },
      select: { id: true, title: true, contentMdx: true, createdAt: true },
    }),
    prisma.pageRevision.findFirst({
      where: { id: toId, pageId: id },
      select: { id: true, title: true, contentMdx: true, createdAt: true },
    }),
  ]);

  if (!fromRevision || !toRevision) {
    return NextResponse.json({ error: "One or both revisions not found" }, { status: 404 });
  }

  const fromContent = fromRevision.contentMdx ?? "";
  const toContent = toRevision.contentMdx ?? "";
  const diffLines = computeLineDiff(fromContent, toContent);

  const stats = {
    adds: diffLines.filter((l) => l.type === "add").length,
    deletes: diffLines.filter((l) => l.type === "delete").length,
    same: diffLines.filter((l) => l.type === "same").length,
  };

  return NextResponse.json({
    page: { id: page.id, title: page.title, slug: page.slug },
    from: { id: fromRevision.id, title: fromRevision.title, createdAt: fromRevision.createdAt },
    to: { id: toRevision.id, title: toRevision.title, createdAt: toRevision.createdAt },
    diffLines,
    stats,
  });
}