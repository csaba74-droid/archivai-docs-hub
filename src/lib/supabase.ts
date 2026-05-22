import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jofxnjtktwuzmjjcgofw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UvtuR3PW0qi6ia8Y07kwFQ_p5dbL2Ix";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

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
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  company: string | null;
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
};

export type SubscriptionRow = {
  user_id: string;
  plan: "alap" | "pro" | "vallalati";
  status: "active" | "past_due" | "canceled" | "inactive";
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
};
