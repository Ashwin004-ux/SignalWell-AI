import type { AiProvider } from "@/lib/ai/types";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createOllamaProvider } from "@/lib/ai/providers/ollama";

/**
 * Every call site imports `getAiProvider`, never a specific provider module
 * directly. Adding a second provider means writing a new module under
 * providers/ that implements AiProvider and adding a branch here — nothing
 * in the routes that call this needs to change.
 */
export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  switch (provider) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      return createOpenAIProvider();
    case "ollama":
      return createOllamaProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER "${provider}".`);
  }
}

export type {
  AiProvider,
  WellbeingDataWindow,
  WellbeingAnalysisResult,
  ChatContext,
  ChatResult,
  RiskLevel
} from "@/lib/ai/types";
