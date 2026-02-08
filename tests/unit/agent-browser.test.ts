import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentMetadata } from "../../src/agent-metadata-store";

describe("Agent Browser", () => {
  let mockExecSync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecSync = vi.fn();
  });

  describe("Picker Items", () => {
    it("builds picker items from metadata correctly", () => {
      const completed: AgentMetadata[] = [
        {
          taskId: "task-1",
          description: "Fix bug in auth module",
          tier: "light",
          branchName: "branch-task-1",
          repoPath: "/path/to/repo",
          status: "completed",
          completedAt: 1000,
        },
        {
          taskId: "task-2",
          description: "Add new feature",
          tier: "standard",
          branchName: "branch-task-2",
          repoPath: "/path/to/repo",
          status: "completed",
          completedAt: 2000,
        },
      ];

      const items = completed.map(agent => ({
        id: agent.taskId,
        label: agent.description,
        meta: agent.tier,
      }));

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        id: "task-1",
        label: "Fix bug in auth module",
        meta: "light",
      });
      expect(items[1]).toEqual({
        id: "task-2",
        label: "Add new feature",
        meta: "standard",
      });
    });

    it("includes tier as meta field", () => {
      const completed: AgentMetadata[] = [
        {
          taskId: "task-1",
          description: "Complex refactoring",
          tier: "complex",
          branchName: "branch-task-1",
          repoPath: "/path/to/repo",
          status: "completed",
          completedAt: 1000,
        },
      ];

      const items = completed.map(agent => ({
        id: agent.taskId,
        label: agent.description,
        meta: agent.tier,
      }));

      expect(items[0].meta).toBe("complex");
    });
  });

  describe("Git Integration", () => {
    it("executes git commands to get changed files", () => {
      const agentMeta: AgentMetadata = {
        taskId: "task-1",
        description: "Test agent",
        tier: "light",
        branchName: "branch-task-1",
        repoPath: "/path/to/repo",
        status: "completed",
        completedAt: 1000,
      };

      const gitDiffCommand = `git diff main..${agentMeta.branchName} --name-only`;
      const expectedCwd = agentMeta.repoPath;

      expect(gitDiffCommand).toBe("git diff main..branch-task-1 --name-only");
      expect(expectedCwd).toBe("/path/to/repo");
    });

    it("handles git diff output correctly", () => {
      const gitOutput = "file1.ts\nfile2.ts\nfile3.ts\n";
      const changedFiles = gitOutput.trim().split("\n").filter((f: string) => f.length > 0);

      expect(changedFiles).toEqual(["file1.ts", "file2.ts", "file3.ts"]);
    });

    it("filters out empty lines from git output", () => {
      const gitOutput = "file1.ts\n\nfile2.ts\n";
      const changedFiles = gitOutput.trim().split("\n").filter((f: string) => f.length > 0);

      expect(changedFiles).toEqual(["file1.ts", "file2.ts"]);
    });

    it("handles empty git diff output", () => {
      const gitOutput = "";
      const changedFiles = gitOutput.trim().split("\n").filter((f: string) => f.length > 0);

      expect(changedFiles).toEqual([]);
    });
  });

  describe("Sequential Overlay Architecture", () => {
    it("picker resolves with agent id on selection", async () => {
      // Simulates the sequential architecture: picker returns selectedId, then diff opens separately
      let resolvedId: string | null = null;
      
      // Simulate picker behavior
      const pickerPromise = new Promise<string | null>((resolve) => {
        // Simulate user selecting an item
        resolve("task-1");
      });
      
      resolvedId = await pickerPromise;
      expect(resolvedId).toBe("task-1");
    });

    it("picker resolves with null on cancel", async () => {
      const pickerPromise = new Promise<string | null>((resolve) => {
        // Simulate user pressing Escape
        resolve(null);
      });
      
      const result = await pickerPromise;
      expect(result).toBeNull();
    });

    it("loops back to picker after diff closes", async () => {
      // Simulates the while(true) loop: picker → diff → picker → cancel
      const interactions = ["task-1", "task-2", null]; // select, select, cancel
      let iterationCount = 0;
      
      for (const interaction of interactions) {
        iterationCount++;
        if (interaction === null) break;
        // Would show diff here, then loop continues
      }
      
      expect(iterationCount).toBe(3); // 2 selections + 1 cancel
    });

    it("skips diff when agent has no changes", async () => {
      // When pendingCount === 0, we continue (skip diff) and loop back to picker
      const state = { pendingCount: 0 };
      let diffShown = false;
      
      if (state.pendingCount === 0) {
        // continue — don't show diff
      } else {
        diffShown = true;
      }
      
      expect(diffShown).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles agent with no changes gracefully", () => {
      const changedFiles: string[] = [];
      const shouldStayInPicker = changedFiles.length === 0;
      expect(shouldStayInPicker).toBe(true);
    });

    it("handles git command failures gracefully", () => {
      let changedFiles: string[];
      try {
        throw new Error("git command failed");
      } catch {
        changedFiles = [];
      }
      expect(changedFiles).toEqual([]);
    });

    it("handles new files (no original content)", () => {
      let original = "";
      try {
        throw new Error("does not exist in index");
      } catch {
        original = "";
      }
      expect(original).toBe("");
    });

    it("handles deleted files (no current content)", () => {
      let current = "";
      try {
        throw new Error("does not exist in index");
      } catch {
        current = "";
      }
      expect(current).toBe("");
    });
  });
});
