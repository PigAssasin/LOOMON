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
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          email: string | null
          location: string | null
          bio: string | null
          preferred_locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          location?: string | null
          bio?: string | null
          preferred_locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          location?: string | null
          bio?: string | null
          preferred_locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_follows: {
        Row: {
          created_at: string
          maker_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          maker_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          maker_id?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      published_products: {
        Row: {
          currency_code: string | null
          customizable: boolean | null
          id: number | null
          lead_time_max_days: number | null
          lead_time_min_days: number | null
          locale: string | null
          maker_id: number | null
          maker_name: string | null
          minimum_order_quantity: number | null
          price_from: number | null
          product_version_id: number | null
          production_model: string | null
          province_code: string | null
          short_description: string | null
          slug: string | null
          story: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_variant_inventory: {
        Args: {
          expected_version: number
          movement_type: string
          quantity: number
          reason: string
          request_key: string
          source?: string
          target_order_id?: string
          target_variant_id: number
        }
        Returns: Json
      }
      archive_product: {
        Args: {
          reason: string
          request_key: string
          source?: string
          target_product_id: number
        }
        Returns: Json
      }
      claim_due_email_reminders: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_product_media_cleanup_jobs: {
        Args: { batch_size?: number; worker_id: string }
        Returns: {
          attempt: number
          job_id: number
          media_asset_id: number
          storage_bucket: string
          storage_path: string
        }[]
      }
      complete_product_media_cleanup_job: {
        Args: {
          error_message?: string
          succeeded: boolean
          target_job_id: number
        }
        Returns: undefined
      }
      delete_product_draft: {
        Args: {
          confirmation_slug: string
          request_key: string
          target_product_id: number
        }
        Returns: Json
      }
      get_my_seller_memberships: {
        Args: never
        Returns: {
          maker_id: number
          maker_name: string
          maker_slug: string
          membership_role: string
          membership_status: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: Json
      }
      update_my_profile: {
        Args: {
          p_bio: string
          p_display_name: string
          p_email: string
          p_location: string
          p_preferred_locale?: string
        }
        Returns: Json
      }
      sync_my_web3_wallet: {
        Args: { p_address: string }
        Returns: Json
      }
      list_claimable_demo_makers: {
        Args: never
        Returns: {
          id: number
          slug: string
          display_name: string
        }[]
      }
      list_my_followed_stores: {
        Args: never
        Returns: { maker_slug: string }[]
      }
      toggle_store_follow: {
        Args: { p_maker_slug: string }
        Returns: Json
      }
      claim_demo_maker: {
        Args: { p_maker_id: number }
        Returns: Json
      }
      get_my_commerce_workspace: {
        Args: never
        Returns: Json
      }
      transition_quote_request: {
        Args: {
          p_action: string
          p_reason: string
          p_request_id: string
          p_request_key: string
        }
        Returns: Json
      }
      transition_demo_order: {
        Args: {
          p_action: string
          p_order_id: string
          p_reason: string
          p_request_key: string
        }
        Returns: Json
      }
      list_thread_messages: {
        Args: { p_thread_id: string }
        Returns: Json
      }
      send_thread_message: {
        Args: { p_body: string; p_thread_id: string }
        Returns: Json
      }
      restore_archived_product: {
        Args: { request_key: string; target_product_id: number }
        Returns: Json
      }
      search_published_products: {
        Args: {
          maximum_lead_time_days?: number
          maximum_unit_amount?: number
          query_text: string
          requested_locale?: string
          requested_quantity?: number
          result_limit?: number
        }
        Returns: {
          currency_code: string
          keyword_rank: number
          lead_time_max_days: number
          lead_time_min_days: number
          maker_name: string
          minimum_order_quantity: number
          price_from: number
          product_id: number
          product_version_id: number
          slug: string
          title: string
        }[]
      }
      server_adjust_variant_inventory: {
        Args: {
          actor_user_id: string
          expected_maker_id: number
          expected_version: number
          movement_type: string
          quantity: number
          reason: string
          request_key: string
          source?: string
          target_order_id?: string
          target_variant_id: number
        }
        Returns: Json
      }
      server_archive_product: {
        Args: {
          actor_user_id: string
          expected_maker_id: number
          reason: string
          request_key: string
          source?: string
          target_product_id: number
        }
        Returns: Json
      }
      server_confirm_order_proof: {
        Args: {
          target_block_number: number
          target_log_index: number
          target_metadata_uri: string
          target_payload_hash: string
          target_proof_id: string
          target_token_id: number
          target_transaction_hash: string
        }
        Returns: Json
      }
      server_delete_product_draft: {
        Args: {
          actor_user_id: string
          confirmation_slug: string
          expected_maker_id: number
          request_key: string
          target_product_id: number
        }
        Returns: Json
      }
      server_fail_order_proof: {
        Args: {
          target_failure_code: string
          target_proof_id: string
        }
        Returns: Json
      }
      server_get_product_reference_impact: {
        Args: {
          actor_user_id: string
          expected_maker_id: number
          target_product_id: number
        }
        Returns: Json
      }
      server_mark_order_proof_submitted: {
        Args: {
          target_contract_address: string
          target_proof_id: string
          target_transaction_hash: string
        }
        Returns: Json
      }
      server_prepare_order_proof: {
        Args: {
          request_key: string
          target_order_hash: string
          target_order_id: string
          target_recipient_wallet_address: string
          target_snapshot_hash: string
        }
        Returns: Json
      }
      server_prepare_delivered_order_proof: {
        Args: {
          request_key: string
          target_order_hash: string
          target_order_id: string
          target_recipient_wallet_address: string
          target_snapshot_hash: string
        }
        Returns: Json
      }
      server_restore_archived_product: {
        Args: {
          actor_user_id: string
          expected_maker_id: number
          request_key: string
          target_product_id: number
        }
        Returns: Json
      }
      server_set_product_availability: {
        Args: {
          actor_user_id: string
          expected_available_at: string
          expected_maker_id: number
          expected_version: number
          reason: string
          request_key: string
          source?: string
          target_product_id: number
          target_status: string
        }
        Returns: Json
      }
      set_product_availability: {
        Args: {
          expected_available_at: string
          expected_version: number
          reason: string
          request_key: string
          source?: string
          target_product_id: number
          target_status: string
        }
        Returns: Json
      }
      submit_customization_quote: {
        Args: {
          p_asset_bytes?: number
          p_asset_path?: string
          p_asset_role?: string
          p_checksum_sha256?: string
          p_client_request_key: string
          p_file_name?: string
          p_intent: string
          p_mime_type?: string
          p_notes: string
          p_preview_label?: string
          p_product_slug: string
          p_quantity: number
          p_required_by: string | null
          p_source_asset_bytes?: number
          p_source_asset_path?: string
          p_source_checksum_sha256?: string
          p_source_file_name?: string
          p_source_mime_type?: string
        }
        Returns: Json
      }
      prepare_prepaid_checkout: {
        Args: {
          p_buyer_address: string
          p_client_request_key: string
          p_quote_request_id: string
        }
        Returns: Json
      }
      server_confirm_prepaid_order: {
        Args: {
          p_block_number: number
          p_checkout_id: string
          p_event_payload: Json
          p_log_index: number
          p_transaction_hash: string
        }
        Returns: Json
      }
      server_get_prepaid_checkout: {
        Args: { p_checkout_id: string }
        Returns: Json
      }
      get_order_escrow_context: {
        Args: {
          p_order_id: string
        }
        Returns: Json
      }
      get_order_brief_assets: {
        Args: {
          p_order_id: string
        }
        Returns: Json
      }
      server_project_escrow_action: {
        Args: {
          p_action: string
          p_block_number: number
          p_event_payload: Json
          p_log_index: number
          p_order_id: string
          p_transaction_hash: string
        }
        Returns: Json
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
