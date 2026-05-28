export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          document_id: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system: boolean
          mode: string
          name: string
          retention_years: number | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          mode: string
          name: string
          retention_years?: number | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          mode?: string
          name?: string
          retention_years?: number | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_confidence: number | null
          category: string
          content_text: string | null
          created_at: string
          document_date: string | null
          filename: string
          id: string
          itm_compliant: boolean
          mime_type: string | null
          original_filename: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          category: string
          content_text?: string | null
          created_at?: string
          document_date?: string | null
          filename: string
          id?: string
          itm_compliant?: boolean
          mime_type?: string | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          category?: string
          content_text?: string | null
          created_at?: string
          document_date?: string | null
          filename?: string
          id?: string
          itm_compliant?: boolean
          mime_type?: string | null
          original_filename?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      nav_settings: {
        Row: {
          adoszam: string
          created_at: string
          exchange_key: string
          password: string
          signature_key: string
          technical_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adoszam: string
          created_at?: string
          exchange_key: string
          password?: string
          signature_key: string
          technical_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adoszam?: string
          created_at?: string
          exchange_key?: string
          password?: string
          signature_key?: string
          technical_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archivai_email: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          partner_type: string | null
          referred_by: string | null
        }
        Insert: {
          archivai_email?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          partner_type?: string | null
          referred_by?: string | null
        }
        Update: {
          archivai_email?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          partner_type?: string | null
          referred_by?: string | null
        }
        Relationships: []
      }
      shared_access: {
        Row: {
          categories: string[]
          created_at: string
          id: string
          invited_email: string
          invited_user_id: string | null
          owner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          created_at?: string
          id?: string
          invited_email: string
          invited_user_id?: string | null
          owner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          created_at?: string
          id?: string
          invited_email?: string
          invited_user_id?: string | null
          owner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_extend_trial_days: {
        Args: { _days: number; _user: string }
        Returns: undefined
      }
      admin_referral_list: {
        Args: never
        Returns: {
          referred_email: string
          referred_id: string
          referrer_email: string
          referrer_id: string
          registered_at: string
          subscribed: boolean
        }[]
      }
      admin_referral_stats: {
        Args: never
        Returns: {
          referred_count: number
          referrer_email: string
          referrer_id: string
          subscribed_count: number
        }[]
      }
      admin_set_partner_type: {
        Args: { _type: string; _user: string }
        Returns: undefined
      }
      admin_users_overview: {
        Args: never
        Returns: {
          created_at: string
          document_count: number
          email: string
          partner_type: string
          plan: string
          status: string
          storage_bytes: number
          trial_end: string
          user_id: string
        }[]
      }
      get_referrals: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          subscribed: boolean
          user_id: string
        }[]
      }
      my_referrals: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          subscribed: boolean
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
