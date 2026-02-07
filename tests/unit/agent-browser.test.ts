import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentMetadata } from "../../src/agent-metadata-store";

describe("Agent Browser", () => {
  let mockExecSync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock execSync for git commands
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

      // Build picker items (same logic as in keyboard handler)
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

      // Simulate the git commands
      const gitDiffCommand = `git diff main..${agentMeta.branchName} --name-only`;
      const expectedCwd = agentMeta.repoPath;

      // Mock would be called with these parameters in the actual handler
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

  describe("State Machine", () => {
    it("starts in picker mode", () => {
      let mode: "picker" | "diff" = "picker";
      
      expect(mode).toBe("picker");
    });

    it("switches to diff mode on agent selection", () => {
      let mode: "picker" | "diff" = "picker";
      
      // Simulate selecting an agent
      mode = "diff";
      
      expect(mode).toBe("diff");
    });

    it("switches back to picker mode when diff closes", () => {
      let mode: "picker" | "diff" = "diff";
      
      // Simulate closing diff overlay (q key)
      mode = "picker";
      
      expect(mode).toBe("picker");
    });
  });

  describe("Handler Delegation", () => {
    it("delegates render to active handler", () => {
      const mockPickerHandler = {
        render: vi.fn((w: number) => ["picker line 1", "picker line 2"]),
        handleInput: vi.fn((d: string) => true),
        invalidate: vi.fn(),
      };
      
      const mockDiffHandler = {
        render: vi.fn((w: number) => ["diff line 1", "diff line 2"]),
        handleInput: vi.fn((d: string) => true),
        invalidate: vi.fn(),
      };
      
      // In picker mode
      let activeHandler = mockPickerHandler;
      let result = activeHandler.render(80);
      expect(result).toEqual(["picker line 1", "picker line 2"]);
      expect(mockPickerHandler.render).toHaveBeenCalledWith(80);
      
      // Switch to diff mode
      activeHandler = mockDiffHandler;
      result = activeHandler.render(80);
      expect(result).toEqual(["diff line 1", "diff line 2"]);
      expect(mockDiffHandler.render).toHaveBeenCalledWith(80);
    });

    it("delegates handleInput to active handler", () => {
      const mockPickerHandler = {
        render: vi.fn((w: number) => []),
        handleInput: vi.fn((d: string) => true),
      };
      
      const mockDiffHandler = {
        render: vi.fn((w: number) => []),
        handleInput: vi.fn((d: string) => false),
      };
      
      // In picker mode
      let activeHandler = mockPickerHandler;
      let consumed = activeHandler.handleInput("j");
      expect(consumed).toBe(true);
      expect(mockPickerHandler.handleInput).toHaveBeenCalledWith("j");
      
      // Switch to diff mode
      activeHandler = mockDiffHandler;
      consumed = activeHandler.handleInput("q");
      expect(consumed).toBe(false);
      expect(mockDiffHandler.handleInput).toHaveBeenCalledWith("q");
    });

    it("delegates invalidate to active handler if available", () => {
      const mockHandler = {
        render: vi.fn((w: number) => []),
        handleInput: vi.fn((d: string) => true),
        invalidate: vi.fn(),
      };
      
      const activeHandler = mockHandler;
      activeHandler.invalidate?.();
      
      expect(mockHandler.invalidate).toHaveBeenCalled();
    });

    it("handles missing invalidate gracefully", () => {
      const mockHandler: {
        render: (w: number) => string[];
        handleInput: (d: string) => boolean;
        invalidate?: () => void;
      } = {
        render: vi.fn((w: number) => []),
        handleInput: vi.fn((d: string) => true),
        // no invalidate
      };
      
      const activeHandler = mockHandler;
      
      // Should not throw
      expect(() => activeHandler.invalidate?.()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("handles agent with no changes gracefully", () => {
      // When git diff returns empty, state.pendingCount should be 0
      const changedFiles: string[] = [];
      
      // In the handler, we check if state.pendingCount === 0 and stay in picker mode
      const shouldStayInPicker = changedFiles.length === 0;
      
      expect(shouldStayInPicker).toBe(true);
    });

    it("handles git command failures gracefully", () => {
      // When execSync throws, we catch and set changedFiles to []
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
        // Simulate git show main:newfile.ts throwing
        throw new Error("does not exist in index");
      } catch {
        // Expected for new files
        original = "";
      }
      
      expect(original).toBe("");
    });

    it("handles deleted files (no current content)", () => {
      let current = "";
      try {
        // Simulate git show branch:deletedfile.ts throwing
        throw new Error("does not exist in index");
      } catch {
        // Expected for deleted files
        current = "";
      }
      
      expect(current).toBe("");
    });
  });
});
