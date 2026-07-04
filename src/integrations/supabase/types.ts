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
      admin_actions: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          result: Json
          status: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          result?: Json
          status?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          result?: Json
          status?: string
          target?: string | null
        }
        Relationships: []
      }
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
      discovery_runs: {
        Row: {
          capabilities_found: number
          created_at: string
          errors: Json
          errors_count: number
          finished_at: string | null
          id: string
          initiated_by: string | null
          services_found: number
          site_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          capabilities_found?: number
          created_at?: string
          errors?: Json
          errors_count?: number
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          services_found?: number
          site_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          capabilities_found?: number
          created_at?: string
          errors?: Json
          errors_count?: number
          finished_at?: string | null
          id?: string
          initiated_by?: string | null
          services_found?: number
          site_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      external_schema_mirrors: {
        Row: {
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_sync_at: string | null
          payload_hash: string | null
          source_name: string
          status: string
          tables_count: number
          tables_snapshot: Json | null
          target_name: string
          target_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          payload_hash?: string | null
          source_name?: string
          status?: string
          tables_count?: number
          tables_snapshot?: Json | null
          target_name: string
          target_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          payload_hash?: string | null
          source_name?: string
          status?: string
          tables_count?: number
          tables_snapshot?: Json | null
          target_name?: string
          target_url?: string
          updated_at?: string
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
      hn_agent_runs: {
        Row: {
          agent_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          output: Json | null
          started_at: string
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hn_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hn_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_agents: {
        Row: {
          agent_number: number
          created_at: string
          description: string | null
          id: string
          inputs: Json
          is_active: boolean
          last_run_at: string | null
          last_run_status: string | null
          name: string
          outputs: Json
          role: string
          runs_count: number
          runtime_path: string | null
          script_content: string | null
          script_lang: string
          service_id: string | null
          service_name: string | null
          site_id: string | null
          site_name: string | null
          slug: string
          tools: string[]
          updated_at: string
        }
        Insert: {
          agent_number?: number
          created_at?: string
          description?: string | null
          id?: string
          inputs?: Json
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          outputs?: Json
          role?: string
          runs_count?: number
          runtime_path?: string | null
          script_content?: string | null
          script_lang?: string
          service_id?: string | null
          service_name?: string | null
          site_id?: string | null
          site_name?: string | null
          slug: string
          tools?: string[]
          updated_at?: string
        }
        Update: {
          agent_number?: number
          created_at?: string
          description?: string | null
          id?: string
          inputs?: Json
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          outputs?: Json
          role?: string
          runs_count?: number
          runtime_path?: string | null
          script_content?: string | null
          script_lang?: string
          service_id?: string | null
          service_name?: string | null
          site_id?: string | null
          site_name?: string | null
          slug?: string
          tools?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hn_agents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hn_agents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_payment_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          metadata: Json
          provider: string
          provider_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          provider?: string
          provider_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          provider?: string
          provider_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hn_payment_products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          interval: string | null
          metadata: Json
          name: string
          price_cents: number
          provider: string
          provider_price_id: string | null
          provider_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: string | null
          metadata?: Json
          name: string
          price_cents?: number
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: string | null
          metadata?: Json
          name?: string
          price_cents?: number
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hn_payment_subscriptions: {
        Row: {
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          metadata: Json
          product_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          metadata?: Json
          product_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hn_payment_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hn_payment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      hn_payment_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          product_id: string | null
          provider: string
          provider_transaction_id: string | null
          raw: Json
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          raw?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          product_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          raw?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hn_payment_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hn_payment_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hn_payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "hn_payment_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_engines: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          last_activated_at: string | null
          name: string
          slug: string
          stage_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_activated_at?: string | null
          name: string
          slug: string
          stage_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_activated_at?: string | null
          name?: string
          slug?: string
          stage_order?: number
          updated_at?: string
        }
        Relationships: []
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
      hub_plans: {
        Row: {
          api_key_id: string | null
          auth_mode: string
          created_at: string
          entities: Json
          error: string | null
          final_response: Json | null
          id: string
          internal_connector_id: string | null
          language: string | null
          plan_graph: Json
          prompt: string
          request_id: string | null
          requester_site: string | null
          status: string
          timings: Json
          updated_at: string
          user_intent: string | null
        }
        Insert: {
          api_key_id?: string | null
          auth_mode?: string
          created_at?: string
          entities?: Json
          error?: string | null
          final_response?: Json | null
          id?: string
          internal_connector_id?: string | null
          language?: string | null
          plan_graph?: Json
          prompt: string
          request_id?: string | null
          requester_site?: string | null
          status?: string
          timings?: Json
          updated_at?: string
          user_intent?: string | null
        }
        Update: {
          api_key_id?: string | null
          auth_mode?: string
          created_at?: string
          entities?: Json
          error?: string | null
          final_response?: Json | null
          id?: string
          internal_connector_id?: string | null
          language?: string | null
          plan_graph?: Json
          prompt?: string
          request_id?: string | null
          requester_site?: string | null
          status?: string
          timings?: Json
          updated_at?: string
          user_intent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_plans_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_plans_internal_connector_id_fkey"
            columns: ["internal_connector_id"]
            isOneToOne: false
            referencedRelation: "internal_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_plans_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
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
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_subtasks: {
        Row: {
          assigned_provider_site: string | null
          assigned_service_id: string | null
          attempts: number
          capability_id: string | null
          created_at: string
          depends_on: string[]
          engine_stage: string | null
          error: string | null
          finished_at: string | null
          id: string
          input_payload: Json | null
          intent: string | null
          kind: string
          latency_ms: number | null
          output_payload: Json | null
          pipeline_id: string
          plan_id: string | null
          plan_step: number | null
          started_at: string | null
          status: string
          status_code: number | null
          task_key: string | null
          task_order: number
          task_type: string | null
          updated_at: string
        }
        Insert: {
          assigned_provider_site?: string | null
          assigned_service_id?: string | null
          attempts?: number
          capability_id?: string | null
          created_at?: string
          depends_on?: string[]
          engine_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          intent?: string | null
          kind: string
          latency_ms?: number | null
          output_payload?: Json | null
          pipeline_id: string
          plan_id?: string | null
          plan_step?: number | null
          started_at?: string | null
          status?: string
          status_code?: number | null
          task_key?: string | null
          task_order?: number
          task_type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_provider_site?: string | null
          assigned_service_id?: string | null
          attempts?: number
          capability_id?: string | null
          created_at?: string
          depends_on?: string[]
          engine_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          intent?: string | null
          kind?: string
          latency_ms?: number | null
          output_payload?: Json | null
          pipeline_id?: string
          plan_id?: string | null
          plan_step?: number | null
          started_at?: string | null
          status?: string
          status_code?: number | null
          task_key?: string | null
          task_order?: number
          task_type?: string | null
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
            foreignKeyName: "pipeline_subtasks_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "site_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_subtasks_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_subtasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "hub_plans"
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
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
      service_capabilities: {
        Row: {
          capability: string
          category: string | null
          confidence: number
          created_at: string
          description: string | null
          id: string
          input_schema: Json
          is_active: boolean
          metadata: Json
          output_schema: Json
          priority: number
          service_id: string
          task_type: string
          updated_at: string
        }
        Insert: {
          capability: string
          category?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          is_active?: boolean
          metadata?: Json
          output_schema?: Json
          priority?: number
          service_id: string
          task_type: string
          updated_at?: string
        }
        Update: {
          capability?: string
          category?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          is_active?: boolean
          metadata?: Json
          output_schema?: Json
          priority?: number
          service_id?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_capabilities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
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
      service_metrics: {
        Row: {
          avg_duration_ms: number
          created_at: string
          id: string
          last_error: string | null
          last_run_at: string | null
          metadata: Json
          p95_duration_ms: number
          requests_failed: number
          requests_success: number
          requests_total: number
          service_id: string
          success_rate: number
          updated_at: string
          window_end: string | null
          window_start: string
        }
        Insert: {
          avg_duration_ms?: number
          created_at?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          metadata?: Json
          p95_duration_ms?: number
          requests_failed?: number
          requests_success?: number
          requests_total?: number
          service_id: string
          success_rate?: number
          updated_at?: string
          window_end?: string | null
          window_start?: string
        }
        Update: {
          avg_duration_ms?: number
          created_at?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          metadata?: Json
          p95_duration_ms?: number
          requests_failed?: number
          requests_success?: number
          requests_total?: number
          service_id?: string
          success_rate?: number
          updated_at?: string
          window_end?: string | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_metrics_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_registry: {
        Row: {
          category: string | null
          created_at: string
          domain: string | null
          endpoint_url: string | null
          health: string
          id: string
          metadata: Json
          name: string
          service_ref_id: string | null
          service_type: string | null
          site_id: string | null
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          domain?: string | null
          endpoint_url?: string | null
          health?: string
          id?: string
          metadata?: Json
          name: string
          service_ref_id?: string | null
          service_type?: string | null
          site_id?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          domain?: string | null
          endpoint_url?: string | null
          health?: string
          id?: string
          metadata?: Json
          name?: string
          service_ref_id?: string | null
          service_type?: string | null
          site_id?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_registry_service_ref_id_fkey"
            columns: ["service_ref_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_registry_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
          capabilities: string[]
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
          capabilities?: string[]
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
          capabilities?: string[]
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
      site_capabilities: {
        Row: {
          created_at: string
          id: string
          input_schema: Json
          last_ok_at: string | null
          last_probed_at: string | null
          metadata: Json
          output_schema: Json
          probe_error: string | null
          service_id: string
          site_id: string
          source: Database["public"]["Enums"]["capability_source"]
          status: Database["public"]["Enums"]["capability_status"]
          task_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_schema?: Json
          last_ok_at?: string | null
          last_probed_at?: string | null
          metadata?: Json
          output_schema?: Json
          probe_error?: string | null
          service_id: string
          site_id: string
          source?: Database["public"]["Enums"]["capability_source"]
          status?: Database["public"]["Enums"]["capability_status"]
          task_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          input_schema?: Json
          last_ok_at?: string | null
          last_probed_at?: string | null
          metadata?: Json
          output_schema?: Json
          probe_error?: string | null
          service_id?: string
          site_id?: string
          source?: Database["public"]["Enums"]["capability_source"]
          status?: Database["public"]["Enums"]["capability_status"]
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_capabilities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_capabilities_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_secrets: {
        Row: {
          created_at: string
          hn_hub_key: string | null
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hn_hub_key?: string | null
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hn_hub_key?: string | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_secrets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
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
          manifest_path: string
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
          manifest_path?: string
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
          manifest_path?: string
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
      task_router: {
        Row: {
          category: string | null
          conditions: Json
          created_at: string
          fallback_service_ids: string[]
          id: string
          is_active: boolean
          notes: string | null
          preferred_service_id: string | null
          priority: number
          task_type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          conditions?: Json
          created_at?: string
          fallback_service_ids?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          preferred_service_id?: string | null
          priority?: number
          task_type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          conditions?: Json
          created_at?: string
          fallback_service_ids?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          preferred_service_id?: string | null
          priority?: number
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_router_preferred_service_id_fkey"
            columns: ["preferred_service_id"]
            isOneToOne: false
            referencedRelation: "service_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      task_router_rules: {
        Row: {
          category: string | null
          conditions: Json
          created_at: string
          fallback_service_ids: string[]
          id: string
          is_active: boolean
          notes: string | null
          preferred_service_id: string | null
          priority: number
          task_type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          conditions?: Json
          created_at?: string
          fallback_service_ids?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          preferred_service_id?: string | null
          priority?: number
          task_type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          conditions?: Json
          created_at?: string
          fallback_service_ids?: string[]
          id?: string
          is_active?: boolean
          notes?: string | null
          preferred_service_id?: string | null
          priority?: number
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_router_rules_preferred_service_id_fkey"
            columns: ["preferred_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      task_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          requested_by: string | null
          result: Json
          router_id: string | null
          service_id: string | null
          started_at: string | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          requested_by?: string | null
          result?: Json
          router_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          requested_by?: string | null
          result?: Json
          router_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_runs_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "task_router"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_runs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      task_steps: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          name: string
          output: Json
          service_id: string | null
          started_at: string | null
          status: string
          step_order: number
          task_run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          name: string
          output?: Json
          service_id?: string | null
          started_at?: string | null
          status?: string
          step_order?: number
          task_run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          name?: string
          output?: Json
          service_id?: string | null
          started_at?: string | null
          status?: string
          step_order?: number
          task_run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_steps_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
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
      websites_services: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          path: string | null
          service_id: string | null
          service_name: string
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          path?: string | null
          service_id?: string | null
          service_name: string
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          path?: string | null
          service_id?: string | null
          service_name?: string
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_services_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
      capability_source: "manifest" | "manual" | "inferred"
      capability_status: "online" | "degraded" | "offline" | "unknown"
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
      capability_source: ["manifest", "manual", "inferred"],
      capability_status: ["online", "degraded", "offline", "unknown"],
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
