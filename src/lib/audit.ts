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
    if (!data?.user) return;
    const { error } = await (supabase.rpc as any)("log_audit", {
      _action: String(action),
      _document_id: documentId ?? null,
      _metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    });
    if (error) {
      console.warn("audit log insert failed:", error.message);
    }
  } catch (e) {
    console.warn("audit log failed:", e);
  }
}

