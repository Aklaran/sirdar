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
  } as unknown as ExtensionAPI;
}
