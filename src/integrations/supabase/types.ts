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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_channel_links: {
        Row: {
          affiliate_id: string
          channel_id: string
          id: string
          link: string | null
        }
        Insert: {
          affiliate_id: string
          channel_id: string
          id?: string
          link?: string | null
        }
        Update: {
          affiliate_id?: string
          channel_id?: string
          id?: string
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
          baseline_currency: string | null
          brand: string | null
          cap: number | null
          client_id: string | null
          conversion_type: string | null
          country_id: string | null
          country_ids: string[]
          cpa: number | null
          cpa_currency: string | null
          cpl: number | null
          cpl_currency: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          plan_start_date: string | null
          rev_share_pct: number | null
          template_id: string | null
          updated_at: string
          wager: number | null
          wager_currency: string | null
        }
        Insert: {
          affiliate_id: string
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id?: string | null
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          template_id?: string | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
        }
        Update: {
          affiliate_id?: string
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id?: string | null
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          template_id?: string | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
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
          {
            foreignKeyName: "affiliate_commission_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "commission_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_goals: {
        Row: {
          affiliate_id: string
          brand: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          ftd_target: number
          id: string
          notes: string | null
          period: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          brand?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ftd_target?: number
          id?: string
          notes?: string | null
          period?: string | null
          scope?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          brand?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ftd_target?: number
          id?: string
          notes?: string | null
          period?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: []
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
      affiliate_salary_deals: {
        Row: {
          affiliate_id: string
          breakeven_ftd_monthly: number | null
          cpa_bonus_amount: number | null
          cpa_bonus_threshold: number | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          salary_amount: number
          salary_currency: string
          selections: Json
          start_date: string
          status: Database["public"]["Enums"]["salary_deal_status"]
          trial_months: number | null
          trigger_breakeven_pct: number | null
          trigger_min_activity_ratio: number | null
          trigger_min_conversion_pct: number | null
          trigger_min_ftd_monthly: number | null
          trigger_min_net_margin: number | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          breakeven_ftd_monthly?: number | null
          cpa_bonus_amount?: number | null
          cpa_bonus_threshold?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          salary_amount?: number
          salary_currency?: string
          selections?: Json
          start_date?: string
          status?: Database["public"]["Enums"]["salary_deal_status"]
          trial_months?: number | null
          trigger_breakeven_pct?: number | null
          trigger_min_activity_ratio?: number | null
          trigger_min_conversion_pct?: number | null
          trigger_min_ftd_monthly?: number | null
          trigger_min_net_margin?: number | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          breakeven_ftd_monthly?: number | null
          cpa_bonus_amount?: number | null
          cpa_bonus_threshold?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          salary_amount?: number
          salary_currency?: string
          selections?: Json
          start_date?: string
          status?: Database["public"]["Enums"]["salary_deal_status"]
          trial_months?: number | null
          trigger_breakeven_pct?: number | null
          trigger_min_activity_ratio?: number | null
          trigger_min_conversion_pct?: number | null
          trigger_min_ftd_monthly?: number | null
          trigger_min_net_margin?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_tracking_links: {
        Row: {
          affiliate_id: string
          brand: string | null
          client_id: string
          country_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          operator_campaign_id: string | null
          source: string
          source_request_id: string | null
          tracking_link: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          brand?: string | null
          client_id: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          operator_campaign_id?: string | null
          source?: string
          source_request_id?: string | null
          tracking_link: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          brand?: string | null
          client_id?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          operator_campaign_id?: string | null
          source?: string
          source_request_id?: string | null
          tracking_link?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          alias: string | null
          aliases: string[]
          bank_details: string | null
          brands: string[]
          commission_pct: number | null
          country_id: string | null
          country_ids: string[]
          created_at: string
          created_by: string | null
          email: string | null
          fixed_name: string
          fixed_remuneration: number | null
          fixed_remuneration_currency: string | null
          fixed_remuneration_fallback_cpa: number | null
          fixed_remuneration_fallback_cpa_currency: string | null
          fixed_remuneration_min_ftd: number | null
          id: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          slug: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          tax_id: string | null
          unique_id: string
          updated_at: string
        }
        Insert: {
          alias?: string | null
          aliases?: string[]
          bank_details?: string | null
          brands?: string[]
          commission_pct?: number | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          fixed_name: string
          fixed_remuneration?: number | null
          fixed_remuneration_currency?: string | null
          fixed_remuneration_fallback_cpa?: number | null
          fixed_remuneration_fallback_cpa_currency?: string | null
          fixed_remuneration_min_ftd?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          tax_id?: string | null
          unique_id: string
          updated_at?: string
        }
        Update: {
          alias?: string | null
          aliases?: string[]
          bank_details?: string | null
          brands?: string[]
          commission_pct?: number | null
          country_id?: string | null
          country_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string | null
          fixed_name?: string
          fixed_remuneration?: number | null
          fixed_remuneration_currency?: string | null
          fixed_remuneration_fallback_cpa?: number | null
          fixed_remuneration_fallback_cpa_currency?: string | null
          fixed_remuneration_min_ftd?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          slug?: string | null
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
      brand_cpa_goals: {
        Row: {
          brand: string
          cpa_target: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period: string
          updated_at: string
        }
        Insert: {
          brand: string
          cpa_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period: string
          updated_at?: string
        }
        Update: {
          brand?: string
          cpa_target?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      calculator_simulations: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          prospect_name: string | null
          selections: Json
          total_fijo_usd: number
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          prospect_name?: string | null
          selections?: Json
          total_fijo_usd?: number
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          prospect_name?: string | null
          selections?: Json
          total_fijo_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_commission_plans: {
        Row: {
          baseline: number | null
          baseline_currency: string | null
          brand: string | null
          cap: number | null
          client_id: string
          conversion_type: string | null
          country_id: string | null
          country_ids: string[]
          cpa: number | null
          cpa_at_80: number | null
          cpa_at_90: number | null
          cpa_currency: string | null
          cpl: number | null
          cpl_currency: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          fallback_cpa: number | null
          fixed_margin_pct: number | null
          id: string
          overoption_retention: number | null
          plan_start_date: string | null
          proportional_enabled: boolean
          proportional_min_pct: number | null
          recommended_margin_pct: number | null
          rev_share_pct: number | null
          updated_at: string
          wager: number | null
          wager_currency: string | null
        }
        Insert: {
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id: string
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_at_80?: number | null
          cpa_at_90?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          fallback_cpa?: number | null
          fixed_margin_pct?: number | null
          id?: string
          overoption_retention?: number | null
          plan_start_date?: string | null
          proportional_enabled?: boolean
          proportional_min_pct?: number | null
          recommended_margin_pct?: number | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
        }
        Update: {
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id?: string
          conversion_type?: string | null
          country_id?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_at_80?: number | null
          cpa_at_90?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          fallback_cpa?: number | null
          fixed_margin_pct?: number | null
          id?: string
          overoption_retention?: number | null
          plan_start_date?: string | null
          proportional_enabled?: boolean
          proportional_min_pct?: number | null
          recommended_margin_pct?: number | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
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
          logo_url: string | null
          net_min_cpa: number | null
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
          logo_url?: string | null
          net_min_cpa?: number | null
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
          logo_url?: string | null
          net_min_cpa?: number | null
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
      commission_plan_templates: {
        Row: {
          baseline: number | null
          baseline_currency: string | null
          brand: string | null
          cap: number | null
          client_id: string | null
          comentarios: string | null
          conversion_type: string | null
          country_ids: string[]
          cpa: number | null
          cpa_currency: string | null
          cpl: number | null
          cpl_currency: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          name: string
          plan_start_date: string | null
          rev_share_pct: number | null
          updated_at: string
          wager: number | null
          wager_currency: string | null
        }
        Insert: {
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id?: string | null
          comentarios?: string | null
          conversion_type?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
        }
        Update: {
          baseline?: number | null
          baseline_currency?: string | null
          brand?: string | null
          cap?: number | null
          client_id?: string | null
          comentarios?: string | null
          conversion_type?: string | null
          country_ids?: string[]
          cpa?: number | null
          cpa_currency?: string | null
          cpl?: number | null
          cpl_currency?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name?: string
          plan_start_date?: string | null
          rev_share_pct?: number | null
          updated_at?: string
          wager?: number | null
          wager_currency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_plan_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          analysis_error: string | null
          analysis_extracted: Json | null
          analysis_summary: string | null
          analyzed_at: string | null
          category: string | null
          client_id: string
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          status: string
          updated_at: string
        }
        Insert: {
          analysis_error?: string | null
          analysis_extracted?: Json | null
          analysis_summary?: string | null
          analyzed_at?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          analysis_error?: string | null
          analysis_extracted?: Json | null
          analysis_summary?: string | null
          analyzed_at?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_findings: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          client_id: string
          context: Json | null
          created_at: string
          detail: string | null
          document_id: string
          id: string
          kind: string
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          client_id: string
          context?: Json | null
          created_at?: string
          detail?: string | null
          document_id: string
          id?: string
          kind?: string
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          client_id?: string
          context?: Json | null
          created_at?: string
          detail?: string | null
          document_id?: string
          id?: string
          kind?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_findings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          affiliate_id: string
          country_id: string | null
          created_at: string
          created_by: string | null
          hero_image_url: string | null
          id: string
          intro: string | null
          is_published: boolean
          notes: string | null
          operator_ids: string[]
          seo_description: string | null
          seo_title: string | null
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          is_published?: boolean
          notes?: string | null
          operator_ids?: string[]
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          is_published?: boolean
          notes?: string | null
          operator_ids?: string[]
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_menu_permissions: {
        Row: {
          created_at: string
          id: string
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          menu_key?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      tracking_link_requests: {
        Row: {
          admin_notes: string | null
          affiliate_id: string
          brand: string | null
          client_id: string
          country_id: string | null
          created_at: string
          id: string
          notes: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["tracking_link_request_status"]
          tracking_link: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          affiliate_id: string
          brand?: string | null
          client_id: string
          country_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["tracking_link_request_status"]
          tracking_link?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          affiliate_id?: string
          brand?: string | null
          client_id?: string
          country_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["tracking_link_request_status"]
          tracking_link?: string | null
          updated_at?: string
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
      get_public_landing_page: {
        Args: { _affiliate_slug: string; _country_code: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      slugify: { Args: { _txt: string }; Returns: string }
      unaccent_safe: { Args: { _txt: string }; Returns: string }
    }
    Enums: {
      affiliate_status: "active" | "inactive" | "pending" | "prospect"
      app_role: "super_admin" | "admin" | "user" | "comercial" | "affiliate"
      client_status: "active" | "inactive" | "prospect"
      closure_status: "draft" | "confirmed" | "paid"
      salary_deal_status: "active" | "paused" | "ended"
      tracking_link_request_status: "pending" | "created" | "rejected"
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
      affiliate_status: ["active", "inactive", "pending", "prospect"],
      app_role: ["super_admin", "admin", "user", "comercial", "affiliate"],
      client_status: ["active", "inactive", "prospect"],
      closure_status: ["draft", "confirmed", "paid"],
      salary_deal_status: ["active", "paused", "ended"],
      tracking_link_request_status: ["pending", "created", "rejected"],
    },
  },
} as const
