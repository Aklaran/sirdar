import { vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Mock ExtensionAPI for testing
 */
export function createMockPi(): ExtensionAPI {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }),
    appendEntry: vi.fn(),
    events: { 
      on: vi.fn(), 
      emit: vi.fn() 
    },
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
  } as unknown as ExtensionAPI;
}
