"use client";

import { useEffect, useState } from "react";

const storageKey = "loomon-followed-stores";

export function useFollowedStores() {
  const [followed, setFollowed] = useState<string[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setFollowed(JSON.parse(stored) as string[]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleFollow(slug: string) {
    setFollowed((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return { followed, toggleFollow };
}
