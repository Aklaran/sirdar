import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { ApprovalManager } from "../../src/approval";
import type { TaskDefinition } from "../../src/types";
import type { ApprovalUI } from "../../src/approval";

// Mock UI interface
interface MockApprovalUI extends ApprovalUI {
  confirm: Mock<[string, string], Promise<boolean>>;
  notify: Mock<[string, string], void>;
}

function createMockUI(): MockApprovalUI {
  return {
    confirm: vi.fn(),
    notify: vi.fn(),
  };
}

describe("ApprovalManager", () => {
  let mockUI: MockApprovalUI;
  let approvalManager: ApprovalManager;

  beforeEach(() => {
    mockUI = createMockUI();
    approvalManager = new ApprovalManager(mockUI);
  });

  describe("requestApproval", () => {
    const testTask: TaskDefinition = {
      id: "test-123",
      prompt: "Write a unit test",
      tier: "standard",
      description: "Create unit tests for the API",
    };

    it("calls ui.confirm with correct title", async () => {
      mockUI.confirm.mockResolvedValue(true);

      await approvalManager.requestApproval(testTask);

      expect(mockUI.confirm).toHaveBeenCalledWith(
        "🤖 Spawn Subagent?",
        expect.any(String)
      );
    });

    it("returns true when user approves", async () => {
      mockUI.confirm.mockResolvedValue(true);

      const result = await approvalManager.requestApproval(testTask);

      expect(result).toBe(true);
    });

    it("returns false when user rejects", async () => {
      mockUI.confirm.mockResolvedValue(false);

      const result = await approvalManager.requestApproval(testTask);

      expect(result).toBe(false);
    });

    it('notifies "Spawning agent..." on approval', async () => {
      mockUI.confirm.mockResolvedValue(true);

      await approvalManager.requestApproval(testTask);

      expect(mockUI.notify).toHaveBeenCalledWith(
        "Spawning agent...",
        "info"
      );
    });

    it('notifies "Task cancelled." on rejection', async () => {
      mockUI.confirm.mockResolvedValue(false);

      await approvalManager.requestApproval(testTask);

      expect(mockUI.notify).toHaveBeenCalledWith(
        "Task cancelled.",
        "info"
      );
    });
  });

  describe("formatApprovalMessage", () => {
    it("includes task description", () => {
      const task: TaskDefinition = {
        id: "test-1",
        prompt: "Do something",
        tier: "light",
        description: "Fix the bug in auth module",
      };
      const selection = {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "off" as const,
      };

      const message = approvalManager.formatApprovalMessage(task, selection);

      expect(message).toContain("Task: Fix the bug in auth module");
    });

    it("includes model ID and thinking level", () => {
      const task: TaskDefinition = {
        id: "test-2",
        prompt: "Do something",
        tier: "complex",
        description: "Refactor the codebase",
      };
      const selection = {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "high" as const,
      };

      const message = approvalManager.formatApprovalMessage(task, selection);

      expect(message).toContain("Model: claude-sonnet-4-5 (thinking: high)");
    });

    it("includes budget tier and soft limit", () => {
      const task: TaskDefinition = {
        id: "test-3",
        prompt: "Do something",
        tier: "deep",
        description: "Research and implement algorithm",
      };
      const selection = {
        provider: "anthropic",
        modelId: "claude-opus-4-5",
        thinkingLevel: "medium" as const,
      };

      const message = approvalManager.formatApprovalMessage(task, selection);

      expect(message).toContain("Budget: deep tier (soft limit: $25.00)");
    });

    it("includes custom cwd when provided", () => {
      const task: TaskDefinition = {
        id: "test-4",
        prompt: "Do something",
        tier: "trivial-simple",
        description: "Quick fix",
        cwd: "/home/user/projects/my-app",
      };
      const selection = {
        provider: "anthropic",
        modelId: "claude-haiku-3-5",
        thinkingLevel: "off" as const,
      };

      const message = approvalManager.formatApprovalMessage(task, selection);

      expect(message).toContain("Directory: /home/user/projects/my-app");
    });

    it('shows "default" when no cwd', () => {
      const task: TaskDefinition = {
        id: "test-5",
        prompt: "Do something",
        tier: "standard",
        description: "Standard task",
      };
      const selection = {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
        thinkingLevel: "low" as const,
      };

      const message = approvalManager.formatApprovalMessage(task, selection);

      expect(message).toContain("Directory: default");
    });
  });
});
