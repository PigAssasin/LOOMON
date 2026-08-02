import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { z } from "zod";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

const SINGLE_DEMO_SELLER_ADDRESS = "0xd59aa8db407d4219fe4b104ca4142df14301dec4";

const assetSchema = z.object({
  id: z.uuid(),
  role: z.string().nullable(),
  bucket: z.string(),
  path: z.string(),
  mimeType: z.string().nullable(),
  fileName: z.string().nullable(),
  label: z.string(),
});

const briefAssetsSchema = z.object({
  orderId: z.uuid(),
  briefType: z.string().nullable(),
  makerNotes: z.string().nullable(),
  assets: z.array(assetSchema),
});

type SignedBriefAsset = z.infer<typeof briefAssetsSchema> & {
  assets: Array<z.infer<typeof assetSchema> & { url: string | null }>;
};

async function signBriefAssetsForOrder(orderId: string): Promise<SignedBriefAsset> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("server_get_order_brief_assets" as never, {
    p_order_id: orderId,
  } as never);
  if (error) {
    throw new Error("Brief assets could not be loaded");
  }
  const parsed = briefAssetsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Brief assets are malformed");
  }

  const signedAssets = await Promise.all(parsed.data.assets.map(async (asset) => {
    const { data: signed, error: signError } = await admin.storage
      .from(asset.bucket)
      .createSignedUrl(asset.path, 60 * 60);
    return {
      id: asset.id,
      role: asset.role,
      bucket: asset.bucket,
      path: asset.path,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      label: asset.label,
      url: signError ? null : signed.signedUrl,
    };
  }));

  return {
    orderId: parsed.data.orderId,
    briefType: parsed.data.briefType,
    makerNotes: parsed.data.makerNotes,
    assets: signedAssets.filter(Boolean) as SignedBriefAsset["assets"],
  };
}

async function walletCanAccessOrder(orderId: string, rawAddress: string) {
  const admin = createAdminClient();
  let address: string;
  try {
    address = getAddress(rawAddress).toLowerCase();
  } catch {
    return false;
  }

  const { data: order } = await admin
    .schema("commerce" as never)
    .from("orders" as never)
    .select("buyer_id, maker_id" as never)
    .eq("id" as never, orderId)
    .maybeSingle();
  const orderRecord = order as { buyer_id?: string; maker_id?: number } | null;
  if (!orderRecord?.buyer_id) return false;
  if (address === SINGLE_DEMO_SELLER_ADDRESS) return true;

  const { data: wallet } = await admin
    .schema("wallet" as never)
    .from("accounts" as never)
    .select("user_id" as never)
    .eq("address" as never, address)
    .eq("user_id" as never, orderRecord.buyer_id)
    .maybeSingle();
  return Boolean(wallet);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const walletAddress = new URL(request.url).searchParams.get("address");
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  if (walletAddress) {
    try {
      if (getAddress(walletAddress).toLowerCase() === SINGLE_DEMO_SELLER_ADDRESS) {
        return NextResponse.json(
          await signBriefAssetsForOrder(orderId),
          { headers: { "cache-control": "no-store" } },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
  }

  if (walletAddress && await walletCanAccessOrder(orderId, walletAddress)) {
    return NextResponse.json(
      await signBriefAssetsForOrder(orderId),
      { headers: { "cache-control": "no-store" } },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (!walletAddress || !(await walletCanAccessOrder(orderId, walletAddress))) {
      return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
    }
    return NextResponse.json(
      await signBriefAssetsForOrder(orderId),
      { headers: { "cache-control": "no-store" } },
    );
  }

  const { data, error } = await supabase.rpc("get_order_brief_assets", {
    p_order_id: orderId,
  });
  if (error) {
    return NextResponse.json({ error: "Brief assets could not be loaded" }, { status: 404 });
  }

  const parsed = briefAssetsSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Brief assets are malformed" }, { status: 500 });
  }

  const admin = createAdminClient();
  const signedAssets = await Promise.all(
    parsed.data.assets.map(async (asset) => {
      const { data: signed, error: signError } = await admin.storage
        .from(asset.bucket)
        .createSignedUrl(asset.path, 60 * 60);
      return {
        id: asset.id,
        role: asset.role,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        label: asset.label,
        url: signError ? null : signed.signedUrl,
      };
    }),
  );

  return NextResponse.json(
    {
      orderId: parsed.data.orderId,
      briefType: parsed.data.briefType,
      makerNotes: parsed.data.makerNotes,
      assets: signedAssets,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
