import { describe, it, expect } from "vitest";
import { getAgentStatusText } from "../../src/status-text.js";

describe("getAgentStatusText", () => {
  it("returns undefined when nothing is happening and no diffs to review", () => {
    expect(getAgentStatusText(0, 0, 0)).toBeUndefined();
  });

  it("shows running count", () => {
    expect(getAgentStatusText(2, 0, 0)).toBe("🤖 2 running");
  });

  it("shows running and queued counts", () => {
    expect(getAgentStatusText(3, 2, 0)).toBe("🤖 3 running, 2 queued");
  });

  it("shows diffs to review when no agents are active", () => {
    expect(getAgentStatusText(0, 0, 4)).toBe("🤖 4 to review (Ctrl+Shift+A)");
  });

  it("shows running count with diffs to review", () => {
    expect(getAgentStatusText(1, 0, 3)).toBe("🤖 1 running, 3 to review");
  });

  it("shows running, queued, and diffs to review", () => {
    expect(getAgentStatusText(2, 1, 5)).toBe("🤖 2 running, 1 queued, 5 to review");
  });

  it("shows queued with diffs to review (no running)", () => {
    expect(getAgentStatusText(0, 1, 2)).toBe("🤖 0 running, 1 queued, 2 to review");
  });

  it("shows singular 'to review' for 1 diff", () => {
    expect(getAgentStatusText(0, 0, 1)).toBe("🤖 1 to review (Ctrl+Shift+A)");
  });
});
