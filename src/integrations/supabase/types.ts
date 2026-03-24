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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          comeback_signal: boolean
          confidence: number
          created_at: string
          dominance_score: number
          hot_game: boolean
          id: string
          ideal_moment: boolean
          insight: string
          match_live_id: string
          model_mode: string
          momentum_score: number
          pressure_score: number
          risk_high: boolean
          suggestion: string
          trend: string
          updated_at: string
          value_bet: boolean
        }
        Insert: {
          comeback_signal?: boolean
          confidence?: number
          created_at?: string
          dominance_score?: number
          hot_game?: boolean
          id?: string
          ideal_moment?: boolean
          insight: string
          match_live_id: string
          model_mode?: string
          momentum_score?: number
          pressure_score?: number
          risk_high?: boolean
          suggestion: string
          trend?: string
          updated_at?: string
          value_bet?: boolean
        }
        Update: {
          comeback_signal?: boolean
          confidence?: number
          created_at?: string
          dominance_score?: number
          hot_game?: boolean
          id?: string
          ideal_moment?: boolean
          insight?: string
          match_live_id?: string
          model_mode?: string
          momentum_score?: number
          pressure_score?: number
          risk_high?: boolean
          suggestion?: string
          trend?: string
          updated_at?: string
          value_bet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_match_live_id_fkey"
            columns: ["match_live_id"]
            isOneToOne: false
            referencedRelation: "matches_live"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          match_live_id: string
          message: string
          score: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_live_id: string
          message: string
          score: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          match_live_id?: string
          message?: string
          score?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_match_live_id_fkey"
            columns: ["match_live_id"]
            isOneToOne: false
            referencedRelation: "matches_live"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute: number | null
          team_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute?: number | null
          team_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute?: number | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          match_live_id: string
          minute: number | null
          payload: Json | null
          pressure_delta: number
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          match_live_id: string
          minute?: number | null
          payload?: Json | null
          pressure_delta?: number
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          match_live_id?: string
          minute?: number | null
          payload?: Json | null
          pressure_delta?: number
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_events_match_live_id_fkey"
            columns: ["match_live_id"]
            isOneToOne: false
            referencedRelation: "matches_live"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          card_prob: number
          confidence: number
          corner_prob: number
          goal_prob: number
          id: string
          match_live_id: string
          updated_at: string
          win_away_prob: number
          win_draw_prob: number
          win_home_prob: number
        }
        Insert: {
          card_prob: number
          confidence: number
          corner_prob: number
          goal_prob: number
          id?: string
          match_live_id: string
          updated_at?: string
          win_away_prob: number
          win_draw_prob: number
          win_home_prob: number
        }
        Update: {
          card_prob?: number
          confidence?: number
          corner_prob?: number
          goal_prob?: number
          id?: string
          match_live_id?: string
          updated_at?: string
          win_away_prob?: number
          win_draw_prob?: number
          win_home_prob?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_live_id_fkey"
            columns: ["match_live_id"]
            isOneToOne: true
            referencedRelation: "matches_live"
            referencedColumns: ["id"]
          },
        ]
      }
      match_stats: {
        Row: {
          cards_away: number
          cards_home: number
          corners_away: number
          corners_home: number
          fouls_away: number
          fouls_home: number
          goals_away: number
          goals_home: number
          id: string
          match_id: string
          updated_at: string
        }
        Insert: {
          cards_away?: number
          cards_home?: number
          corners_away?: number
          corners_home?: number
          fouls_away?: number
          fouls_home?: number
          goals_away?: number
          goals_home?: number
          id?: string
          match_id: string
          updated_at?: string
        }
        Update: {
          cards_away?: number
          cards_home?: number
          corners_away?: number
          corners_home?: number
          fouls_away?: number
          fouls_home?: number
          goals_away?: number
          goals_home?: number
          id?: string
          match_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches_history"
            referencedColumns: ["id"]
          },
        ]
      }
      matches_history: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          external_match_id: string | null
          home_score: number | null
          home_team_id: string
          id: string
          league: string
          match_date: string
          season: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          league: string
          match_date: string
          season?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          league?: string
          match_date?: string
          season?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_history_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_history_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches_live: {
        Row: {
          away_score: number
          away_team_id: string
          created_at: string
          external_match_id: string | null
          home_score: number
          home_team_id: string
          id: string
          is_hot: boolean
          kickoff_at: string | null
          league: string
          minute: number
          odds_away: number | null
          odds_draw: number | null
          odds_home: number | null
          status: string
          status_detail: string | null
          updated_at: string
        }
        Insert: {
          away_score?: number
          away_team_id: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number
          home_team_id: string
          id?: string
          is_hot?: boolean
          kickoff_at?: string | null
          league: string
          minute?: number
          odds_away?: number | null
          odds_draw?: number | null
          odds_home?: number | null
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Update: {
          away_score?: number
          away_team_id?: string
          created_at?: string
          external_match_id?: string | null
          home_score?: number
          home_team_id?: string
          id?: string
          is_hot?: boolean
          kickoff_at?: string | null
          league?: string
          minute?: number
          odds_away?: number | null
          odds_draw?: number | null
          odds_home?: number | null
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_live_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_live_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      team_logos: {
        Row: {
          fetched_at: string
          id: string
          logo_url: string
          provider: string
          team_id: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          logo_url: string
          provider: string
          team_id: string
        }
        Update: {
          fetched_at?: string
          id?: string
          logo_url?: string
          provider?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_logos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_stats: {
        Row: {
          avg_cards: number
          avg_corners: number
          avg_goals: number
          id: string
          team_id: string
          updated_at: string
          win_rate: number
        }
        Insert: {
          avg_cards?: number
          avg_corners?: number
          avg_goals?: number
          id?: string
          team_id: string
          updated_at?: string
          win_rate?: number
        }
        Update: {
          avg_cards?: number
          avg_corners?: number
          avg_goals?: number
          id?: string
          team_id?: string
          updated_at?: string
          win_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_alert_preferences: {
        Row: {
          card_enabled: boolean
          comeback_enabled: boolean
          corners_enabled: boolean
          created_at: string
          final_minutes_enabled: boolean
          goal_imminent_enabled: boolean
          id: string
          min_score: number
          updated_at: string
          user_id: string
          value_odds_enabled: boolean
        }
        Insert: {
          card_enabled?: boolean
          comeback_enabled?: boolean
          corners_enabled?: boolean
          created_at?: string
          final_minutes_enabled?: boolean
          goal_imminent_enabled?: boolean
          id?: string
          min_score?: number
          updated_at?: string
          user_id: string
          value_odds_enabled?: boolean
        }
        Update: {
          card_enabled?: boolean
          comeback_enabled?: boolean
          corners_enabled?: boolean
          created_at?: string
          final_minutes_enabled?: boolean
          goal_imminent_enabled?: boolean
          id?: string
          min_score?: number
          updated_at?: string
          user_id?: string
          value_odds_enabled?: boolean
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
