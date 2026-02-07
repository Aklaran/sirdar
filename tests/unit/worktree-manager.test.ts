import { describe, it, expect, vi } from "vitest";
import { WorktreeManager, type ExecFunction } from "../../src/worktree-manager";

/**
 * Mock exec helper that records calls and returns configurable responses
 */
function createMockExec(responses?: Map<string, { stdout: string; stderr: string; code: number }>) {
  const calls: Array<{ command: string; options?: { cwd?: string } }> = [];
  const defaultResponse = { stdout: "", stderr: "", code: 0 };

  const exec = vi.fn(async (command: string, options?: { cwd?: string }) => {
    calls.push({ command, options });
    // Match on command substring
    for (const [key, response] of responses ?? []) {
      if (command.includes(key)) return response;
    }
    return defaultResponse;
  }) as ExecFunction;

  return { exec, calls };
}

describe("WorktreeManager", () => {
  describe("createWorktree", () => {
    it("calls git rev-parse to verify repo", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.createWorktree("task-1", "/path/to/repo");

      const revParseCall = calls.find((c) => c.command.includes("git rev-parse --git-dir"));
      expect(revParseCall).toBeDefined();
      expect(revParseCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("calls mkdir for .worktrees directory", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.createWorktree("task-1", "/path/to/repo");

      const mkdirCall = calls.find((c) => c.command.includes("mkdir -p"));
      expect(mkdirCall).toBeDefined();
      expect(mkdirCall?.command).toContain("/path/to/repo/.worktrees");
    });

    it("calls git worktree add with correct branch name", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.createWorktree("task-1", "/path/to/repo");

      const worktreeCall = calls.find((c) => c.command.includes("git worktree add"));
      expect(worktreeCall).toBeDefined();
      expect(worktreeCall?.command).toContain(".worktrees/task-1");
      expect(worktreeCall?.command).toContain("-b agent/task-1");
      expect(worktreeCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("returns WorktreeInfo with correct paths", async () => {
      const { exec } = createMockExec();
      const manager = new WorktreeManager(exec);

      const info = await manager.createWorktree("task-1", "/path/to/repo");

      expect(info).toEqual({
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      });
    });

    it("throws if path is not a git repo", async () => {
      const responses = new Map([
        ["git rev-parse", { stdout: "", stderr: "not a git repository", code: 1 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      await expect(manager.createWorktree("task-1", "/not/a/repo")).rejects.toThrow(
        "Not a git repository"
      );
    });
  });

  describe("getDiff", () => {
    it("runs git diff HEAD in worktree directory", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      await manager.getDiff(info);

      const diffCall = calls.find((c) => c.command.includes("git diff HEAD"));
      expect(diffCall).toBeDefined();
      expect(diffCall?.options?.cwd).toBe("/path/to/repo/.worktrees/task-1");
    });

    it("returns empty string when no changes", async () => {
      const responses = new Map([
        ["git diff HEAD", { stdout: "", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      const diff = await manager.getDiff(info);
      expect(diff).toBe("");
    });

    it("returns diff output when changes exist", async () => {
      const diffOutput = `diff --git a/file.ts b/file.ts
index 123..456 789
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
+// New line
 export const test = 1;`;

      const responses = new Map([
        ["git diff HEAD", { stdout: diffOutput, stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      const diff = await manager.getDiff(info);
      expect(diff).toBe(diffOutput);
    });
  });

  describe("getChangedFiles", () => {
    it("parses git diff --name-only output into array", async () => {
      const responses = new Map([
        ["git diff HEAD --name-only", { stdout: "src/file1.ts\nsrc/file2.ts\nREADME.md", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      const files = await manager.getChangedFiles(info);
      expect(files).toEqual(["src/file1.ts", "src/file2.ts", "README.md"]);
    });

    it("returns empty array when no changes", async () => {
      const responses = new Map([
        ["git diff HEAD --name-only", { stdout: "", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      const files = await manager.getChangedFiles(info);
      expect(files).toEqual([]);
    });

    it("filters empty lines from output", async () => {
      const responses = new Map([
        ["git diff HEAD --name-only", { stdout: "src/file1.ts\n\n\nsrc/file2.ts\n\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      const files = await manager.getChangedFiles(info);
      expect(files).toEqual(["src/file1.ts", "src/file2.ts"]);
    });
  });

  describe("cleanup", () => {
    it("calls git worktree remove with --force", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      await manager.cleanup(info);

      const removeCall = calls.find((c) => c.command.includes("git worktree remove"));
      expect(removeCall).toBeDefined();
      expect(removeCall?.command).toContain(".worktrees/task-1");
      expect(removeCall?.command).toContain("--force");
      expect(removeCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("calls git branch -D with correct branch name", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      await manager.cleanup(info);

      const branchCall = calls.find((c) => c.command.includes("git branch -D"));
      expect(branchCall).toBeDefined();
      expect(branchCall?.command).toContain("agent/task-1");
      expect(branchCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("does not throw when worktree already removed", async () => {
      const responses = new Map([
        ["git worktree remove", { stdout: "", stderr: "worktree not found", code: 1 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const info = {
        taskId: "task-1",
        worktreePath: "/path/to/repo/.worktrees/task-1",
        branchName: "agent/task-1",
        repoPath: "/path/to/repo",
      };

      // Should not throw
      await expect(manager.cleanup(info)).resolves.toBeUndefined();
    });
  });

  describe("isGitRepo", () => {
    it("returns true when git rev-parse succeeds", async () => {
      const responses = new Map([
        ["git rev-parse", { stdout: ".git", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const result = await manager.isGitRepo("/path/to/repo");
      expect(result).toBe(true);
    });

    it("returns false when git rev-parse fails", async () => {
      const responses = new Map([
        ["git rev-parse", { stdout: "", stderr: "not a git repository", code: 1 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const result = await manager.isGitRepo("/not/a/repo");
      expect(result).toBe(false);
    });
  });

  describe("getDefaultBranch", () => {
    it("parses symbolic-ref output correctly", async () => {
      const responses = new Map([
        ["git symbolic-ref refs/remotes/origin/HEAD", { stdout: "refs/remotes/origin/main\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const branch = await manager.getDefaultBranch("/path/to/repo");
      expect(branch).toBe("main");
    });

    it("handles master branch from symbolic-ref", async () => {
      const responses = new Map([
        ["git symbolic-ref refs/remotes/origin/HEAD", { stdout: "refs/remotes/origin/master\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const branch = await manager.getDefaultBranch("/path/to/repo");
      expect(branch).toBe("master");
    });

    it("falls back to branch --list when no remote", async () => {
      const responses = new Map([
        ["git symbolic-ref", { stdout: "", stderr: "no such ref", code: 1 }],
        ["git branch --list main master", { stdout: "  main\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const branch = await manager.getDefaultBranch("/path/to/repo");
      expect(branch).toBe("main");
    });

    it("falls back to master when main not found", async () => {
      const responses = new Map([
        ["git symbolic-ref", { stdout: "", stderr: "no such ref", code: 1 }],
        ["git branch --list main master", { stdout: "  master\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const branch = await manager.getDefaultBranch("/path/to/repo");
      expect(branch).toBe("master");
    });

    it("defaults to main when nothing found", async () => {
      const responses = new Map([
        ["git symbolic-ref", { stdout: "", stderr: "no such ref", code: 1 }],
        ["git branch --list main master", { stdout: "", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const branch = await manager.getDefaultBranch("/path/to/repo");
      expect(branch).toBe("main");
    });
  });

  describe("mergeWorktree", () => {
    const testInfo = {
      taskId: "task-1",
      worktreePath: "/path/to/repo/.worktrees/task-1",
      branchName: "agent/task-1",
      repoPath: "/path/to/repo",
    };

    it("runs git rebase with target and branch", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      const rebaseCall = calls.find((c) => c.command.includes("git rebase"));
      expect(rebaseCall).toBeDefined();
      expect(rebaseCall?.command).toContain("git rebase main agent/task-1");
      expect(rebaseCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("checks out target branch after successful rebase", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      const checkoutCall = calls.find((c) => c.command.includes("git checkout"));
      expect(checkoutCall).toBeDefined();
      expect(checkoutCall?.command).toContain("git checkout main");
      expect(checkoutCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("runs git merge with --ff-only after rebase", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      const mergeCall = calls.find((c) => c.command.includes("git merge"));
      expect(mergeCall).toBeDefined();
      expect(mergeCall?.command).toContain("git merge agent/task-1 --ff-only");
      expect(mergeCall?.options?.cwd).toBe("/path/to/repo");
    });

    it("returns success:true on clean rebase and merge", async () => {
      const { exec } = createMockExec();
      const manager = new WorktreeManager(exec);

      const result = await manager.mergeWorktree(testInfo, "main");

      expect(result).toEqual({
        success: true,
        mergedBranch: "agent/task-1",
      });
    });

    it("calls cleanup after successful rebase and merge", async () => {
      const { exec, calls } = createMockExec();
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      // Should have cleanup calls (worktree remove and branch delete)
      const worktreeRemove = calls.find((c) => c.command.includes("git worktree remove"));
      const branchDelete = calls.find((c) => c.command.includes("git branch -D"));

      expect(worktreeRemove).toBeDefined();
      expect(branchDelete).toBeDefined();
    });

    it("attempts conflict resolution when rebase fails", async () => {
      const responses = new Map([
        ["git rebase --continue", { stdout: "", stderr: "", code: 0 }],  // More specific first
        ["git rebase --abort", { stdout: "", stderr: "", code: 0 }],
        ["git rebase", { stdout: "", stderr: "CONFLICT", code: 1 }],
        ["git checkout --theirs", { stdout: "", stderr: "", code: 0 }],
        ["git add -A", { stdout: "", stderr: "", code: 0 }],
      ]);
      const { exec, calls } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      const checkoutTheirs = calls.find((c) => c.command.includes("git checkout --theirs ."));
      const gitAdd = calls.find((c) => c.command.includes("git add -A"));
      const rebaseContinue = calls.find((c) => c.command.includes("git rebase --continue"));

      expect(checkoutTheirs).toBeDefined();
      expect(gitAdd).toBeDefined();
      expect(rebaseContinue).toBeDefined();
    });

    it("completes merge after successful conflict resolution", async () => {
      const responses = new Map([
        ["git rebase --continue", { stdout: "", stderr: "", code: 0 }],  // More specific first
        ["git rebase --abort", { stdout: "", stderr: "", code: 0 }],
        ["git rebase", { stdout: "", stderr: "CONFLICT", code: 1 }],
        ["git checkout --theirs", { stdout: "", stderr: "", code: 0 }],
        ["git add -A", { stdout: "", stderr: "", code: 0 }],
      ]);
      const { exec, calls } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const result = await manager.mergeWorktree(testInfo, "main");

      // Should checkout target and ff-merge after successful conflict resolution
      const checkoutCall = calls.find((c) => c.command.includes("git checkout main"));
      const mergeCall = calls.find((c) => c.command.includes("git merge agent/task-1 --ff-only"));

      expect(checkoutCall).toBeDefined();
      expect(mergeCall).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("aborts rebase when conflict resolution fails", async () => {
      const responses = new Map([
        ["git rebase --continue", { stdout: "", stderr: "still conflicts", code: 1 }],  // More specific first
        ["git rebase --abort", { stdout: "", stderr: "", code: 0 }],
        ["git rebase", { stdout: "", stderr: "CONFLICT", code: 1 }],
        ["git checkout --theirs", { stdout: "", stderr: "", code: 0 }],
        ["git add -A", { stdout: "", stderr: "", code: 0 }],
        ["git diff --name-only --diff-filter=U", { stdout: "src/file1.ts\nsrc/file2.ts\n", stderr: "", code: 0 }],
      ]);
      const { exec, calls } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo, "main");

      const rebaseAbort = calls.find((c) => c.command.includes("git rebase --abort"));
      expect(rebaseAbort).toBeDefined();
      expect(rebaseAbort?.options?.cwd).toBe("/path/to/repo");
    });

    it("returns success:false with conflictFiles when rebase cannot be resolved", async () => {
      const responses = new Map([
        ["git rebase --continue", { stdout: "", stderr: "still conflicts", code: 1 }],  // More specific first
        ["git rebase --abort", { stdout: "", stderr: "", code: 0 }],
        ["git rebase", { stdout: "", stderr: "CONFLICT", code: 1 }],
        ["git checkout --theirs", { stdout: "", stderr: "", code: 0 }],
        ["git add -A", { stdout: "", stderr: "", code: 0 }],
        ["git diff --name-only --diff-filter=U", { stdout: "src/file1.ts\nsrc/file2.ts\n", stderr: "", code: 0 }],
      ]);
      const { exec } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      const result = await manager.mergeWorktree(testInfo, "main");

      expect(result).toEqual({
        success: false,
        mergedBranch: "agent/task-1",
        conflictFiles: ["src/file1.ts", "src/file2.ts"],
        error: "Rebase conflicts could not be resolved",
      });
    });

    it("uses getDefaultBranch when targetBranch not provided", async () => {
      const responses = new Map([
        ["git symbolic-ref refs/remotes/origin/HEAD", { stdout: "refs/remotes/origin/main\n", stderr: "", code: 0 }],
      ]);
      const { exec, calls } = createMockExec(responses);
      const manager = new WorktreeManager(exec);

      await manager.mergeWorktree(testInfo);

      // Should call symbolic-ref to get default branch
      const symbolicRefCall = calls.find((c) => c.command.includes("git symbolic-ref"));
      expect(symbolicRefCall).toBeDefined();

      // Should rebase onto main
      const rebaseCall = calls.find((c) => c.command.includes("git rebase"));
      expect(rebaseCall?.command).toContain("git rebase main");
    });
  });
});
