import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createConnectOnboardingLink } from "@/lib/billing/accounts";
import { logger } from "@/lib/logger";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (!can(session.user, "billing:manage")) {
    return forbidden();
  }

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl : null;
  const refreshUrl = typeof body?.refreshUrl === "string" ? body.refreshUrl : null;

  if (!tenantId || !returnUrl || !refreshUrl) {
    return NextResponse.json({ error: "tenantId, returnUrl, and refreshUrl are required" }, { status: 400 });
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const remoteIp = forwardedFor?.split(",")[0]?.trim();

    const link = await createConnectOnboardingLink({
      tenantId,
      returnUrl,
      refreshUrl,
      email: typeof body?.email === "string" ? body.email : undefined,
      businessName: typeof body?.businessName === "string" ? body.businessName : undefined,
      businessUrl: typeof body?.businessUrl === "string" ? body.businessUrl : undefined,
      tosAcceptanceIp: remoteIp,
    });

    return NextResponse.json(
      {
        url: link.url,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        connectAccountId: link.connectAccountId,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ error, tenantId }, "Failed to create Stripe Connect onboarding link");
    const message = error instanceof Error ? error.message : "Unable to create onboarding link";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
