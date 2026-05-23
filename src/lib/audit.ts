import { supabase } from "./supabase";

export type AuditAction =
  | "upload"
  | "view"
  | "download"
  | "delete"
  | "delete_blocked"
  | "search"
  | "categorize"
  | "rename"
  | "move";

export async function logAudit(
  action: AuditAction,
  documentId: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;
    const payload = {
      user_id: user.id,
      document_id: documentId ?? null,
      action: String(action),
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    };
    const { error } = await supabase.from("audit_log").insert(payload);
    if (error) {
      console.warn("audit log insert failed:", error.message, error.details, payload);
    }
  } catch (e) {
    console.warn("audit log failed:", e);
  }
}

