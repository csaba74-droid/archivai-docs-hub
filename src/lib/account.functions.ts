import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { appSupabaseAdmin } from "@/lib/app-supabase-admin.server";

export const deleteAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean; error?: string }> => {
    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return { ok: false, error: "Nincs bejelentkezve" };
    }
    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) return { ok: false, error: "Nincs bejelentkezve" };

    const { data: userResult } = await appSupabaseAdmin.auth.getUser(accessToken);
    const user = userResult?.user;
    if (!user) return { ok: false, error: "Érvénytelen munkamenet" };

    const userId = user.id;

    // Best-effort cleanup of related rows (RLS-bypassing admin client).
    try {
      await appSupabaseAdmin.from("documents").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("[deleteAccount] documents delete failed", e);
    }
    try {
      await appSupabaseAdmin.from("custom_categories").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("[deleteAccount] custom_categories delete failed", e);
    }
    try {
      await appSupabaseAdmin.from("shared_access").delete().eq("owner_user_id", userId);
    } catch (e) {
      console.warn("[deleteAccount] shared_access delete failed", e);
    }
    try {
      await appSupabaseAdmin.from("nav_settings").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("[deleteAccount] nav_settings delete failed", e);
    }
    try {
      await appSupabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
    } catch (e) {
      console.warn("[deleteAccount] subscriptions delete failed", e);
    }
    try {
      await appSupabaseAdmin.from("profiles").delete().eq("id", userId);
    } catch (e) {
      console.warn("[deleteAccount] profiles delete failed", e);
    }

    const { error } = await appSupabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[deleteAccount] auth delete failed", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  },
);
