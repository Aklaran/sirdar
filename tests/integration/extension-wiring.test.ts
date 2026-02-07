import { describe, it, expect, beforeEach } from "vitest";
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

  describe("Event Handlers", () => {
    it("registers session_start event handler", () => {
      orchestrator(mockPi);

      const calls = (mockPi.on as any).mock.calls;
      const eventNames = calls.map((call: any) => call[0]);

      expect(eventNames).toContain("session_start");
    });
  });
});
