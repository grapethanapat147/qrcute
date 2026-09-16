export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      entitlements: {
        Row: {
          expires_at: string | null;
          feature: string;
          id: string;
          owner_id: string;
          quota: number | null;
          source: string;
        };
        Insert: {
          expires_at?: string | null;
          feature: string;
          id?: string;
          owner_id: string;
          quota?: number | null;
          source?: string;
        };
        Update: {
          expires_at?: string | null;
          feature?: string;
          id?: string;
          owner_id?: string;
          quota?: number | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_satang: number;
          created_at: string;
          currency: string;
          gateway: string;
          gateway_charge_id: string;
          id: string;
          owner_id: string | null;
          paid_at: string | null;
          price_code: string | null;
          status: string;
        };
        Insert: {
          amount_satang: number;
          created_at?: string;
          currency?: string;
          gateway: string;
          gateway_charge_id: string;
          id?: string;
          owner_id?: string | null;
          paid_at?: string | null;
          price_code?: string | null;
          status: string;
        };
        Update: {
          amount_satang?: number;
          created_at?: string;
          currency?: string;
          gateway?: string;
          gateway_charge_id?: string;
          id?: string;
          owner_id?: string | null;
          paid_at?: string | null;
          price_code?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      qr_codes: {
        Row: {
          content: Json;
          created_at: string;
          current_target: string | null;
          id: string;
          kind: string;
          owner_id: string;
          qr_type: string;
          shortcode: string | null;
          status: string;
          style: Json;
          suspended_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          current_target?: string | null;
          id?: string;
          kind: string;
          owner_id: string;
          qr_type: string;
          shortcode?: string | null;
          status?: string;
          style?: Json;
          suspended_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          current_target?: string | null;
          id?: string;
          kind?: string;
          owner_id?: string;
          qr_type?: string;
          shortcode?: string | null;
          status?: string;
          style?: Json;
          suspended_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_codes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          qr_code_id: string;
          target_url: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          qr_code_id: string;
          target_url: string;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          qr_code_id?: string;
          target_url?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "qr_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_versions_qr_code_id_fkey";
            columns: ["qr_code_id"];
            isOneToOne: false;
            referencedRelation: "qr_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      scans: {
        Row: {
          country: string | null;
          device_type: string | null;
          id: number;
          ip_hash: string | null;
          qr_code_id: string;
          referrer_host: string | null;
          region: string | null;
          scanned_at: string;
        };
        Insert: {
          country?: string | null;
          device_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          qr_code_id: string;
          referrer_host?: string | null;
          region?: string | null;
          scanned_at?: string;
        };
        Update: {
          country?: string | null;
          device_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          qr_code_id?: string;
          referrer_host?: string | null;
          region?: string | null;
          scanned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scans_qr_code_id_fkey";
            columns: ["qr_code_id"];
            isOneToOne: false;
            referencedRelation: "qr_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      shortcode_blocklist: {
        Row: {
          fragment: string;
        };
        Insert: {
          fragment: string;
        };
        Update: {
          fragment?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_kind: string | null;
          created_at: string;
          current_period_end: string | null;
          gateway: string | null;
          gateway_customer_id: string | null;
          gateway_subscription_id: string | null;
          grace_until: string | null;
          id: string;
          last_event_at: string | null;
          owner_id: string;
          plan: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          billing_kind?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          gateway?: string | null;
          gateway_customer_id?: string | null;
          gateway_subscription_id?: string | null;
          grace_until?: string | null;
          id?: string;
          last_event_at?: string | null;
          owner_id: string;
          plan?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          billing_kind?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          gateway?: string | null;
          gateway_customer_id?: string | null;
          gateway_subscription_id?: string | null;
          grace_until?: string | null;
          id?: string;
          last_event_at?: string | null;
          owner_id?: string;
          plan?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: {
          event_id: string;
          event_key: string;
          gateway: string;
          outcome: string | null;
          processed_at: string | null;
          raw_body: string;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_key: string;
          gateway: string;
          outcome?: string | null;
          processed_at?: string | null;
          raw_body: string;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_key?: string;
          gateway?: string;
          outcome?: string | null;
          processed_at?: string | null;
          raw_body?: string;
          received_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_billing_event: {
        Args: {
          p_billing_kind: string;
          p_current_period_end: string;
          p_event_at: string;
          p_grace_until: string;
          p_owner_id: string;
          p_plan: string;
          p_status: string;
        };
        Returns: boolean;
      };
      delete_expired_scans: { Args: never; Returns: number };
      free_dynamic_qr_quota: { Args: never; Returns: number };
      record_scan: {
        Args: {
          code: string;
          p_country?: string;
          p_device_type?: string;
          p_ip_hash?: string;
          p_referrer_host?: string;
          p_region?: string;
        };
        Returns: undefined;
      };
      resolve_shortcode: {
        Args: { code: string };
        Returns: {
          state: string;
          target: string;
        }[];
      };
      restore_suspended_qr_codes: {
        Args: { p_owner_id: string };
        Returns: number;
      };
      run_downgrade_sweep: { Args: never; Returns: Json };
      set_qr_status: {
        Args: { new_status: string; qr_id: string };
        Returns: undefined;
      };
      set_qr_target: {
        Args: { new_target: string; qr_id: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
