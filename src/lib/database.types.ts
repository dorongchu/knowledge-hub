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
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          node_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          node_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          node_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      edges: {
        Row: {
          created_at: string
          id: string
          label: string | null
          source: Database["public"]["Enums"]["provenance"]
          source_node_id: string
          status: Database["public"]["Enums"]["edge_status"]
          target_node_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          source?: Database["public"]["Enums"]["provenance"]
          source_node_id: string
          status?: Database["public"]["Enums"]["edge_status"]
          target_node_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          source?: Database["public"]["Enums"]["provenance"]
          source_node_id?: string
          status?: Database["public"]["Enums"]["edge_status"]
          target_node_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edges_source_node_id_workspace_id_fkey"
            columns: ["source_node_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "edges_target_node_id_workspace_id_fkey"
            columns: ["target_node_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "edges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      node_tags: {
        Row: {
          created_at: string
          node_id: string
          source: Database["public"]["Enums"]["provenance"]
          tag_id: string
        }
        Insert: {
          created_at?: string
          node_id: string
          source?: Database["public"]["Enums"]["provenance"]
          tag_id: string
        }
        Update: {
          created_at?: string
          node_id?: string
          source?: Database["public"]["Enums"]["provenance"]
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_tags_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          position_x: number | null
          position_y: number | null
          title: string
          type: Database["public"]["Enums"]["node_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title?: string
          type?: Database["public"]["Enums"]["node_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          title?: string
          type?: Database["public"]["Enums"]["node_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_category_id_workspace_id_fkey"
            columns: ["category_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_attachment_path_owner: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      is_node_owner: { Args: { p_node_id: string }; Returns: boolean }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
    }
    Enums: {
      edge_status: "suggested" | "confirmed" | "rejected"
      member_role: "owner"
      node_type: "card" | "doc"
      provenance: "ai" | "manual"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      edge_status: ["suggested", "confirmed", "rejected"],
      member_role: ["owner"],
      node_type: ["card", "doc"],
      provenance: ["ai", "manual"],
    },
  },
} as const
