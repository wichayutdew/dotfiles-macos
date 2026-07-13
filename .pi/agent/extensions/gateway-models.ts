import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const gatewayUrl = process.env.AI_GATEWAY_URL?.trim();

const sharedModelConfig = {
  input: ["text"],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: 1000000,
  maxTokens: 128000,
} as const;

const reasoningModelConfig = {
  ...sharedModelConfig,
  reasoning: true,
} as const;

export default function registerGatewayModels(pi: ExtensionAPI) {
  if (!gatewayUrl) {
    console.warn("Gateway models disabled: AI_GATEWAY_URL is not set.");
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
        ...reasoningModelConfig,
      },
      {
        id: "claude-opus-4-8",
        name: "claude-opus-4-8",
        ...reasoningModelConfig,
      },
    ],
  });

  pi.registerProvider("openai-gateway", {
    baseUrl: gatewayUrl,
    api: "openai-completions",
    apiKey: "$GENAI_API_KEY",
    models: [
      {
        id: "gpt-5.6-luna",
        name: "gpt-5.6-luna",
        api: "openai-responses",
        ...reasoningModelConfig,
      },
      {
        id: "gpt-5.6-terra",
        name: "gpt-5.6-terra",
        api: "openai-responses",
        ...reasoningModelConfig,
      },
      {
        id: "gpt-5.6-sol",
        name: "gpt-5.6-sol",
        api: "openai-responses",
        ...reasoningModelConfig,
      },
    ],
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (
      ctx.model?.provider !== "openai-gateway" ||
      ctx.model.api !== "openai-responses" ||
      typeof event.payload !== "object" ||
      event.payload === null ||
      Array.isArray(event.payload)
    ) {
      return;
    }

    return { ...event.payload, store: true };
  });
}
