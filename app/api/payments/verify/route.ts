import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyArcUsdcPayment } from "@/src/lib/payments/verify-arc-payment";

const requestSchema = z.object({
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  payer: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountAtomic: z.string().regex(/^\d+$/),
});

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid payment verification request" }, { status: 400 });

  try {
    const result = await verifyArcUsdcPayment({
      ...input.data,
      transactionHash: input.data.transactionHash as `0x${string}`,
      payer: input.data.payer as `0x${string}`,
      recipient: input.data.recipient as `0x${string}`,
      amountAtomic: BigInt(input.data.amountAtomic),
    });
    return NextResponse.json({ ...result, blockNumber: result.blockNumber?.toString() });
  } catch {
    return NextResponse.json({ verified: false, reason: "Transaction is unavailable on Arc Testnet" }, { status: 404 });
  }
}
