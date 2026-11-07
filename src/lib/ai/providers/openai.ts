import type { AiProvider, ChatContext, ChatResult, WellbeingAnalysisResult, WellbeingDataWindow } from "@/lib/ai/types";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/ai/prompt";
import { CRISIS_RESPONSE, detectCrisisLanguage } from "@/lib/ai/safety";

function getApiUrl(): string {
  const key = process.env.AI_API_KEY || "";
  if (key.startsWith("sk-or-v1-")) {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  return "https://api.openai.com/v1/chat/completions";
}

function requireApiKey(): string {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY is not configured.");
  return key;
}

async function callOpenAI(system: string, userMessage: string, maxTokens: number, apiKey: string, model: string, isJson: boolean = false) {
  const apiUrl = getApiUrl();
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      response_format: isJson ? { type: "json_object" } : { type: "text" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseAnalysisJson(text: string): WellbeingAnalysisResult {
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  const allowedLevels = new Set(["stable", "monitor", "elevated"]);
  const level = (v: unknown) => (allowedLevels.has(v as string) ? (v as WellbeingAnalysisResult["risk_level"]) : "monitor");

  return {
    overall_wellbeing_score:
      typeof parsed.overall_wellbeing_score === "number" ? parsed.overall_wellbeing_score : null,
    stress_indicator: level(parsed.stress_indicator),
    anxiety_indicator: level(parsed.anxiety_indicator),
    mood_indicator: level(parsed.mood_indicator),
    sleep_indicator: level(parsed.sleep_indicator),
    digital_habit_indicator: level(parsed.digital_habit_indicator),
    risk_level: level(parsed.risk_level),
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    contributing_factors: Array.isArray(parsed.contributing_factors) ? parsed.contributing_factors : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
  };
}

const CHAT_SYSTEM_PROMPT = `You are SignalWell Assistant, a conversational wellbeing assistant inside the SignalWell AI app. \
You help users understand their own digital habits, sleep, and mood data, and offer practical, non-clinical suggestions.

Strict rules:
- You are not a therapist. Do not role-play as one, and do not use clinical language or diagnose any condition.
- Never claim certainty about causation in the user's data; use hedged language.
- If wellbeing data is provided below, ground your answer in it specifically — reference actual numbers/trends rather than speaking generically.
- If no wellbeing data is provided, you may still discuss general, practical suggestions, but say plainly that you don't have the user's recent data to reference.
- Keep responses conversational and concise, not a bulleted essay, unless the user asks for a list.
- When appropriate, gently suggest that talking with a trusted person or a qualified professional could help — but do not do this in every message; only when it fits naturally.`;

class OpenAIProvider implements AiProvider {
  readonly modelName: string;

  constructor(model: string) {
    this.modelName = model;
  }

  async generateAnalysis(data: WellbeingDataWindow): Promise<WellbeingAnalysisResult> {
    const apiKey = requireApiKey();
    const prompt = buildAnalysisPrompt(data);
    const systemPromptWithJsonInstruction = ANALYSIS_SYSTEM_PROMPT + "\n\nPlease output your response as valid JSON.";
    const text = await callOpenAI(systemPromptWithJsonInstruction, prompt, 1000, apiKey, this.modelName, true);

    try {
      return parseAnalysisJson(text);
    } catch {
      throw new Error("The analysis model returned an unexpected response format.");
    }
  }

  async generateChatResponse(context: ChatContext): Promise<ChatResult> {
    if (detectCrisisLanguage(context.userMessage)) {
      return { message: CRISIS_RESPONSE, safetyTriggered: true };
    }

    const apiKey = requireApiKey();

    const historyText = context.conversationHistory
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.message}`)
      .join("\n");

    const dataText = context.wellbeingData
      ? `\n\nThe user's recent wellbeing data:\n${buildAnalysisPrompt(context.wellbeingData)}`
      : "\n\n(No wellbeing data available for this response — the user has not enabled data access, or none exists yet.)";

    const userMessage = `Conversation so far:\n${historyText}\n\nLatest user message: ${context.userMessage}${dataText}`;

    const text = await callOpenAI(CHAT_SYSTEM_PROMPT, userMessage, 800, apiKey, this.modelName, false);
    return { message: text.trim(), safetyTriggered: false };
  }
}

export function createOpenAIProvider(): AiProvider {
  return new OpenAIProvider(process.env.AI_MODEL || "gpt-4o-mini");
}
