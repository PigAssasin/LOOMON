import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type CleanupJob = {
  job_id: number;
  media_asset_id: number;
  storage_bucket: string;
  storage_path: string;
  attempt: number;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase runtime secrets are unavailable" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const workerId = `cleanup-product-media:${crypto.randomUUID()}`;

  const { data, error } = await supabase.rpc("claim_product_media_cleanup_jobs", {
    worker_id: workerId,
    batch_size: 25,
  });

  if (error) {
    console.error("CLEANUP_CLAIM_FAILED", error.code);
    return Response.json({ error: "Unable to claim cleanup jobs" }, { status: 500 });
  }

  const jobs = (data ?? []) as CleanupJob[];
  const results = [];

  for (const job of jobs) {
    const removal = await supabase.storage
      .from(job.storage_bucket)
      .remove([job.storage_path]);

    const completion = await supabase.rpc("complete_product_media_cleanup_job", {
      target_job_id: job.job_id,
      succeeded: !removal.error,
      error_message: removal.error?.message ?? null,
    });

    if (completion.error) {
      console.error("CLEANUP_COMPLETE_FAILED", job.job_id, completion.error.code);
    }

    results.push({
      jobId: job.job_id,
      removed: !removal.error,
      recorded: !completion.error,
    });
  }

  return Response.json({ claimed: jobs.length, results });
});
