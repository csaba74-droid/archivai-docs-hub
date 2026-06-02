import { useEffect, useState } from "react";
import { listSharedWithMe, type SharedWithMeItem } from "@/lib/sharing.functions";

export function useSharedWithMe() {
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listSharedWithMe();
        if (!cancelled) setItems(res.items);
      } catch (e) {
        console.error("[useSharedWithMe] failed:", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}
