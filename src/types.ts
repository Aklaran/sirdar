/**
 * Type definitions for the Orchestrator extension
 */

// Task tiers matching the Model Guide
export type TaskTier = "trivial-simple" | "trivial-code" | "light" | "standard" | "complex" | "deep";

// Thinking levels from Pi SDK
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ModelSelection {
  provider: string;      // e.g., "anthropic"
  modelId: string;       // e.g., "claude-sonnet-4-5"
  thinkingLevel: ThinkingLevel;
}

export interface TaskDefinition {
  id: string;                    // unique task ID (generated)
  prompt: string;                // the full prompt for the subagent
  tier: TaskTier;                // determines model selection + budget
  description: string;           // human-readable summary (for approval UI)
  cwd?: string;                  // working directory (defaults to process.cwd())
  contextFiles?: string[];       // files the subagent should read first
  timeoutMs?: number;            // default 600000 (10 min)
}

export interface ExpectedDuration {
  expectedSeconds: number;       // typical task duration
  pollAfterSeconds: number;      // when to check status
  label: string;                 // human-readable, e.g. "~3 min"
}

export interface BudgetThresholds {
  softWarning: number;           // dollars
  hardFlag: number;              // dollars
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;                // summary of what happened
  filesChanged: string[];        // paths of modified files
  tokenUsage: { input: number; output: number };
  costEstimate: number;          // dollars
  durationMs: number;
  error?: string;                // if success is false
}
