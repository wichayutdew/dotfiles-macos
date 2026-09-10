import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const gatewayUrl = process.env.AI_GATEWAY_URL?.trim();

const sharedModelConfig = {
  input: ["text"],
  contextWindow: 1000000,
  maxTokens: 128000,
} as const;

const reasoningModelConfig = {
  ...sharedModelConfig,
  reasoning: true,
} as const;

const geminiFlashModelConfig = {
  input: ["text"],
  contextWindow: 1048576,
  maxTokens: 65536,
  reasoning: true,
  // Google supports low/medium/high thinking for gemini-3.7-flash; minimal is
  // rejected by the API and xhigh/max are not offered.
  thinkingLevelMap: {
    off: null,
    minimal: null,
    xhigh: null,
    max: null,
  },
  cost: {
    input: 0.375,
    output: 1.875,
    cacheRead: 0.0375,
    cacheWrite: 0.0208333333333,
  },
} as const;

const qwenModelConfig = {
  input: ["text"],
  // Verified against the gateway's own ContextWindowExceededError message
  // (2026-08-22): "This model's maximum context length is 262144 tokens."
  contextWindow: 262144,
  maxTokens: 128000,
  reasoning: true,
  // Live gateway validation: accepts low, medium, and xhigh; rejects minimal
  // and high. Pi otherwise maps xhigh/max to high, so map xhigh explicitly.
  thinkingLevelMap: {
    minimal: null,
    high: null,
    xhigh: "xhigh",
    max: null,
  },
  // Self-hosted on Agoda infra (vLLM); confirmed $0 cost via
  // x-litellm-response-cost-original: 0.0 on live calls.
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
} as const;

const grokModelConfig = {
  input: ["text"],
  contextWindow: 500000,
  maxTokens: 128000,
  reasoning: true,
  // xAI documents low/medium/high/xhigh reasoning effort; it cannot be off.
  thinkingLevelMap: {
    off: null,
    minimal: null,
    xhigh: "xhigh",
    max: null,
  },
  cost: {
    input: 2,
    output: 6,
    cacheRead: 0.5,
    cacheWrite: 0,
  },
  tiers: [
    {
      inputTokensAbove: 200000,
      input: 4,
      output: 12,
      cacheRead: 1,
      cacheWrite: 0,
    },
  ],
} as const;

const sonnetModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
} as const;

const opusModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
} as const;

const lunaModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 1, output: 6, cacheRead: 0.1, cacheWrite: 1.25 },
  tiers: [
    {
      inputTokensAbove: 272000,
      input: 2,
      output: 9,
      cacheRead: 0.2,
      cacheWrite: 2.5,
    },
  ],
} as const;

const terraModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125 },
  tiers: [
    {
      inputTokensAbove: 272000,
      input: 5,
      output: 22.5,
      cacheRead: 0.5,
      cacheWrite: 6.25,
    },
  ],
} as const;

const solModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 6.25 },
  tiers: [
    {
      inputTokensAbove: 272000,
      input: 10,
      output: 45,
      cacheRead: 1,
      cacheWrite: 12.5,
    },
  ],
} as const;

const astraModelConfig = {
  ...reasoningModelConfig,
  cost: { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  tiers: [
    {
      inputTokensAbove: 272000,
      input: 20,
      output: 75,
      cacheRead: 2,
      cacheWrite: 25,
    },
  ],
} as const;

const kimiModelConfig = {
  input: ["text"],
  // Verified against Moonshot's Kimi K2.7 Code page (2026-08-22): 256K
  // (262,144 token) context length, not the 1M previously assumed.
  contextWindow: 262144,
  maxTokens: 128000,
  reasoning: true,
  // K2.7 Code does not support non-thinking mode; disabling thinking on the
  // Kimi API/Kimi Code silently routes the request to K2.6 instead.
  thinkingLevelMap: {
    off: null,
  },
  // Public Kimi API pricing (per 1M tokens): input $0.95 (cache hit $0.19),
  // output $4.00. Gateway-negotiated rate is unverified; using public rates
  // as the closest known baseline rather than leaving cost at zero.
  cost: { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
} as const;

export default function registerGatewayModels(pi: ExtensionAPI) {
  if (!gatewayUrl) {
    console.warn("Gateway models disabled: AI_GATEWAY_URL is not set.");
    return;
  }

  pi.registerProvider("gateway", {
    baseUrl: gatewayUrl,
    api: "openai-completions",
    apiKey: "$GENAI_API_KEY",
    models: [
      {
        id: "claude-sonnet-5",
        name: "claude-sonnet-5",
        ...sonnetModelConfig,
      },
      // {
      //   id: "claude-opus-5",
      //   name: "claude-opus-5",
      //   ...opusModelConfig,
      // },
      {
        id: "gpt-5.6-luna",
        name: "gpt-5.6-luna",
        api: "openai-responses",
        ...lunaModelConfig,
      },
      {
        id: "gpt-5.6-terra",
        name: "gpt-5.6-terra",
        api: "openai-responses",
        ...terraModelConfig,
      },
      // {
      //   id: "gpt-5.6-sol",
      //   name: "gpt-5.6-sol",
      //   api: "openai-responses",
      //   ...solModelConfig,
      // },
      // {
      //   id: "gpt-6-astra",
      //   name: "gpt-6-astra",
      //   api: "openai-responses",
      //   ...astraModelConfig,
      // },
      {
        id: "gemini-3.8-flash",
        name: "gemini-3.8-flash",
        ...geminiFlashModelConfig,
      },
      {
        id: "grok-4.6",
        name: "grok-4.6",
        ...grokModelConfig,
      },
      {
        id: "kimi-k2.7-code",
        name: "kimi-k2.7-code",
        ...kimiModelConfig,
      },
      {
        id: "qwen-3.8-27b",
        name: "qwen-3.8-27b",
        ...qwenModelConfig,
      },
    ],
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (
      // Registered above as a single "gateway" provider id (not split by
      // upstream vendor), so match on that instead of the old
      // openai-gateway/google-gateway/xai-gateway ids which never matched.
      ctx.model?.provider !== "gateway" ||
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
