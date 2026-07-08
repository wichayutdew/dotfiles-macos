import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const gatewayUrl = process.env.AI_GATEWAY_URL?.trim();

const sharedModelConfig = {
  reasoning: false,
  input: ["text"],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 200000,
} as const;

const anthropicModelConfig = {
  ...sharedModelConfig,
  maxTokens: 128000,
} as const;

const openAiModelConfig = {
  ...sharedModelConfig,
  maxTokens: 128000,
} as const;

export default function registerGatewayModels(pi: ExtensionAPI) {
  if (!gatewayUrl) {
    return;
  }

  pi.registerProvider("anthropic-gateway", {
    baseUrl: gatewayUrl,
    api: "openai-completions",
    apiKey: "$GENAI_API_KEY",
    models: [
      {
        id: "claude-sonnet-5",
        name: "claude-sonnet-5",
        ...anthropicModelConfig,
      },
      {
        id: "claude-opus-4-8",
        name: "claude-opus-4-8",
        ...anthropicModelConfig,
      },
    ],
  });

  pi.registerProvider("openai-gateway", {
    baseUrl: gatewayUrl,
    api: "openai-completions",
    apiKey: "$GENAI_API_KEY",
    models: [
      {
        id: "gpt-5.4",
        name: "gpt-5.4",
        ...openAiModelConfig,
      },
      {
        id: "gpt-5.3-codex",
        name: "gpt-5.3-codex",
        ...openAiModelConfig,
      },
    ],
  });
}
