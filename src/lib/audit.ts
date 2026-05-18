import { supabase } from "./supabase";

export type AuditAction =
  | "upload"
  | "view"
  | "download"
  | "delete"
  | "delete_blocked"
  | "search"
  | "categorize";

export async function logAudit(
  action: AuditAction,
  documentId: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;
    await supabase.from("audit_log").insert({
      user_id: user.id,
      document_id: documentId,
      action,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.warn("audit log failed:", e);
  }
}
