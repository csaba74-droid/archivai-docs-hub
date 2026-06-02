// Re-export the canonical Supabase client from the generated integration file.
// The previous hardcoded URL/key pointed to a DIFFERENT Supabase project than
// the one the server functions (supabaseAdmin) use, which caused inserts and
// reads to hit different databases (e.g. invitations created from sharing.tsx
// were not visible to lookupInvitation on the server).
export { supabase } from "@/integrations/supabase/client";

export type DocumentRow = {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  category: string;
  itm_compliant: boolean;
  size_bytes: number | null;
  mime_type: string | null;
  sha256: string | null;
  content_text: string | null;
  ai_confidence: number | null;
  document_date: string | null;
  notes: string | null;
  created_at: string;
  category_changed_at?: string | null;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  company: string | null;
  archivai_email: string | null;
  referred_by: string | null;
  partner_type: string | null;
};

export type AuditLogRow = {
  id: string;
  user_id: string;
  document_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CustomCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_strict_itm: boolean;
  retention_years: number | null;
  created_at: string;
  parent_id: string | null;
  parent_builtin: string | null;
  root_builtin: string | null;
  is_system?: boolean;
};

export type SubscriptionRow = {
  user_id: string;
  plan: "alap" | "pro" | "vallalati";
  status: "trialing" | "active" | "past_due" | "canceled" | "inactive";
  current_period_end: string | null;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
};
