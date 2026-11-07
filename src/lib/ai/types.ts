export interface WellbeingDataWindow {
  date: string; // the day this analysis is for
  recentDays: {
    date: string;
    total_screen_time_minutes: number | null;
    social_media_minutes: number | null;
    mobile_social_media_minutes: number | null;
    late_night_usage_minutes: number | null;
    sleep_duration_minutes: number | null;
    mood_score: number | null;
    stress_score: number | null;
    anxiety_score: number | null;
    wellbeing_score: number | null;
  }[];
  priorWeekAverages: {
    total_screen_time_minutes: number | null;
    social_media_minutes: number | null;
    mobile_social_media_minutes: number | null;
    sleep_duration_minutes: number | null;
    mood_score: number | null;
  } | null;
}

export type RiskLevel = "stable" | "monitor" | "elevated";

export interface WellbeingAnalysisResult {
  overall_wellbeing_score: number | null;
  stress_indicator: RiskLevel;
  anxiety_indicator: RiskLevel;
  mood_indicator: RiskLevel;
  sleep_indicator: RiskLevel;
  digital_habit_indicator: RiskLevel;
  risk_level: RiskLevel;
  confidence: number;
  summary: string;
  contributing_factors: string[];
  recommendations: string[];
}

export interface ChatContext {
  conversationHistory: { role: "user" | "assistant"; message: string }[];
  userMessage: string;
  /** Only populated when the user's settings allow the assistant to see it. */
  wellbeingData?: WellbeingDataWindow | null;
}

export interface ChatResult {
  message: string;
  /** True when the safety layer detected crisis language and this response includes resources. */
  safetyTriggered: boolean;
}

/**
 * The interface every AI provider module implements. Swapping providers
 * means writing a new module that satisfies this interface and pointing
 * AI_PROVIDER at it — nothing else in the app changes.
 */
export interface AiProvider {
  readonly modelName: string;
  generateAnalysis(data: WellbeingDataWindow): Promise<WellbeingAnalysisResult>;
  generateChatResponse(context: ChatContext): Promise<ChatResult>;
}
