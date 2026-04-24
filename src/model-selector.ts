/**
 * Model selection logic based on task tier
 *
 * Maps task tiers to appropriate models and thinking levels.
 * Can either use legacy built-in defaults or dynamically select from
 * authenticated models available in Pi's ModelRegistry.
 */

import type {
  TaskTier,
  ModelSelection,
  BudgetThresholds,
  ExpectedDuration,
  ModelStrategy,
  ThinkingLevel,
} from "./types";

interface AvailableModelLike {
  provider: string;
  id: string;
  reasoning?: boolean;
}

interface ModelRegistryLike {
  getAvailable(): AvailableModelLike[];
}

interface SelectModelOptions {
  strategy?: ModelStrategy;
  modelRegistry?: ModelRegistryLike;
}

const DEFAULT_AUTO_PROVIDER_ORDER = ["anthropic", "openai-codex"] as const;
const SUPPORTED_STRATEGIES: ModelStrategy[] = ["auto", "anthropic", "openai-codex"];

const MODEL_PREFERENCES: Record<Exclude<ModelStrategy, "auto">, Record<TaskTier, string[]>> = {
  anthropic: {
    "trivial-simple": [
      "claude-3-haiku-20240307",
      "claude-3-5-haiku-latest",
      "claude-3-5-haiku-20241022",
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251001",
    ],
    "trivial-code": [
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251001",
      "claude-3-5-haiku-latest",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
    ],
    light: [
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-sonnet-4-0",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-sonnet-20240229",
    ],
    standard: [
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-sonnet-4-0",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-sonnet-20240229",
    ],
    complex: [
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-6",
      "claude-sonnet-4-20250514",
      "claude-sonnet-4-0",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-sonnet-20240229",
    ],
    deep: [
      "claude-opus-4-5",
      "claude-opus-4-5-20251101",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-1",
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-opus-4-0",
      "claude-3-opus-20240229",
    ],
  },
  "openai-codex": {
    "trivial-simple": [
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.2",
      "gpt-5.3-codex",
    ],
    "trivial-code": [
      "gpt-5.3-codex",
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.2",
    ],
    light: [
      "gpt-5.3-codex",
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.2",
    ],
    standard: [
      "gpt-5.3-codex",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.2",
    ],
    complex: [
      "gpt-5.3-codex",
      "gpt-5.4",
      "gpt-5.2",
      "gpt-5.4-mini",
    ],
    deep: [
      "gpt-5.4",
      "gpt-5.3-codex",
      "gpt-5.2",
    ],
  },
};

function getThinkingLevel(tier: TaskTier): ThinkingLevel {
  switch (tier) {
    case "trivial-simple":
    case "trivial-code":
      return "off";
    case "light":
      return "minimal";
    case "standard":
      return "low";
    case "complex":
      return "high";
    case "deep":
      return "medium";
    default:
      throw new Error(`Invalid task tier: ${tier}`);
  }
}

function getPreferredProviders(strategy: ModelStrategy): readonly Exclude<ModelStrategy, "auto">[] {
  if (strategy === "auto") {
    return DEFAULT_AUTO_PROVIDER_ORDER;
  }
  return [strategy];
}

function getFallbackModelId(provider: Exclude<ModelStrategy, "auto">, tier: TaskTier): string {
  return MODEL_PREFERENCES[provider][tier][0];
}

function chooseFallbackAvailableModel(
  provider: Exclude<ModelStrategy, "auto">,
  tier: TaskTier,
  candidates: AvailableModelLike[]
): AvailableModelLike | undefined {
  if (candidates.length === 0) return undefined;

  if (tier === "trivial-simple" || tier === "trivial-code") {
    return (
      candidates.find((candidate) => /mini|spark|haiku/i.test(candidate.id)) ??
      candidates[0]
    );
  }

  if (tier === "deep") {
    return candidates.find((candidate) => candidate.reasoning) ?? candidates[0];
  }

  if (provider === "openai-codex") {
    return (
      candidates.find((candidate) => /codex/i.test(candidate.id)) ??
      candidates.find((candidate) => candidate.reasoning) ??
      candidates[0]
    );
  }

  return candidates.find((candidate) => candidate.reasoning) ?? candidates[0];
}

