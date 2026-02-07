/**
 * Model selection logic based on task tier
 * 
 * Maps task tiers to appropriate models and thinking levels per the Model Guide.
 * Pure functions with no side effects or SDK dependencies.
 */

import type { TaskTier, ModelSelection, BudgetThresholds } from "./types";

/**
 * Select the appropriate model and thinking level for a given task tier.
 * 
 * Mapping per Model Guide:
 * - trivial  → claude-haiku-3-5, thinking off
 * - light    → claude-sonnet-4-5, thinking off
 * - standard → claude-sonnet-4-5, thinking low
 * - complex  → claude-sonnet-4-5, thinking high
 * - deep     → claude-opus-4-5, thinking medium
 * 
 * @param tier - The task tier
 * @returns ModelSelection with provider, modelId, and thinkingLevel
 * @throws Error if tier is invalid
 */
export function selectModel(tier: TaskTier): ModelSelection {
  switch (tier) {
    case "trivial-simple":
      return {
        provider: "anthropic",
        modelId: "claude-3-haiku-20240307",
        thinkingLevel: "off",
      };
    
    case "trivial-code":
      return {
        provider: "anthropic",
        modelId: "claude-3-5-haiku-latest",
        thinkingLevel: "off",
      };
    
    case "light":
      return {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "minimal",
      };
    
    case "standard":
      return {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "low",
      };
    
    case "complex":
      return {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "high",
      };
    
    case "deep":
      return {
        provider: "anthropic",
        modelId: "claude-opus-4-5",
        thinkingLevel: "medium",
      };
    
    default:
      throw new Error(`Invalid task tier: ${tier}`);
  }
}

/**
 * Get budget thresholds for a given task tier.
 * 
 * Thresholds per Model Guide:
 * - trivial:  soft $0.10, hard $0.25
 * - light:    soft $0.50, hard $1.00
 * - standard: soft $2.00, hard $5.00
 * - complex:  soft $10.00, hard $20.00
 * - deep:     soft $25.00, hard $50.00
 * 
 * @param tier - The task tier
 * @returns BudgetThresholds with softWarning and hardFlag in dollars
 * @throws Error if tier is invalid
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
