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
  storage_path: string;
  category: string;
  itm_compliant: boolean;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  company: string | null;
};