function selectAvailableModel(
  provider: Exclude<ModelStrategy, "auto">,
  tier: TaskTier,
  availableModels: AvailableModelLike[]
): AvailableModelLike | undefined {
  const providerModels = availableModels.filter((model) => model.provider === provider);
  if (providerModels.length === 0) return undefined;

  for (const modelId of MODEL_PREFERENCES[provider][tier]) {
    const exactMatch = providerModels.find((model) => model.id === modelId);
    if (exactMatch) return exactMatch;
  }

  return chooseFallbackAvailableModel(provider, tier, providerModels);
}

export function getDefaultModelStrategy(): ModelStrategy {
  const raw = process.env.SIRDAR_MODEL_STRATEGY ?? process.env.ORCHESTRATOR_MODEL_STRATEGY;
  if (raw && SUPPORTED_STRATEGIES.includes(raw as ModelStrategy)) {
    return raw as ModelStrategy;
  }
  return "auto";
}

/**
 * Select the appropriate model and thinking level for a given task tier.
 *
 * Without a model registry, this returns deterministic provider defaults.
 * With a registry, it selects from the user's authenticated models.
 */
export function selectModel(tier: TaskTier, options?: SelectModelOptions): ModelSelection {
  const strategy = options?.strategy ?? getDefaultModelStrategy();
  const thinkingLevel = getThinkingLevel(tier);

  if (options?.modelRegistry && typeof options.modelRegistry.getAvailable === "function") {
    const availableModels = options.modelRegistry.getAvailable();

    for (const provider of getPreferredProviders(strategy)) {
      const match = selectAvailableModel(provider, tier, availableModels);
      if (match) {
        return {
          provider: match.provider,
          modelId: match.id,
          thinkingLevel,
        };
      }
    }

    throw new Error(`No authenticated models available for strategy: ${strategy}`);
  }

  const fallbackProvider = strategy === "auto" ? "anthropic" : strategy;
  return {
    provider: fallbackProvider,
    modelId: getFallbackModelId(fallbackProvider, tier),
    thinkingLevel,
  };
}

/**
 * Get expected duration and recommended poll timing for a task tier.
 */
export function getExpectedDuration(tier: TaskTier): ExpectedDuration {
  switch (tier) {
    case "trivial-simple":
      return { expectedSeconds: 15, pollAfterSeconds: 15, label: "~15s" };
    case "trivial-code":
      return { expectedSeconds: 30, pollAfterSeconds: 30, label: "~30s" };
    case "light":
      return { expectedSeconds: 90, pollAfterSeconds: 60, label: "~1.5 min" };
    case "standard":
      return { expectedSeconds: 180, pollAfterSeconds: 90, label: "~3 min" };
    case "complex":
      return { expectedSeconds: 420, pollAfterSeconds: 180, label: "~7 min" };
    case "deep":
      return { expectedSeconds: 900, pollAfterSeconds: 300, label: "~15 min" };
    default:
      throw new Error(`Invalid task tier: ${tier}`);
  }
}

/**
 * Get budget thresholds for a given task tier.
 */
export function getBudgetThresholds(tier: TaskTier): BudgetThresholds {
  switch (tier) {
    case "trivial-simple":
      return {
        softWarning: 0.05,
        hardFlag: 0.15,
      };

    case "trivial-code":
      return {
        softWarning: 0.10,
        hardFlag: 0.25,
      };

    case "light":
      return {
        softWarning: 0.50,
        hardFlag: 1.00,
      };

    case "standard":
      return {
        softWarning: 2.00,
        hardFlag: 5.00,
      };

    case "complex":
      return {
        softWarning: 10.00,
        hardFlag: 20.00,
      };

    case "deep":
      return {
        softWarning: 25.00,
        hardFlag: 50.00,
      };

    default:
      throw new Error(`Invalid task tier: ${tier}`);
  }
}
