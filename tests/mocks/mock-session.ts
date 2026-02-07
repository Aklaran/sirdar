import { vi } from "vitest";
import type { AgentSession, AgentSessionEvent } from "@mariozechner/pi-coding-agent";

/**
 * Create a mock AgentSession for testing
 */
export function createMockSession(options?: {
  promptDelay?: number;
  shouldThrow?: boolean;
  errorMessage?: string;
  outputText?: string;
}): AgentSession {
  const {
    promptDelay = 10,
    shouldThrow = false,
    errorMessage = "Mock session error",
    outputText = "Mock agent output",
  } = options || {};

  let subscribers: Array<(event: AgentSessionEvent) => void> = [];
  let isAborted = false;

  const mockSession = {
    prompt: vi.fn(async () => {
      if (isAborted) {
        throw new Error("Session aborted");
      }

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, promptDelay));

      if (isAborted) {
        throw new Error("Session aborted");
      }

      // Simulate events during processing
      // Text delta event (emit before throwing so error path has output)
      subscribers.forEach((listener) => {
        listener({
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: outputText,
          },
        } as AgentSessionEvent);
      });

      if (shouldThrow) {
        throw new Error(errorMessage);
      }

      // Agent end event
      subscribers.forEach((listener) => {
        listener({
          type: "agent_end",
          messages: [],
        } as AgentSessionEvent);
      });
    }),

    subscribe: vi.fn((listener: (event: AgentSessionEvent) => void) => {
      subscribers.push(listener);
      return () => {
        subscribers = subscribers.filter((l) => l !== listener);
      };
    }),

    dispose: vi.fn(),

    abort: vi.fn(async () => {
      isAborted = true;
    }),

    isStreaming: false,
    sessionId: "mock-session-id",
    sessionFile: undefined,
    messages: [],
  } as unknown as AgentSession;

  return mockSession;
}

/**
 * Mock factory for createAgentSession
 */
export function createMockSessionFactory(mockSession: AgentSession) {
  return vi.fn(async () => ({
    session: mockSession,
    extensionsResult: {
      extensions: [],
      errors: [],
      runtime: {} as any,
    },
  }));
}
