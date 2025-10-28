import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";

const telemetrySchema = z.object({
  event: z.string().min(1),
  timestamp: z.string().optional(),
  payload: z.record(z.string(), z.any()).default({}),
});

export async function POST(request: Request) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;

  const json = await request.json().catch(() => ({}));
  const parsed = telemetrySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;
  logger.info({ event: payload.event, payload: payload.payload }, "Telemetry event received");

  if (isDatabaseEnabled) {
    try {
      await prisma.auditLog.create({
        data: {
          action: `telemetry:${payload.event}`,
          meta: payload,
        },
      });
    } catch (error) {
      logger.warn({ err: error }, "Failed to persist telemetry event");
    }
  }

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
