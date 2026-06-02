import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { appSupabaseAdmin } from "@/lib/app-supabase-admin.server";

export type SharedWithMeItem = {
  catId: string; // built-in id like "szamlak" or "custom:<uuid>"
  label: string;
  color: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string | null;
};

const BUILT_IN_LABELS: Record<string, { label: string; color: string }> = {
  beerkezett: { label: "Beérkezett", color: "#3b82f6" },
  szamlak: { label: "Számlák", color: "#64748b" },
  szerzodesek: { label: "Szerződések", color: "#64748b" },
  szallitolevek: { label: "Szállítólevelek", color: "#64748b" },
  munkaugyi: { label: "Munkaügyi iratok", color: "#64748b" },
  adobevallasok: { label: "Adóbevallások", color: "#64748b" },
  kozuzemi: { label: "Közüzemi számlák", color: "#64748b" },
  banki: { label: "Banki dokumentumok", color: "#64748b" },
  muszaki: { label: "Műszaki dokumentumok", color: "#64748b" },
  belso: { label: "Belső iratok", color: "#64748b" },
  egyeb: { label: "Egyéb", color: "#64748b" },
};

export const listSharedWithMe = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ items: SharedWithMeItem[] }> => {
    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return { items: [] };
    }
    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) return { items: [] };

    const { data: userResult } = await appSupabaseAdmin.auth.getUser(accessToken);
    const user = userResult?.user;
    if (!user) return { items: [] };

    // Match invitations either by linked user id or by email (case-insensitive)
    const email = (user.email ?? "").toLowerCase();
    const { data: shares } = await appSupabaseAdmin
      .from("shared_access")
      .select("id, owner_user_id, categories, status, invited_user_id, invited_email")
      .eq("status", "accepted");

    const mine = (shares ?? []).filter((s) => {
      const row = s as {
        invited_user_id: string | null;
        invited_email: string;
      };
      return (
        row.invited_user_id === user.id ||
        (email && String(row.invited_email).toLowerCase() === email)
      );
    });

    if (mine.length === 0) return { items: [] };

    // Backfill invited_user_id for rows matched by email so dashboard RLS can work too
    const toBackfill = mine
      .filter((s) => (s as { invited_user_id: string | null }).invited_user_id !== user.id)
      .map((s) => (s as { id: string }).id);
    if (toBackfill.length > 0) {
      await appSupabaseAdmin
        .from("shared_access")
        .update({ invited_user_id: user.id, updated_at: new Date().toISOString() })
        .in("id", toBackfill);
    }

    // Collect owner ids + custom category ids
    const ownerIds = Array.from(
      new Set(mine.map((s) => (s as { owner_user_id: string }).owner_user_id)),
    );
    const customIds: string[] = [];
    mine.forEach((s) => {
      const cats = (s as { categories: string[] }).categories ?? [];
      cats.forEach((c) => {
        if (c.startsWith("custom:")) customIds.push(c.slice(7));
      });
    });

    // Owner profile names (fallback to auth.users email)
    const ownerInfo = new Map<string, { name: string; email: string | null }>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await appSupabaseAdmin
        .from("profiles")
        .select("id, full_name, company, email")
        .in("id", ownerIds);
      (profiles ?? []).forEach((p) => {
        const row = p as {
          id: string;
          full_name: string | null;
          company: string | null;
          email: string | null;
        };
        ownerInfo.set(row.id, {
          name: row.full_name || row.company || row.email || "Felhasználó",
          email: row.email,
        });
      });
      // Fallback for owners missing a profile row
      for (const oid of ownerIds) {
        if (!ownerInfo.has(oid)) {
          try {
            const { data } = await appSupabaseAdmin.auth.admin.getUserById(oid);
            const u = data?.user;
            const meta = (u?.user_metadata ?? {}) as {
              full_name?: string;
              company?: string;
            };
            ownerInfo.set(oid, {
              name: meta.full_name || meta.company || u?.email || "Felhasználó",
              email: u?.email ?? null,
            });
          } catch {
            ownerInfo.set(oid, { name: "Felhasználó", email: null });
          }
        }
      }
    }

    // Custom category labels/colors
    const customMeta = new Map<string, { name: string; color: string }>();
    if (customIds.length > 0) {
      const { data: customs } = await appSupabaseAdmin
        .from("custom_categories")
        .select("id, name, color")
        .in("id", customIds);
      (customs ?? []).forEach((c) => {
        const row = c as { id: string; name: string; color: string };
        customMeta.set(row.id, { name: row.name, color: row.color || "#64748b" });
      });
    }

    const items: SharedWithMeItem[] = [];
    mine.forEach((s) => {
      const row = s as { owner_user_id: string; categories: string[] };
      const owner = ownerInfo.get(row.owner_user_id) ?? {
        name: "Felhasználó",
        email: null,
      };
      (row.categories ?? []).forEach((cid) => {
        if (cid.startsWith("custom:")) {
          const meta = customMeta.get(cid.slice(7));
          if (!meta) return;
          items.push({
            catId: cid,
            label: meta.name,
            color: meta.color,
            ownerUserId: row.owner_user_id,
            ownerName: owner.name,
            ownerEmail: owner.email,
          });
        } else {
          const b = BUILT_IN_LABELS[cid];
          if (!b) return;
          items.push({
            catId: cid,
            label: b.label,
            color: b.color,
            ownerUserId: row.owner_user_id,
            ownerName: owner.name,
            ownerEmail: owner.email,
          });
        }
      });
    });

    return { items };
  },
);
