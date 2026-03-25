import type { AgentProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";

const providers: Record<string, () => AgentProvider> = {
  GEMINI: () => new GeminiProvider(),
  CLAUDE: () => new ClaudeProvider(),
  OPENAI: () => new OpenAIProvider(),
};

export function getProvider(providerName: string): AgentProvider {
  const factory = providers[providerName];
  if (!factory) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(providers).join(", ")}`);
  }
  return factory();
}
