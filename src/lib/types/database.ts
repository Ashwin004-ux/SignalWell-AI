// Hand-written types matching supabase/schema.sql.
// Once the project is running against a real Supabase instance, regenerate
// this file with:
//   npx supabase gen types typescript --project-id <project-ref> > src/lib/types/database.ts
// and re-check it still matches the shapes the app expects below.

export type RiskLevel = "stable" | "monitor" | "elevated";
export type UsageCategory =
  | "social_media"
  | "entertainment"
  | "productivity"
  | "communication"
  | "education"
  | "gaming"
  | "other";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  date: string;
  total_screen_time_minutes: number;
  active_device_minutes: number;
  social_media_minutes: number;
  entertainment_minutes: number;
  productivity_minutes: number;
  communication_minutes: number;
  education_minutes: number;
  gaming_minutes: number;
  late_night_usage_minutes: number;
  notifications_count: number;
  app_switches: number;
  tracking_coverage_minutes: number;
  /** Social-media minutes entered manually from the user's phone Digital Wellbeing/Screen Time report. */
  mobile_social_media_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationUsage {
  id: string;
  user_id: string;
  date: string;
  application_name: string;
  category: UsageCategory;
  usage_minutes: number;
  launch_count: number;
  created_at: string;
}

export interface SleepRecord {
  id: string;
  user_id: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  sleep_duration_minutes: number | null;
  sleep_quality: number | null;
  interruptions: number;
  created_at: string;
}

export interface MoodRecord {
  id: string;
  user_id: string;
  date: string;
  mood_score: number;
  stress_score: number;
  anxiety_score: number;
  wellbeing_score: number;
  energy_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface AiAnalysis {
  id: string;
  user_id: string;
  date: string;
  period: "daily" | "weekly";
  overall_wellbeing_score: number | null;
  stress_indicator: RiskLevel | null;
  anxiety_indicator: RiskLevel | null;
  mood_indicator: RiskLevel | null;
  sleep_indicator: RiskLevel | null;
  digital_habit_indicator: RiskLevel | null;
  risk_level: RiskLevel;
  confidence: number | null;
  summary: string | null;
  contributing_factors: string[];
  recommendations: string[];
  model_name: string | null;
  created_at: string;
}

export interface ChatbotConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatbotMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  message: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "high_screen_time" | "late_night_usage" | "sleep_pattern" | "positive_change" | "system";
  title: string;
  message: string;
  severity: "info" | "notice" | "elevated";
  read: boolean;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  data_collection_enabled: boolean;
  chatbot_enabled: boolean;
  analytics_enabled: boolean;
  chatbot_can_access_activity_data: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ExtensionDevice {
  id: string;
  user_id: string;
  device_label: string;
  browser: string | null;
  last_synced_at: string | null;
  tracking_paused: boolean;
  created_at: string;
}

// Minimal Database shape for @supabase/ssr generics. Expand per-table
// Row/Insert/Update variants here as routes need stricter typing.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      daily_activity: { Row: DailyActivity; Insert: Partial<DailyActivity>; Update: Partial<DailyActivity> };
      application_usage: { Row: ApplicationUsage; Insert: Partial<ApplicationUsage>; Update: Partial<ApplicationUsage> };
      sleep_records: { Row: SleepRecord; Insert: Partial<SleepRecord>; Update: Partial<SleepRecord> };
      mood_records: { Row: MoodRecord; Insert: Partial<MoodRecord>; Update: Partial<MoodRecord> };
      ai_analysis: { Row: AiAnalysis; Insert: Partial<AiAnalysis>; Update: Partial<AiAnalysis> };
      chatbot_conversations: { Row: ChatbotConversation; Insert: Partial<ChatbotConversation>; Update: Partial<ChatbotConversation> };
      chatbot_messages: { Row: ChatbotMessage; Insert: Partial<ChatbotMessage>; Update: Partial<ChatbotMessage> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      user_settings: { Row: UserSettings; Insert: Partial<UserSettings>; Update: Partial<UserSettings> };
      extension_devices: { Row: ExtensionDevice; Insert: Partial<ExtensionDevice>; Update: Partial<ExtensionDevice> };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}
