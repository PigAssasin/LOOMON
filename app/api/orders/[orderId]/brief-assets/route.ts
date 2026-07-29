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
  const { data: orderBrief } = await admin
    .schema("commerce" as never)
    .from("order_briefs" as never)
    .select("brief_id" as never)
    .eq("order_id" as never, orderId)
    .maybeSingle();
  const briefId = (orderBrief as { brief_id?: string } | null)?.brief_id;
  if (!briefId) return { orderId, briefType: null, makerNotes: null, assets: [] };

  const { data: brief } = await admin
    .schema("customization" as never)
    .from("briefs" as never)
    .select("id, brief_type, maker_notes, source_asset_id, selected_candidate_id" as never)
    .eq("id" as never, briefId)
    .maybeSingle();
  const briefRecord = brief as {
    brief_type?: string | null;
    maker_notes?: string | null;
    source_asset_id?: string | null;
    selected_candidate_id?: string | null;
  } | null;
  if (!briefRecord) return { orderId, briefType: null, makerNotes: null, assets: [] };

  type SelectedCandidate = { label?: string | null; output_asset_id?: string | null };
  let selectedCandidate: SelectedCandidate | null = null;
  if (briefRecord.selected_candidate_id) {
    const { data } = await admin
      .schema("customization" as never)
      .from("render_candidates" as never)
      .select("label, output_asset_id" as never)
      .eq("id" as never, briefRecord.selected_candidate_id)
      .maybeSingle();
    selectedCandidate = data as SelectedCandidate | null;
  }

  const wanted = [
    briefRecord.source_asset_id
      ? { id: briefRecord.source_asset_id, label: "Uploaded artwork" }
      : null,
    selectedCandidate?.output_asset_id
      ? { id: selectedCandidate.output_asset_id, label: selectedCandidate.label || "Selected AI preview" }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  if (!wanted.length) {
    return {
      orderId,
      briefType: briefRecord.brief_type ?? null,
      makerNotes: briefRecord.maker_notes ?? null,
      assets: [],
    };
  }

  const { data: assets } = await admin
    .schema("customization" as never)
    .from("assets" as never)
    .select("id, asset_role, storage_bucket, storage_path, mime_type, metadata" as never)
    .in("id" as never, wanted.map((asset) => asset.id));

  const rows = (assets ?? []) as Array<{
    id: string;
    asset_role: string | null;
    storage_bucket: string;
    storage_path: string;
    mime_type: string | null;
    metadata?: { fileName?: string } | null;
  }>;
  const signedAssets = await Promise.all(wanted.map(async (wantedAsset) => {
    const asset = rows.find((row) => row.id === wantedAsset.id);
    if (!asset) return null;
    const { data: signed, error: signError } = await admin.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60 * 60);
    return {
      id: asset.id,
      role: asset.asset_role,
      bucket: asset.storage_bucket,
      path: asset.storage_path,
      mimeType: asset.mime_type,
      fileName: asset.metadata?.fileName ?? null,
      label: wantedAsset.label,
      url: signError ? null : signed.signedUrl,
    };
  }));

  return {
    orderId,
    briefType: briefRecord.brief_type ?? null,
    makerNotes: briefRecord.maker_notes ?? null,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (!walletAddress || !(await walletCanAccessOrder(orderId, walletAddress))) {
      return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
    }
    return NextResponse.json(await signBriefAssetsForOrder(orderId));
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

  return NextResponse.json({
    orderId: parsed.data.orderId,
    briefType: parsed.data.briefType,
    makerNotes: parsed.data.makerNotes,
    assets: signedAssets,
  });
}
