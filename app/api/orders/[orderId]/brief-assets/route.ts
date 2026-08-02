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
    .select("brief_id, selected_render_candidate_id" as never)
    .eq("order_id" as never, orderId)
    .maybeSingle();
  const orderBriefRecord = orderBrief as {
    brief_id?: string;
    selected_render_candidate_id?: string | null;
  } | null;
  const briefId = orderBriefRecord?.brief_id;
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

  const { data: orderConfigRow } = await admin
    .schema("commerce" as never)
    .from("orders" as never)
    .select("accepted_quote_version_id" as never)
    .eq("id" as never, orderId)
    .maybeSingle();
  const quoteVersionId = (orderConfigRow as { accepted_quote_version_id?: string } | null)
    ?.accepted_quote_version_id;
  let requestedConfiguration: Record<string, unknown> = {};
  if (quoteVersionId) {
    const { data: quoteVersionRow } = await admin
      .schema("commerce" as never)
      .from("quote_versions" as never)
      .select("quote_request_id" as never)
      .eq("id" as never, quoteVersionId)
      .maybeSingle();
    const quoteRequestId = (quoteVersionRow as { quote_request_id?: string } | null)
      ?.quote_request_id;
    if (quoteRequestId) {
      const { data: itemRow } = await admin
        .schema("commerce" as never)
        .from("quote_request_items" as never)
        .select("requested_configuration" as never)
        .eq("quote_request_id" as never, quoteRequestId)
        .limit(1)
        .maybeSingle();
      requestedConfiguration = (
        itemRow as { requested_configuration?: Record<string, unknown> | null } | null
      )?.requested_configuration ?? {};
    }
  }
  const configuredSourceAssetId =
    typeof requestedConfiguration.sourceAssetId === "string"
      ? requestedConfiguration.sourceAssetId
      : null;
  const configuredApprovedAssetId =
    typeof requestedConfiguration.approvedAssetId === "string"
      ? requestedConfiguration.approvedAssetId
      : typeof requestedConfiguration.assetId === "string"
        ? requestedConfiguration.assetId
        : null;
  const configuredSelectedCandidateId =
    typeof requestedConfiguration.selectedCandidateId === "string"
      ? requestedConfiguration.selectedCandidateId
      : null;

  type SelectedCandidate = { label?: string | null; output_asset_id?: string | null };
  let selectedCandidate: SelectedCandidate | null = null;
  const selectedCandidateId =
    briefRecord.selected_candidate_id
    ?? orderBriefRecord?.selected_render_candidate_id
    ?? configuredSelectedCandidateId;
  if (selectedCandidateId) {
    const { data } = await admin
      .schema("customization" as never)
      .from("render_candidates" as never)
      .select("label, output_asset_id" as never)
      .eq("id" as never, selectedCandidateId)
      .maybeSingle();
    selectedCandidate = data as SelectedCandidate | null;
  }

  const wantedCandidates = [
    (briefRecord.source_asset_id ?? configuredSourceAssetId)
      ? { id: (briefRecord.source_asset_id ?? configuredSourceAssetId) as string, label: "Uploaded artwork" }
      : null,
    selectedCandidate?.output_asset_id
      ? { id: selectedCandidate.output_asset_id, label: selectedCandidate.label || "Selected AI preview" }
      : null,
    !selectedCandidate?.output_asset_id && configuredApprovedAssetId
      ? { id: configuredApprovedAssetId, label: "Selected custom preview" }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const wanted = Array.from(
    new Map(wantedCandidates.map((asset) => [asset.id, asset])).values(),
  );
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
