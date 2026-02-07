import { describe, it, expect } from "vitest";
import { selectModel, getBudgetThresholds, getExpectedDuration } from "../../src/model-selector";
import type { TaskTier, ModelSelection, BudgetThresholds, TaskDefinition, TaskResult } from "../../src/types";

describe("selectModel", () => {
  it("returns claude-haiku-3 with thinking off for trivial-simple tier", () => {
    const result = selectModel("trivial-simple");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-3-haiku-20240307");
    expect(result.thinkingLevel).toBe("off");
  });

  it("returns claude-haiku-4-5 with thinking off for trivial-code tier", () => {
    const result = selectModel("trivial-code");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-haiku-4-5");
    expect(result.thinkingLevel).toBe("off");
  });

  it("returns claude-sonnet-4-5 with thinking minimal for light tier", () => {
    const result = selectModel("light");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-sonnet-4-5");
    expect(result.thinkingLevel).toBe("minimal");
  });

  it("returns claude-sonnet-4-5 with thinking low for standard tier", () => {
    const result = selectModel("standard");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-sonnet-4-5");
    expect(result.thinkingLevel).toBe("low");
  });

  it("returns claude-sonnet-4-5 with thinking high for complex tier", () => {
    const result = selectModel("complex");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-sonnet-4-5");
    expect(result.thinkingLevel).toBe("high");
  });

  it("returns claude-opus-4-5 with thinking medium for deep tier", () => {
    const result = selectModel("deep");
    expect(result.provider).toBe("anthropic");
    expect(result.modelId).toBe("claude-opus-4-5");
    expect(result.thinkingLevel).toBe("medium");
  });

  it("throws error for invalid tier", () => {
    expect(() => selectModel("invalid" as TaskTier)).toThrow();
  });

  it("always returns anthropic as provider for all tiers", () => {
    const tiers: TaskTier[] = ["trivial-simple", "trivial-code", "light", "standard", "complex", "deep"];
    tiers.forEach((tier) => {
      const result = selectModel(tier);
      expect(result.provider).toBe("anthropic");
    });
  });
});

describe("getBudgetThresholds", () => {
  it("returns correct thresholds for trivial-simple tier", () => {
    const result = getBudgetThresholds("trivial-simple");
    expect(result.softWarning).toBe(0.05);
    expect(result.hardFlag).toBe(0.15);
  });

  it("returns correct thresholds for trivial-code tier", () => {
    const result = getBudgetThresholds("trivial-code");
    expect(result.softWarning).toBe(0.10);
    expect(result.hardFlag).toBe(0.25);
  });

  it("returns correct thresholds for light tier", () => {
    const result = getBudgetThresholds("light");
    expect(result.softWarning).toBe(0.50);
    expect(result.hardFlag).toBe(1.00);
  });

  it("returns correct thresholds for standard tier", () => {
    const result = getBudgetThresholds("standard");
    expect(result.softWarning).toBe(2.00);
    expect(result.hardFlag).toBe(5.00);
  });

  it("returns correct thresholds for complex tier", () => {
    const result = getBudgetThresholds("complex");
    expect(result.softWarning).toBe(10.00);
    expect(result.hardFlag).toBe(20.00);
  });

  it("returns correct thresholds for deep tier", () => {
    const result = getBudgetThresholds("deep");
    expect(result.softWarning).toBe(25.00);
    expect(result.hardFlag).toBe(50.00);
  });

  it("throws error for invalid tier", () => {
    expect(() => getBudgetThresholds("invalid" as TaskTier)).toThrow();
  });
});

describe("Type compilation checks", () => {
  it("TaskDefinition type works correctly", () => {
    const taskDef: TaskDefinition = {
      id: "task-123",
      prompt: "Implement a feature",
      tier: "standard",
      description: "Add user authentication",
      cwd: "/home/user/project",
      contextFiles: ["src/auth.ts", "src/types.ts"],
      timeoutMs: 600000,
    };

    // Additional type checks for new tiers
    const trivialSimpleDef: TaskDefinition = {
      id: "task-simple-001",
      prompt: "Fix a typo",
      tier: "trivial-simple",
      description: "Correct a minor spelling error",
    };

    const trivialCodeDef: TaskDefinition = {
      id: "task-code-001",
      prompt: "Refactor a small function",
      tier: "trivial-code",
      description: "Minor code cleanup",
    };
    
    expect(taskDef.id).toBe("task-123");
    expect(taskDef.tier).toBe("standard");
  });

  it("TaskResult type works correctly", () => {
    const taskResult: TaskResult = {
      taskId: "task-123",
      success: true,
      output: "Successfully implemented authentication",
      filesChanged: ["src/auth.ts", "src/middleware.ts"],
      tokenUsage: { input: 1000, output: 500 },
      costEstimate: 0.75,
      durationMs: 45000,
      error: undefined,
    };
    
    expect(taskResult.success).toBe(true);
    expect(taskResult.filesChanged.length).toBe(2);
  });

  it("TaskResult type works correctly with error", () => {
    const taskResult: TaskResult = {
      taskId: "task-456",
      success: false,
      output: "Task failed",
      filesChanged: [],
      tokenUsage: { input: 500, output: 100 },
      costEstimate: 0.15,
      durationMs: 5000,
      error: "Timeout exceeded",
    };
    
    expect(taskResult.success).toBe(false);
    expect(taskResult.error).toBe("Timeout exceeded");
  });

  it("ModelSelection type works correctly", () => {
    const selection: ModelSelection = {
      provider: "anthropic",
      modelId: "claude-sonnet-4-5",
      thinkingLevel: "low",
    };
    
    expect(selection.provider).toBe("anthropic");
    expect(selection.thinkingLevel).toBe("low");
  });

  it("BudgetThresholds type works correctly", () => {
    const thresholds: BudgetThresholds = {
      softWarning: 2.00,
      hardFlag: 5.00,
    };
    
    expect(thresholds.softWarning).toBe(2.00);
    expect(thresholds.hardFlag).toBe(5.00);
  });
});

describe("getExpectedDuration", () => {
  it("returns 15s for trivial-simple", () => {
    const result = getExpectedDuration("trivial-simple");
    expect(result.expectedSeconds).toBe(15);
    expect(result.pollAfterSeconds).toBe(15);
  });

  it("returns 30s for trivial-code", () => {
    const result = getExpectedDuration("trivial-code");
    expect(result.expectedSeconds).toBe(30);
    expect(result.pollAfterSeconds).toBe(30);
  });

  it("returns 60s for light", () => {
    const result = getExpectedDuration("light");
    expect(result.expectedSeconds).toBe(90);
    expect(result.pollAfterSeconds).toBe(60);
  });

  it("returns 90s for standard", () => {
    const result = getExpectedDuration("standard");
    expect(result.expectedSeconds).toBe(180);
    expect(result.pollAfterSeconds).toBe(90);
  });

  it("returns 3min for complex", () => {
    const result = getExpectedDuration("complex");
    expect(result.expectedSeconds).toBe(420);
    expect(result.pollAfterSeconds).toBe(180);
  });

  it("returns 5min for deep", () => {
    const result = getExpectedDuration("deep");
    expect(result.expectedSeconds).toBe(900);
    expect(result.pollAfterSeconds).toBe(300);
  });

  it("throws for invalid tier", () => {
    expect(() => getExpectedDuration("invalid" as any)).toThrow("Invalid task tier");
  });

  it("has human-readable label", () => {
    const result = getExpectedDuration("standard");
    expect(result.label).toBe("~3 min");
  });
});
