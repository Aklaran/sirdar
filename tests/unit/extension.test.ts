import { describe, it, expect, beforeEach } from "vitest";
import orchestrator from "../../src/index.js";
import { createMockPi } from "../mocks/mock-pi.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("Orchestrator Extension", () => {
  let mockPi: ExtensionAPI;

  beforeEach(() => {
    mockPi = createMockPi();
  });

  it("default export is a function", () => {
    expect(typeof orchestrator).toBe("function");
  });

  it("registers the expected tools (spawn_agent, check_agents, check_budget)", () => {
    orchestrator(mockPi);

    // Verify registerTool was called 3 times
    expect(mockPi.registerTool).toHaveBeenCalledTimes(3);

    // Extract the registered tool names
    const calls = (mockPi.registerTool as any).mock.calls;
    const toolNames = calls.map((call: any) => call[0].name);

    expect(toolNames).toContain("spawn_agent");
    expect(toolNames).toContain("check_agents");
    expect(toolNames).toContain("check_budget");
  });

  it("registers the expected commands (agents)", () => {
    orchestrator(mockPi);

    // Verify registerCommand was called
    expect(mockPi.registerCommand).toHaveBeenCalledTimes(1);

    // Extract the registered command name
    const calls = (mockPi.registerCommand as any).mock.calls;
    const commandName = calls[0][0];

    expect(commandName).toBe("agents");
  });
});
