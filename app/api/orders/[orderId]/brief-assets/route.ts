import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign-in required" }, { status: 401 });

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
