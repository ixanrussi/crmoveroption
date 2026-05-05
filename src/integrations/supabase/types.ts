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
      affiliate_channel_links: {
        Row: {
          affiliate_id: string
          channel_id: string
          link: string | null
        }
        Insert: {
          affiliate_id: string
          channel_id: string
          link?: string | null
        }
        Update: {
          affiliate_id?: string
          channel_id?: string
          link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_channel_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_channel_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "affiliate_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      affiliate_commission_plans: {
        Row: {
          affiliate_id: string
          baseline: number | null
          brand: string | null
          cap: number | null
          conversion_type: string | null
          country_id: string | null
          country_ids: string[]
          cpa: number | null
          cpl: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          plan_start_date: string | null
          rev_share_pct: number | null
          updated_at: string
          wager: number | null
        }
        Insert: {
          affiliate_id: string
          baseline?: number | null
          brand?: string | null
          cap?: number | null
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpl?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
        }
        Update: {
          affiliate_id?: string
          baseline?: number | null
          brand?: string | null
          cap?: number | null
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpl?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_plans_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_plans_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_operator_ids: {
        Row: {
          affiliate_id: string
          brand: string | null
          client_id: string
          created_at: string
          id: string
          operator_campaign_id: string
        }
        Insert: {
          affiliate_id: string
          brand?: string | null
          client_id: string
          created_at?: string
          id?: string
          operator_campaign_id: string
        }
        Update: {
          affiliate_id?: string
          brand?: string | null
          client_id?: string
          created_at?: string
          id?: string
          operator_campaign_id?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          alias: string | null
          bank_details: string | null
          brands: string[]
          commission_pct: number | null
          country_id: string | null
          country_ids: string[]
          created_at: string
          created_by: string | null
          email: string | null
          fixed_name: string
          id: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          tax_id: string | null
          unique_id: string
          updated_at: string
        }
        Insert: {
          alias?: string | null
          bank_details?: string | null
          brands?: string[]
          commission_pct?: number | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          fixed_name: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          tax_id?: string | null
          unique_id: string
          updated_at?: string
        }
        Update: {
          alias?: string | null
          bank_details?: string | null
          brands?: string[]
          commission_pct?: number | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          fixed_name?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          tax_id?: string | null
          unique_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      client_commission_plans: {
        Row: {
          baseline: number | null
          brand: string | null
          cap: number | null
          client_id: string
          conversion_type: string | null
          country_id: string | null
          country_ids: string[]
          cpa: number | null
          cpl: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          plan_start_date: string | null
          rev_share_pct: number | null
          updated_at: string
          wager: number | null
        }
        Insert: {
          baseline?: number | null
          brand?: string | null
          cap?: number | null
          client_id: string
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpl?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
        }
        Update: {
          baseline?: number | null
          brand?: string | null
          cap?: number | null
          client_id?: string
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpl?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_commission_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commission_plans_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          channel: string
          client_id: string
          contact_id: string
          created_at: string
          id: string
          name: string
          role: string | null
        }
        Insert: {
          channel: string
          client_id: string
          contact_id: string
          created_at?: string
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          channel?: string
          client_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_software_links: {
        Row: {
          client_id: string
          software_id: string
        }
        Insert: {
          client_id: string
          software_id: string
        }
        Update: {
          client_id?: string
          software_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_software_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_software_links_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "softwares"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          affiliate_id: string | null
          brands: string[]
          client_type: string | null
          company_name: string
          contact_name: string | null
          country_id: string | null
          country_ids: string[]
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          login: string | null
          notes: string | null
          phone: string | null
          senha: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          affiliate_id?: string | null
          brands?: string[]
          client_type?: string | null
          company_name: string
          contact_name?: string | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          login?: string | null
          notes?: string | null
          phone?: string | null
          senha?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          affiliate_id?: string | null
          brands?: string[]
          client_type?: string | null
          company_name?: string
          contact_name?: string | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          login?: string | null
          notes?: string | null
          phone?: string | null
          senha?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_closure_feedback: {
        Row: {
          closure_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string
          source: string
        }
        Insert: {
          closure_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message: string
          source?: string
        }
        Update: {
          closure_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          source?: string
        }
        Relationships: []
      }
      commission_closure_items: {
        Row: {
          active_accounts: number | null
          affiliate_id: string | null
          brand: string | null
          casino_ngr: number | null
          closure_id: string
          commission_total: number | null
          cpa_amount: number | null
          created_at: string
          currency: string | null
          id: string
          is_paid_to_affiliate: boolean | null
          locked_players: number | null
          match_status: string
          new_accounts: number | null
          new_purchasing: number | null
          notes: string | null
          qualified_players: number | null
          raw_campaign_id: string | null
          raw_campaign_name: string | null
          report_type: string | null
          revshare_amount: number | null
          sports_ngr: number | null
          updated_at: string
          visits: number | null
        }
        Insert: {
          active_accounts?: number | null
          affiliate_id?: string | null
          brand?: string | null
          casino_ngr?: number | null
          closure_id: string
          commission_total?: number | null
          cpa_amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_paid_to_affiliate?: boolean | null
          locked_players?: number | null
          match_status?: string
          new_accounts?: number | null
          new_purchasing?: number | null
          notes?: string | null
          qualified_players?: number | null
          raw_campaign_id?: string | null
          raw_campaign_name?: string | null
          report_type?: string | null
          revshare_amount?: number | null
          sports_ngr?: number | null
          updated_at?: string
          visits?: number | null
        }
        Update: {
          active_accounts?: number | null
          affiliate_id?: string | null
          brand?: string | null
          casino_ngr?: number | null
          closure_id?: string
          commission_total?: number | null
          cpa_amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_paid_to_affiliate?: boolean | null
          locked_players?: number | null
          match_status?: string
          new_accounts?: number | null
          new_purchasing?: number | null
          notes?: string | null
          qualified_players?: number | null
          raw_campaign_id?: string | null
          raw_campaign_name?: string | null
          report_type?: string | null
          revshare_amount?: number | null
          sports_ngr?: number | null
          updated_at?: string
          visits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_closure_items_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "commission_closures"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_closures: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          notes: string | null
          period: string
          report_type: string | null
          source_file_name: string | null
          source_file_path: string | null
          status: Database["public"]["Enums"]["closure_status"]
          total_commission: number | null
          total_locked: number | null
          total_qualified: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          period: string
          report_type?: string | null
          source_file_name?: string | null
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["closure_status"]
          total_commission?: number | null
          total_locked?: number | null
          total_qualified?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          period?: string
          report_type?: string | null
          source_file_name?: string | null
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["closure_status"]
          total_commission?: number | null
          total_locked?: number | null
          total_qualified?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string
          id: string
          job_title: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string
          id: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      softwares: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      affiliate_status: "active" | "inactive" | "pending"
      app_role: "super_admin" | "admin" | "user"
      client_status: "active" | "inactive" | "prospect"
      closure_status: "draft" | "confirmed" | "paid"
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
    Enums: {
      affiliate_status: ["active", "inactive", "pending"],
      app_role: ["super_admin", "admin", "user"],
      client_status: ["active", "inactive", "prospect"],
      closure_status: ["draft", "confirmed", "paid"],
    },
  },
} as const
