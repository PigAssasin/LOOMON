import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { getAddress, verifyMessage } from "viem";
import { z } from "zod";
import { ARC_TESTNET } from "@/src/lib/arc";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { Database } from "@/src/lib/supabase/database.types";

const challengeLifetimeMs = 5 * 60 * 1000;

const challengePayloadSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  expiresAt: z.number().int().positive(),
  issuedAt: z.string().datetime(),
  message: z.string().min(40).max(2_000),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,}$/),
});

const confirmationSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  token: z.string().min(40).max(8_000),
});

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Wallet session bridge is not configured");
  return value;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

function encodeChallenge(payload: z.infer<typeof challengePayloadSchema>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodeChallenge(token: string) {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) throw new Error("Invalid wallet challenge");
  const expectedSignature = sign(encodedPayload);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Invalid wallet challenge");
  }
  const payload = challengePayloadSchema.parse(
    JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
  );
  if (payload.expiresAt < Date.now()) throw new Error("Wallet challenge expired");
  return payload;
}

function requestOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

async function retryTransientAuth<
  T extends { data: unknown; error: { message: string } | null },
>(operation: () => Promise<T>): Promise<T["data"]> {
  let lastError: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await operation();
    if (!result.error) return result.data;
    lastError = result.error;
    if (!/unrecognized JWT kid|token is unverifiable/i.test(result.error.message)) {
      throw result.error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  throw lastError ?? new Error("Supabase Auth request failed");
}

export async function GET(request: Request) {
  const rawAddress = new URL(request.url).searchParams.get("address");
  if (!rawAddress) {
    return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
  }

  try {
    const address = getAddress(rawAddress);
    const issuedAt = new Date();
    const expiresAt = issuedAt.getTime() + challengeLifetimeMs;
    const nonce = randomBytes(18).toString("base64url");
    const origin = requestOrigin(request);
    const message = [
      "LOOMON wants you to sign in with your Ethereum account:",
      address,
      "",
      "Authorize this wallet for LOOMON orders and profile access.",
      "",
      `URI: ${origin}`,
      "Version: 1",
      `Chain ID: ${ARC_TESTNET.id}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${new Date(expiresAt).toISOString()}`,
    ].join("\n");
    const payload = {
      address,
      expiresAt,
      issuedAt: issuedAt.toISOString(),
      message,
      nonce,
    };
    return NextResponse.json({ message, token: encodeChallenge(payload) });
  } catch {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const input = confirmationSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Invalid wallet confirmation" }, { status: 400 });
  }

  try {
    const payload = decodeChallenge(input.data.token);
    const address = getAddress(input.data.address);
    if (address !== getAddress(payload.address)) {
      return NextResponse.json({ error: "Wallet challenge mismatch" }, { status: 422 });
    }
    const valid = await verifyMessage({
      address,
      message: payload.message,
      signature: input.data.signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Wallet signature is invalid" }, { status: 422 });
    }

    const admin = createAdminClient();
    const fallbackEmail = `arc-${address.slice(2).toLowerCase()}@wallet.loomon.invalid`;
    let userId: string | undefined;
    const email = fallbackEmail;
    const users = await retryTransientAuth(() =>
      admin.auth.admin.listUsers({ page: 1, perPage: 1_000 }),
    );
    userId = users.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    )?.id;
    if (!userId) {
      const created = await retryTransientAuth(() =>
        admin.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: {
            provider: "loomon_wallet",
            wallet_address: address.toLowerCase(),
            wallet_verified_by: "loomon_signature",
          },
          user_metadata: { wallet_address: address.toLowerCase() },
        }),
      );
      if (!created.user) throw new Error("Wallet user was not created");
      userId = created.user.id;
    }

    const bridgePassword = createHmac("sha256", secret())
      .update(`loomon-wallet-session:${address.toLowerCase()}`)
      .digest("base64url");
    await retryTransientAuth(() =>
      admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          provider: "loomon_wallet",
          wallet_address: address.toLowerCase(),
          wallet_verified_by: "loomon_signature",
        },
        email,
        email_confirm: true,
        password: bridgePassword,
      }),
    );

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Wallet session is not configured");
    const supabase = createSupabaseClient<Database>(url, key, {
      auth: { persistSession: false },
    });
    const { data: session, error: verifyError } =
      await supabase.auth.signInWithPassword({ email, password: bridgePassword });
    if (verifyError) throw verifyError;
    if (session.user.id !== userId) throw new Error("Wallet session identity mismatch");
    if (!session.session) throw new Error("Wallet session was not returned");

    return NextResponse.json({
      accessToken: session.session.access_token,
      address: address.toLowerCase(),
      authenticated: true,
      refreshToken: session.session.refresh_token,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Wallet sign-in failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
