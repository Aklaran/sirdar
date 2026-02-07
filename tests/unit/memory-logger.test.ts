import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryLogger } from "../../src/memory-logger";
import type { TaskResult, TaskTier } from "../../src/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Helper to create test TaskResult fixtures
function createTestResult(overrides?: Partial<TaskResult>): TaskResult {
  return {
    taskId: "test-task-1",
    success: true,
    output: "Task completed successfully",
    filesChanged: ["src/index.ts"],
    tokenUsage: { input: 1000, output: 500 },
    costEstimate: 0.15,
    durationMs: 45200,
    ...overrides,
  };
}

describe("MemoryLogger", () => {
  let tempDir: string;
  let logger: MemoryLogger;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-logger-test-"));
    logger = new MemoryLogger(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("getTodayLogPath", () => {
    it("returns path with today's date in YYYY-MM-DD format", () => {
      const logPath = logger.getTodayLogPath();
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const expectedDate = `${year}-${month}-${day}`;
      
      expect(logPath).toContain(expectedDate);
    });

    it("uses orchestrator- prefix", () => {
      const logPath = logger.getTodayLogPath();
      expect(path.basename(logPath)).toMatch(/^orchestrator-/);
    });
  });

  describe("formatTaskSummary", () => {
    it("includes [COMPLETE] for successful tasks", () => {
      const result = createTestResult({ success: true });
      const summary = logger.formatTaskSummary(result, "light", "claude-sonnet-4-5");
      expect(summary).toContain("[COMPLETE]");
    });

    it("includes [FAILED] for failed tasks", () => {
      const result = createTestResult({ 
        success: false, 
        error: "Timeout error" 
      });
      const summary = logger.formatTaskSummary(result, "light", "claude-sonnet-4-5");
      expect(summary).toContain("[FAILED]");
    });

    it("includes task ID, tier, model, description", () => {
      const result = createTestResult({
        taskId: "task-123",
        output: "Add auth endpoint",
      });
      const summary = logger.formatTaskSummary(result, "light", "claude-sonnet-4-5");
      
      expect(summary).toContain("task-123");
      expect(summary).toContain("light");
      expect(summary).toContain("claude-sonnet-4-5");
      expect(summary).toContain("Add auth endpoint");
    });

    it("includes duration in seconds (1 decimal)", () => {
      const result = createTestResult({ durationMs: 45200 }); // 45.2 seconds
      const summary = logger.formatTaskSummary(result, "light", "claude-sonnet-4-5");
      
      expect(summary).toContain("45.2s");
    });

    it("includes cost estimate", () => {
      const result = createTestResult({ costEstimate: 0.15 });
      const summary = logger.formatTaskSummary(result, "light", "claude-sonnet-4-5");
      
      expect(summary).toContain("$0.15");
    });

    it("includes error message for failed tasks", () => {
      const result = createTestResult({ 
        success: false, 
        error: "timeout" 
      });
      const summary = logger.formatTaskSummary(result, "standard", "claude-sonnet-4-5");
      
      expect(summary).toContain("timeout");
    });
  });

  describe("logTaskCompletion", () => {
    it("creates a JSONL file with entry", async () => {
      const result = createTestResult();
      await logger.logTaskCompletion(result, "light", "claude-sonnet-4-5");
      
      const logPath = logger.getTodayLogPath();
      const exists = await fs.access(logPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it("sets type to 'task-complete' for success", async () => {
      const result = createTestResult({ success: true });
      await logger.logTaskCompletion(result, "light", "claude-sonnet-4-5");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("task-complete");
    });

    it("sets type to 'task-failed' for failure", async () => {
      const result = createTestResult({ 
        success: false, 
        error: "Test error" 
      });
      await logger.logTaskCompletion(result, "light", "claude-sonnet-4-5");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("task-failed");
    });

    it("includes metadata (taskId, tier, model, cost, duration)", async () => {
      const result = createTestResult({
        taskId: "task-456",
        costEstimate: 0.25,
        durationMs: 12000,
      });
      await logger.logTaskCompletion(result, "standard", "claude-sonnet-4-5");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].metadata).toBeDefined();
      expect(entries[0].metadata!.taskId).toBe("task-456");
      expect(entries[0].metadata!.tier).toBe("standard");
      expect(entries[0].metadata!.model).toBe("claude-sonnet-4-5");
      expect(entries[0].metadata!.costEstimate).toBe(0.25);
      expect(entries[0].metadata!.durationMs).toBe(12000);
    });
  });

  describe("logReflection", () => {
    it("appends entry with type 'reflection'", async () => {
      await logger.logReflection("This is a reflection");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("reflection");
      expect(entries[0].content).toBe("This is a reflection");
    });
  });

  describe("logPattern", () => {
    it("appends entry with type 'pattern'", async () => {
      await logger.logPattern("Noticed a recurring pattern");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("pattern");
      expect(entries[0].content).toBe("Noticed a recurring pattern");
    });
  });

  describe("logIdea", () => {
    it("appends entry with type 'idea'", async () => {
      await logger.logIdea("Had an interesting idea");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("idea");
      expect(entries[0].content).toBe("Had an interesting idea");
    });
  });

  describe("readTodayEntries", () => {
    it("returns entries from today's log", async () => {
      await logger.logReflection("First entry");
      await logger.logPattern("Second entry");
      await logger.logIdea("Third entry");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(3);
      expect(entries[0].content).toBe("First entry");
      expect(entries[1].content).toBe("Second entry");
      expect(entries[2].content).toBe("Third entry");
    });

    it("returns empty array when no log exists", async () => {
      const entries = await logger.readTodayEntries();
      expect(entries).toEqual([]);
    });
  });

  describe("Multiple entries", () => {
    it("append to same file (not overwrite)", async () => {
      const result1 = createTestResult({ taskId: "task-1" });
      const result2 = createTestResult({ taskId: "task-2" });
      
      await logger.logTaskCompletion(result1, "light", "claude-sonnet-4-5");
      await logger.logReflection("A reflection");
      await logger.logTaskCompletion(result2, "standard", "claude-sonnet-4-5");
      
      const entries = await logger.readTodayEntries();
      expect(entries.length).toBe(3);
      expect(entries[0].metadata!.taskId).toBe("task-1");
      expect(entries[1].content).toBe("A reflection");
      expect(entries[2].metadata!.taskId).toBe("task-2");
    });
  });
});
