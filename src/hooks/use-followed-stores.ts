"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export function useFollowedStores() {
  const supabase = useMemo(() => createClient(), []);
  const [followed, setFollowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
      setFollowed([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc("list_my_followed_stores");
    setFollowed((data ?? []).map((row) => row.maker_slug));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  async function toggleFollow(slug: string) {
    if (!supabase) return false;
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) return false;
    const { error } = await supabase.rpc("toggle_store_follow", {
      p_maker_slug: slug,
    });
    if (error) return false;
    await refresh();
    return true;
  }

  return { followed, loading, refresh, toggleFollow };
}
