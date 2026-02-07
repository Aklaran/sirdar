import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BudgetTracker } from "../../src/budget-tracker";
import type { TaskResult, TaskTier } from "../../src/types";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("BudgetTracker", () => {
  let tempDir: string;
  let tracker: BudgetTracker;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = join(tmpdir(), `budget-tracker-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tracker = new BudgetTracker(tempDir);
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper function to create a TaskResult
  function createTaskResult(taskId: string, costEstimate: number): TaskResult {
    return {
      taskId,
      success: true,
      output: "Task completed",
      filesChanged: [],
      tokenUsage: { input: 1000, output: 500 },
      costEstimate,
      durationMs: 5000,
    };
  }

  describe("recordTask", () => {
    it("stores record in memory", () => {
      const result = createTaskResult("task-1", 0.25);
      tracker.recordTask(result, "light");
      
      const summary = tracker.getTierSummary("light");
      expect(summary.taskCount).toBe(1);
      expect(summary.totalCost).toBe(0.25);
    });

    it("returns null when cost is under soft warning", () => {
      const result = createTaskResult("task-1", 0.25);
      const warning = tracker.recordTask(result, "light");
      
      expect(warning).toBeNull();
    });

    it("returns soft warning when cost exceeds soft threshold", () => {
      const result = createTaskResult("task-1", 0.75);
      const warning = tracker.recordTask(result, "light");
      
      expect(warning).not.toBeNull();
      expect(warning?.type).toBe("soft");
    });

    it("returns hard warning when cost exceeds hard threshold", () => {
      const result = createTaskResult("task-1", 1.50);
      const warning = tracker.recordTask(result, "light");
      
      expect(warning).not.toBeNull();
      expect(warning?.type).toBe("hard");
    });

    it("warning includes correct tier, cost, and threshold", () => {
      const result = createTaskResult("task-1", 0.75);
      const warning = tracker.recordTask(result, "light");
      
      expect(warning).not.toBeNull();
      expect(warning?.tier).toBe("light");
      expect(warning?.taskId).toBe("task-1");
      expect(warning?.cost).toBe(0.75);
      expect(warning?.threshold).toBe(0.50);
      expect(warning?.message).toBeTruthy();
    });
  });

  describe("getTierSummary", () => {
    it("returns correct totals for a tier", () => {
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      tracker.recordTask(createTaskResult("task-2", 0.30), "light");
      tracker.recordTask(createTaskResult("task-3", 0.45), "light");
      
      const summary = tracker.getTierSummary("light");
      expect(summary.tier).toBe("light");
      expect(summary.totalCost).toBe(1.00);
      expect(summary.taskCount).toBe(3);
    });

    it("returns correct average cost", () => {
      tracker.recordTask(createTaskResult("task-1", 0.20), "light");
      tracker.recordTask(createTaskResult("task-2", 0.40), "light");
      tracker.recordTask(createTaskResult("task-3", 0.60), "light");
      
      const summary = tracker.getTierSummary("light");
      expect(summary.averageCost).toBeCloseTo(0.40, 2);
    });

    it("counts tasks over soft warning correctly", () => {
      tracker.recordTask(createTaskResult("task-1", 0.25), "light"); // under
      tracker.recordTask(createTaskResult("task-2", 0.60), "light"); // over soft
      tracker.recordTask(createTaskResult("task-3", 0.75), "light"); // over soft
      tracker.recordTask(createTaskResult("task-4", 1.50), "light"); // over hard
      
      const summary = tracker.getTierSummary("light");
      expect(summary.overSoftCount).toBe(3); // 3 tasks exceeded soft warning
    });

    it("returns zero counts for tier with no tasks", () => {
      const summary = tracker.getTierSummary("deep");
      
      expect(summary.tier).toBe("deep");
      expect(summary.totalCost).toBe(0);
      expect(summary.taskCount).toBe(0);
      expect(summary.averageCost).toBe(0);
      expect(summary.overSoftCount).toBe(0);
    });
  });

  describe("getAllSummaries", () => {
    it("returns summaries only for tiers with tasks", () => {
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      tracker.recordTask(createTaskResult("task-2", 1.50), "standard");
      tracker.recordTask(createTaskResult("task-3", 5.00), "complex");
      
      const summaries = tracker.getAllSummaries();
      
      expect(summaries.length).toBe(3);
      expect(summaries.map(s => s.tier)).toContain("light");
      expect(summaries.map(s => s.tier)).toContain("standard");
      expect(summaries.map(s => s.tier)).toContain("complex");
      expect(summaries.map(s => s.tier)).not.toContain("trivial");
      expect(summaries.map(s => s.tier)).not.toContain("deep");
    });
  });

  describe("persistence", () => {
    it("save creates JSONL file with records", async () => {
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      tracker.recordTask(createTaskResult("task-2", 0.30), "light");
      
      await tracker.save();
      
      const historyFile = join(tempDir, "budget-history.jsonl");
      expect(existsSync(historyFile)).toBe(true);
    });

    it("load restores records from JSONL file", async () => {
      // Create and save some records
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      tracker.recordTask(createTaskResult("task-2", 0.30), "standard");
      await tracker.save();
      
      // Create a new tracker and load
      const newTracker = new BudgetTracker(tempDir);
      await newTracker.load();
      
      const lightSummary = newTracker.getTierSummary("light");
      const standardSummary = newTracker.getTierSummary("standard");
      
      expect(lightSummary.taskCount).toBe(1);
      expect(lightSummary.totalCost).toBe(0.25);
      expect(standardSummary.taskCount).toBe(1);
      expect(standardSummary.totalCost).toBe(0.30);
    });

    it("load handles missing file gracefully (empty records)", async () => {
      const newTracker = new BudgetTracker(tempDir);
      await newTracker.load();
      
      const summary = newTracker.getTierSummary("light");
      expect(summary.taskCount).toBe(0);
    });

    it("save appends (doesn't overwrite existing records in file)", async () => {
      // First batch
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      await tracker.save();
      
      // Second batch
      tracker.recordTask(createTaskResult("task-2", 0.30), "light");
      await tracker.save();
      
      // Load into new tracker
      const newTracker = new BudgetTracker(tempDir);
      await newTracker.load();
      
      const summary = newTracker.getTierSummary("light");
      expect(summary.taskCount).toBe(2);
      expect(summary.totalCost).toBe(0.55);
    });
  });

  describe("formatReport", () => {
    it("includes tier names and costs", () => {
      tracker.recordTask(createTaskResult("task-1", 0.25), "light");
      tracker.recordTask(createTaskResult("task-2", 1.50), "standard");
      
      const report = tracker.formatReport();
      
      expect(report).toContain("Budget Report");
      expect(report).toContain("light");
      expect(report).toContain("standard");
      expect(report).toContain("0.25");
      expect(report).toContain("1.50");
    });

    it("returns message when no tasks recorded", () => {
      const report = tracker.formatReport();
      
      expect(report).toContain("No tasks recorded");
    });
  });
});
