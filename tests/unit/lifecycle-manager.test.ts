import { describe, it, expect, vi, beforeEach } from "vitest";
import { LifecycleManager } from "../../src/lifecycle-manager";
import { createMockSession, createMockSessionFactory } from "../mocks/mock-session";
import type { TaskDefinition } from "../../src/types";

describe("LifecycleManager", () => {
  let mockAuthStorage: any;
  let mockModelRegistry: any;

  beforeEach(() => {
    mockAuthStorage = {};
    mockModelRegistry = {};
  });

  describe("runTask", () => {
    it("calls onOutput callback with text deltas", async () => {
      const mockSession = createMockSession({ outputText: "Hello World" });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task-123",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const onOutputMock = vi.fn();
      await manager.runTask(task, onOutputMock);

      // onOutput should have been called with the delta text
      expect(onOutputMock).toHaveBeenCalledWith("Hello World");
    });

    it("works without onOutput callback", async () => {
      const mockSession = createMockSession({ outputText: "Hello World" });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task-123",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      // Should not throw when onOutput is undefined
      const result = await manager.runTask(task);
      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello World");
    });

    it("returns a TaskResult with correct taskId", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task-123",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);
      expect(result.taskId).toBe("test-task-123");
    });

    it("calls createAgentSession with correct model for the tier", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "complex",
        description: "Complex task",
      };

      await manager.runTask(task);

      expect(mockCreateSession).toHaveBeenCalled();
      const callArgs = mockCreateSession.mock.calls[0][0];
      
      // For "complex" tier, should use claude-sonnet-4-5 with high thinking
      expect(callArgs.model).toBeDefined();
      expect(callArgs.thinkingLevel).toBe("high");
    });

    it("calls createAgentSession with inMemory session manager", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "standard",
        description: "Standard task",
      };

      await manager.runTask(task);

      const callArgs = mockCreateSession.mock.calls[0][0];
      expect(callArgs.sessionManager).toBeDefined();
      // Check that it's an in-memory session manager
      expect(callArgs.sessionManager.sessionFile).toBeUndefined();
    });

    it("includes working directory in system prompt", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
        cwd: "/home/user/repos/myproject/.worktrees/agent-123",
      };

      await manager.runTask(task);

      const callArgs = mockCreateSession.mock.calls[0][0];
      // The resourceLoader should have a system prompt containing the cwd
      const systemPrompt = await callArgs.resourceLoader.getSystemPrompt();
      expect(systemPrompt).toContain("/home/user/repos/myproject/.worktrees/agent-123");
      expect(systemPrompt).toContain("Stay in this directory");
    });

    it("calls session.prompt with the task prompt", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Write a test file",
        tier: "light",
        description: "Test task",
      };

      await manager.runTask(task);

      expect(mockSession.prompt).toHaveBeenCalledWith("Write a test file");
    });

    it("calls session.dispose after completion", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      await manager.runTask(task);

      expect(mockSession.dispose).toHaveBeenCalled();
    });

    it("captures text output from session events", async () => {
      const mockSession = createMockSession({ outputText: "Agent completed the task successfully" });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.output).toBe("Agent completed the task successfully");
    });

    it("returns success:true when session completes normally", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns success:false with error when session.prompt throws", async () => {
      const mockSession = createMockSession({
        shouldThrow: true,
        errorMessage: "Tool execution failed",
      });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Tool execution failed");
    });

    it("still calls session.dispose when session.prompt throws", async () => {
      const mockSession = createMockSession({
        shouldThrow: true,
        errorMessage: "Something went wrong",
      });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      await manager.runTask(task);

      expect(mockSession.dispose).toHaveBeenCalled();
    });

    it("measures duration (durationMs > 0)", async () => {
      const mockSession = createMockSession({ promptDelay: 50 });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(50);
    });

    it("aborts session when timeout exceeded", async () => {
      const mockSession = createMockSession({ promptDelay: 200 });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
        timeoutMs: 50,
      };

      await manager.runTask(task);

      expect(mockSession.abort).toHaveBeenCalled();
    });

    it("returns success:false with timeout error message when timed out", async () => {
      const mockSession = createMockSession({ promptDelay: 200 });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
        timeoutMs: 50,
      };

      const result = await manager.runTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("uses task.cwd when provided", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
        cwd: "/custom/working/dir",
      };

      await manager.runTask(task);

      const callArgs = mockCreateSession.mock.calls[0][0];
      expect(callArgs.cwd).toBe("/custom/working/dir");
    });

    it("defaults cwd to process.cwd() when not provided", async () => {
      const mockSession = createMockSession();
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
        // cwd not provided
      };

      await manager.runTask(task);

      const callArgs = mockCreateSession.mock.calls[0][0];
      expect(callArgs.cwd).toBe(process.cwd());
    });

    it("truncates output longer than 5000 chars", async () => {
      const longOutput = "x".repeat(6000);
      const mockSession = createMockSession({ outputText: longOutput });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.output.length).toBe(5000);
      expect(result.output).toBe(longOutput.substring(longOutput.length - 5000));
    });

    it("runTask keeps last N characters when output exceeds max length", async () => {
      // Create output that has "A"s first then "B"s
      // First 5000 chars are "A"s, last 5000 chars are "B"s = 10000 total
      // When truncated to 5000 from the END, should keep last 5000 which are all "B"s
      const longOutput = "A".repeat(5000) + "B".repeat(5000);
      const mockSession = createMockSession({ outputText: longOutput });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.success).toBe(true);
      expect(result.output.length).toBe(5000);
      // Should start with "B"s (the last part), not "A"s (the first part)
      expect(result.output.startsWith("B")).toBe(true);
      expect(result.output).toBe("B".repeat(5000)); // Last 5000 should be all "B"s
    });

    it("runTask keeps last N characters on error path too", async () => {
      // Create a session that fails with long output
      // First 5000 chars are "A"s, last 5000 chars are "B"s = 10000 total
      // When truncated to 5000 from the END, should keep last 5000 which are all "B"s
      const longOutput = "A".repeat(5000) + "B".repeat(5000);
      const mockSession = createMockSession({
        outputText: longOutput,
        shouldThrow: true,
        errorMessage: "Something went wrong",
      });
      const mockCreateSession = createMockSessionFactory(mockSession);

      const manager = new LifecycleManager({
        createSession: mockCreateSession,
        authStorage: mockAuthStorage,
        modelRegistry: mockModelRegistry,
      });

      const task: TaskDefinition = {
        id: "test-task",
        prompt: "Do something",
        tier: "light",
        description: "Test task",
      };

      const result = await manager.runTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.output.length).toBe(5000);
      // Should start with "B"s (the last part), not "A"s (the first part)
      expect(result.output.startsWith("B")).toBe(true);
      expect(result.output).toBe("B".repeat(5000)); // Last 5000 should be all "B"s
    });
  });
});
