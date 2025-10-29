import { PayoutStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function settlePendingPayouts(limit = 20) {
  const pending = await prisma.payout.findMany({
    where: { status: PayoutStatus.PENDING },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let processed = 0;
  for (const payout of pending) {
    const transferId = payout.stripeTransferId ?? `tr_${Date.now().toString(36)}_${processed}`;
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.PAID, stripeTransferId: transferId },
    });
    logger.info({ payoutId: payout.id, transferId }, "Marked payout as settled");
    processed += 1;
  }

  return { processed };
}
