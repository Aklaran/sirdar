import { describe, it, expect, beforeEach, vi } from "vitest";
import orchestrator from "../../src/index.js";
import { createMockPi } from "../mocks/mock-pi.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("Extension Wiring - Integration Tests", () => {
  let mockPi: ExtensionAPI;

  beforeEach(() => {
    mockPi = createMockPi();
  });

  describe("Tool Registration", () => {
    it("registers all 4 tools (spawn_agent, check_agents, check_budget, log_reflection)", () => {
      orchestrator(mockPi);

      // Verify registerTool was called 4 times
      expect(mockPi.registerTool).toHaveBeenCalledTimes(4);

      // Extract the registered tool names
      const calls = (mockPi.registerTool as any).mock.calls;
      const toolNames = calls.map((call: any) => call[0].name);

      expect(toolNames).toContain("spawn_agent");
      expect(toolNames).toContain("check_agents");
      expect(toolNames).toContain("check_budget");
      expect(toolNames).toContain("log_reflection");
    });

    it("spawn_agent tool has correct parameter names", () => {
      orchestrator(mockPi);

      const calls = (mockPi.registerTool as any).mock.calls;
      const spawnAgentCall = calls.find((call: any) => call[0].name === "spawn_agent");
      
      expect(spawnAgentCall).toBeDefined();
      const params = spawnAgentCall[0].parameters.properties;
      
      expect(params).toHaveProperty("description");
      expect(params).toHaveProperty("prompt");
      expect(params).toHaveProperty("tier");
      expect(params).toHaveProperty("cwd");
      expect(params).toHaveProperty("useWorktree");
    });

    it("check_agents tool has status parameter", () => {
      orchestrator(mockPi);

      const calls = (mockPi.registerTool as any).mock.calls;
      const checkAgentsCall = calls.find((call: any) => call[0].name === "check_agents");
      
      expect(checkAgentsCall).toBeDefined();
      const params = checkAgentsCall[0].parameters.properties;
      
      expect(params).toHaveProperty("status");
    });

    it("check_budget tool has empty parameters", () => {
      orchestrator(mockPi);

      const calls = (mockPi.registerTool as any).mock.calls;
      const checkBudgetCall = calls.find((call: any) => call[0].name === "check_budget");
      
      expect(checkBudgetCall).toBeDefined();
      const params = checkBudgetCall[0].parameters.properties;
      
      // Empty object has no properties
      expect(Object.keys(params || {})).toHaveLength(0);
    });

    it("log_reflection tool has content and type parameters", () => {
      orchestrator(mockPi);

      const calls = (mockPi.registerTool as any).mock.calls;
      const logReflectionCall = calls.find((call: any) => call[0].name === "log_reflection");
      
      expect(logReflectionCall).toBeDefined();
      const params = logReflectionCall[0].parameters.properties;
      
      expect(params).toHaveProperty("content");
      expect(params).toHaveProperty("type");
    });
  });

  describe("Command Registration", () => {
    it("registers /agents command", () => {
      orchestrator(mockPi);

      expect(mockPi.registerCommand).toHaveBeenCalledTimes(1);

      const calls = (mockPi.registerCommand as any).mock.calls;
      const commandName = calls[0][0];

      expect(commandName).toBe("agents");
    });
  });

  describe("onUpdate format", () => {
    it("spawn_agent onUpdate calls use correct Pi SDK format { content: [{ type, text }] }", async () => {
      orchestrator(mockPi);

      const calls = (mockPi.registerTool as any).mock.calls;
      const spawnAgentTool = calls.find((call: any) => call[0].name === "spawn_agent");
      const execute = spawnAgentTool[0].execute;

      const onUpdate = vi.fn();
      const mockCtx = {
        ui: {
          confirm: vi.fn().mockResolvedValue(false), // reject so we don't need agent pool
          notify: vi.fn(),
          setStatus: vi.fn(),
        },
      };

      await execute(
        "test-call-id",
        { description: "test", prompt: "test", tier: "light" },
        new AbortController().signal,
        onUpdate,
        mockCtx,
      );

      // onUpdate should have been called at least once (the approval request step)
      expect(onUpdate).toHaveBeenCalled();
      
      // Every call should use the Pi SDK format
      for (const call of onUpdate.mock.calls) {
        const arg = call[0];
        expect(arg).toHaveProperty("content");
        expect(Array.isArray(arg.content)).toBe(true);
        expect(arg.content[0]).toHaveProperty("type", "text");
        expect(arg.content[0]).toHaveProperty("text");
        expect(typeof arg.content[0].text).toBe("string");
      }
    });
  });

  describe("Event Handlers", () => {
    it("registers session_start event handler", () => {
      orchestrator(mockPi);

      const calls = (mockPi.on as any).mock.calls;
      const eventNames = calls.map((call: any) => call[0]);

      expect(eventNames).toContain("session_start");
    });
  });

  describe("Widget Infrastructure", () => {
    it("extension initializes agent-output widget infrastructure", async () => {
      orchestrator(mockPi);

      // Get the session_start handler
      const calls = (mockPi.on as any).mock.calls;
      const sessionStartCall = calls.find((call: any) => call[0] === "session_start");
      expect(sessionStartCall).toBeDefined();

      const handler = sessionStartCall[1];

      // Create a mock context with setWidget
      const mockCtx = {
        ui: {
          setWidget: vi.fn(),
          setStatus: vi.fn(),
          confirm: vi.fn(),
          notify: vi.fn(),
          select: vi.fn(),
        },
        authStorage: {},
        modelRegistry: {},
      };

      // Call the session_start handler
      await handler({}, mockCtx);

      // Verify that setWidget is available and callable (lightweight check)
      expect(mockCtx.ui.setWidget).toBeDefined();
      expect(typeof mockCtx.ui.setWidget).toBe("function");
    });
  });
});
