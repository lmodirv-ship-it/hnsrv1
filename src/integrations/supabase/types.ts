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
      api_clients: {
        Row: {
          allowed_services: string[] | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          rate_limit_per_min: number
        }
        Insert: {
          allowed_services?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          rate_limit_per_min?: number
        }
        Update: {
          allowed_services?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          rate_limit_per_min?: number
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          revoked_at: string | null
          scopes: string[] | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          requested_by: string | null
          result: Json | null
          status: string
          url: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          requested_by?: string | null
          result?: Json | null
          status?: string
          url: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          requested_by?: string | null
          result?: Json | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      fallback_rules: {
        Row: {
          created_at: string
          enabled: boolean
          fallback_service_id: string | null
          id: string
          intent_pattern: string
          notes: string | null
          owner_id: string | null
          primary_service_id: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          fallback_service_id?: string | null
          id?: string
          intent_pattern: string
          notes?: string | null
          owner_id?: string | null
          primary_service_id?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          fallback_service_id?: string | null
          id?: string
          intent_pattern?: string
          notes?: string | null
          owner_id?: string | null
          primary_service_id?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fallback_rules_fallback_service_id_fkey"
            columns: ["fallback_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fallback_rules_primary_service_id_fkey"
            columns: ["primary_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_integrations: {
        Row: {
          base_url: string | null
          created_at: string
          enabled: boolean
          hub: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          last_status: string | null
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          hub: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          hub?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_connectors: {
        Row: {
          allowed_internal_services: Json
          connector_status: string
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          site_id: string
          token_hash: string
          token_prefix: string
          trust_level: string
          updated_at: string
        }
        Insert: {
          allowed_internal_services?: Json
          connector_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          site_id: string
          token_hash: string
          token_prefix: string
          trust_level?: string
          updated_at?: string
        }
        Update: {
          allowed_internal_services?: Json
          connector_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          site_id?: string
          token_hash?: string
          token_prefix?: string
          trust_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_connectors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: string
          site_id: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          kind: string
          site_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_subtasks: {
        Row: {
          assigned_provider_site: string | null
          assigned_service_id: string | null
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input_payload: Json | null
          intent: string | null
          kind: string
          latency_ms: number | null
          output_payload: Json | null
          pipeline_id: string
          started_at: string | null
          status: string
          status_code: number | null
          task_order: number
          updated_at: string
        }
        Insert: {
          assigned_provider_site?: string | null
          assigned_service_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          intent?: string | null
          kind: string
          latency_ms?: number | null
          output_payload?: Json | null
          pipeline_id: string
          started_at?: string | null
          status?: string
          status_code?: number | null
          task_order?: number
          updated_at?: string
        }
        Update: {
          assigned_provider_site?: string | null
          assigned_service_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          intent?: string | null
          kind?: string
          latency_ms?: number | null
          output_payload?: Json | null
          pipeline_id?: string
          started_at?: string | null
          status?: string
          status_code?: number | null
          task_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_subtasks_assigned_service_id_fkey"
            columns: ["assigned_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_subtasks_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          api_key_id: string | null
          auth_mode: string | null
          client_id: string | null
          created_at: string
          error: string | null
          final_package: Json | null
          finished_at: string | null
          gateway_site: string | null
          id: string
          input_payload: Json | null
          intent: string
          internal_connector_id: string | null
          journey_path: Json
          latency_ms: number | null
          owner_id: string | null
          prompt: string | null
          requester_site: string | null
          started_at: string | null
          status: string
          subtasks_done: number
          subtasks_total: number
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          auth_mode?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          final_package?: Json | null
          finished_at?: string | null
          gateway_site?: string | null
          id?: string
          input_payload?: Json | null
          intent: string
          internal_connector_id?: string | null
          journey_path?: Json
          latency_ms?: number | null
          owner_id?: string | null
          prompt?: string | null
          requester_site?: string | null
          started_at?: string | null
          status?: string
          subtasks_done?: number
          subtasks_total?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          auth_mode?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          final_package?: Json | null
          finished_at?: string | null
          gateway_site?: string | null
          id?: string
          input_payload?: Json | null
          intent?: string
          internal_connector_id?: string | null
          journey_path?: Json
          latency_ms?: number | null
          owner_id?: string | null
          prompt?: string | null
          requester_site?: string | null
          started_at?: string | null
          status?: string
          subtasks_done?: number
          subtasks_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_internal_connector_id_fkey"
            columns: ["internal_connector_id"]
            isOneToOne: false
            referencedRelation: "internal_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_dependencies: {
        Row: {
          confidence: number
          consumer_site_id: string | null
          created_at: string
          depends_on_service_id: string | null
          depends_on_system: string | null
          id: string
          relation_type: string
          service_id: string
          source: string
        }
        Insert: {
          confidence?: number
          consumer_site_id?: string | null
          created_at?: string
          depends_on_service_id?: string | null
          depends_on_system?: string | null
          id?: string
          relation_type?: string
          service_id: string
          source?: string
        }
        Update: {
          confidence?: number
          consumer_site_id?: string | null
          created_at?: string
          depends_on_service_id?: string | null
          depends_on_system?: string | null
          id?: string
          relation_type?: string
          service_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_dependencies_consumer_site_id_fkey"
            columns: ["consumer_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_depends_on_service_id_fkey"
            columns: ["depends_on_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_dependencies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health: {
        Row: {
          checked_at: string
          error: string | null
          id: string
          latency_ms: number | null
          service_id: string
          status: string
        }
        Insert: {
          checked_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          service_id: string
          status: string
        }
        Update: {
          checked_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_health_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          api_key_id: string | null
          attempts: number
          auth_mode: string | null
          client_id: string | null
          created_at: string
          error: string | null
          execution_status: string | null
          fallback_used: boolean
          gateway_site: string | null
          id: string
          internal_connector_id: string | null
          journey_path: Json
          latency_ms: number | null
          method: string | null
          provider_site: string | null
          request_payload: Json | null
          requester_site: string | null
          response_payload: Json | null
          routing_decision: Json | null
          service_id: string | null
          service_intent: string | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          attempts?: number
          auth_mode?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          execution_status?: string | null
          fallback_used?: boolean
          gateway_site?: string | null
          id?: string
          internal_connector_id?: string | null
          journey_path?: Json
          latency_ms?: number | null
          method?: string | null
          provider_site?: string | null
          request_payload?: Json | null
          requester_site?: string | null
          response_payload?: Json | null
          routing_decision?: Json | null
          service_id?: string | null
          service_intent?: string | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          attempts?: number
          auth_mode?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          execution_status?: string | null
          fallback_used?: boolean
          gateway_site?: string | null
          id?: string
          internal_connector_id?: string | null
          journey_path?: Json
          latency_ms?: number | null
          method?: string | null
          provider_site?: string | null
          request_payload?: Json | null
          requester_site?: string | null
          response_payload?: Json | null
          routing_decision?: Json | null
          service_id?: string | null
          service_intent?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_internal_connector_id_fkey"
            columns: ["internal_connector_id"]
            isOneToOne: false
            referencedRelation: "internal_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          api_required: boolean
          approval_status: string
          category: string | null
          confidence_score: number
          created_at: string
          description: string | null
          discovered_from_job_id: string | null
          endpoint_path: string | null
          endpoint_url: string | null
          gateway_url: string | null
          id: string
          input_schema: Json | null
          is_active: boolean
          last_health_status: string | null
          last_tested_at: string | null
          method: string
          name: string
          network_type: Database["public"]["Enums"]["network_type"]
          output_schema: Json | null
          rate_limit_per_min: number
          routing_mode: string
          scopes: string[]
          site_id: string
          slug: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          api_required?: boolean
          approval_status?: string
          category?: string | null
          confidence_score?: number
          created_at?: string
          description?: string | null
          discovered_from_job_id?: string | null
          endpoint_path?: string | null
          endpoint_url?: string | null
          gateway_url?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean
          last_health_status?: string | null
          last_tested_at?: string | null
          method?: string
          name: string
          network_type?: Database["public"]["Enums"]["network_type"]
          output_schema?: Json | null
          rate_limit_per_min?: number
          routing_mode?: string
          scopes?: string[]
          site_id: string
          slug: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          api_required?: boolean
          approval_status?: string
          category?: string | null
          confidence_score?: number
          created_at?: string
          description?: string | null
          discovered_from_job_id?: string | null
          endpoint_path?: string | null
          endpoint_url?: string | null
          gateway_url?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean
          last_health_status?: string | null
          last_tested_at?: string | null
          method?: string
          name?: string
          network_type?: Database["public"]["Enums"]["network_type"]
          output_schema?: Json | null
          rate_limit_per_min?: number
          routing_mode?: string
          scopes?: string[]
          site_id?: string
          slug?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          base_url: string
          category: string | null
          created_at: string
          description: string | null
          discovered_at: string | null
          hn_cloud_id: string | null
          hn_db_id: string | null
          id: string
          integration_log: Json
          layer: Database["public"]["Enums"]["site_layer"]
          logo_url: string | null
          metadata: Json
          name: string
          network_type: Database["public"]["Enums"]["network_type"]
          owner_id: string | null
          role: string | null
          slug: string
          status: string
          tvcc_id: string | null
          updated_at: string
        }
        Insert: {
          base_url: string
          category?: string | null
          created_at?: string
          description?: string | null
          discovered_at?: string | null
          hn_cloud_id?: string | null
          hn_db_id?: string | null
          id?: string
          integration_log?: Json
          layer?: Database["public"]["Enums"]["site_layer"]
          logo_url?: string | null
          metadata?: Json
          name: string
          network_type?: Database["public"]["Enums"]["network_type"]
          owner_id?: string | null
          role?: string | null
          slug: string
          status?: string
          tvcc_id?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string
          category?: string | null
          created_at?: string
          description?: string | null
          discovered_at?: string | null
          hn_cloud_id?: string | null
          hn_db_id?: string | null
          id?: string
          integration_log?: Json
          layer?: Database["public"]["Enums"]["site_layer"]
          logo_url?: string | null
          metadata?: Json
          name?: string
          network_type?: Database["public"]["Enums"]["network_type"]
          owner_id?: string | null
          role?: string | null
          slug?: string
          status?: string
          tvcc_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "developer" | "viewer"
      network_type: "internal" | "external"
      site_layer:
        | "gateway"
        | "orchestrator"
        | "app"
        | "provider"
        | "infrastructure"
        | "unclassified"
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
      app_role: ["admin", "developer", "viewer"],
      network_type: ["internal", "external"],
      site_layer: [
        "gateway",
        "orchestrator",
        "app",
        "provider",
        "infrastructure",
        "unclassified",
      ],
    },
  },
} as const
