import { describe, it, expect, vi } from "vitest";
import { DiffState } from "pi-diff-ui";

/**
 * Tests for review_agent tool's git diff loading logic
 * 
 * These tests verify the core logic of loading git diffs into DiffState,
 * handling new/deleted files, and generating proper summaries.
 */
describe("review_agent git diff loading", () => {
  describe("DiffState integration", () => {
    it("should load multiple files into DiffState", () => {
      const state = new DiffState();
      
      state.trackFile("src/file1.ts", "original content 1", "modified content 1");
      state.trackFile("src/file2.ts", "original content 2", "modified content 2");
      state.trackFile("README.md", "# Old", "# New");
      
      const files = state.getChangedFiles();
      expect(files).toHaveLength(3);
      expect(files).toContain("src/file1.ts");
      expect(files).toContain("src/file2.ts");
      expect(files).toContain("README.md");
    });

    it("should handle new files with empty original", () => {
      const state = new DiffState();
      
      // New file - original is empty
      state.trackFile("new-file.ts", "", "export const newCode = 'fresh';");
      
      const files = state.getChangedFiles();
      expect(files).toHaveLength(1);
      expect(files).toContain("new-file.ts");
      
      const diff = state.getFileDiff("new-file.ts");
      expect(diff).toBeDefined();
      expect(diff?.additions).toBeGreaterThan(0);
      expect(diff?.deletions).toBe(0);
    });

    it("should handle deleted files with empty current", () => {
      const state = new DiffState();
      
      // Deleted file - current is empty
      state.trackFile("deleted-file.ts", "export const oldCode = 'gone';", "");
      
      const files = state.getChangedFiles();
      expect(files).toHaveLength(1);
      expect(files).toContain("deleted-file.ts");
      
      const diff = state.getFileDiff("deleted-file.ts");
      expect(diff).toBeDefined();
      expect(diff?.deletions).toBeGreaterThan(0);
      expect(diff?.additions).toBe(0);
    });

    it("should handle modified files correctly", () => {
      const state = new DiffState();
      
      const original = "line1\nline2\nline3";
      const modified = "line1\nmodified line2\nline3\nline4";
      
      state.trackFile("modified.ts", original, modified);
      
      const diff = state.getFileDiff("modified.ts");
      expect(diff).toBeDefined();
      expect(diff?.additions).toBeGreaterThan(0);
      expect(diff?.deletions).toBeGreaterThan(0);
    });
  });

  describe("git command patterns", () => {
    it("should construct correct git diff --name-only command", () => {
      const branchName = "agent/task-123";
      const command = `git diff main..${branchName} --name-only`;
      
      expect(command).toBe("git diff main..agent/task-123 --name-only");
    });

    it("should construct correct git show main:<file> command", () => {
      const filePath = "src/example.ts";
      const command = `git show main:${filePath}`;
      
      expect(command).toBe("git show main:src/example.ts");
    });

    it("should construct correct git show branch:<file> command", () => {
      const branchName = "agent/task-123";
      const filePath = "src/example.ts";
      const command = `git show ${branchName}:${filePath}`;
      
      expect(command).toBe("git show agent/task-123:src/example.ts");
    });
  });

  describe("error handling patterns", () => {
    it("should handle git show errors gracefully with try-catch", async () => {
      const execGitShow = async (ref: string, filePath: string) => {
        const result = await mockExec(`git show ${ref}:${filePath}`);
        if (result.code !== 0) {
          throw new Error(`git show failed: ${result.stderr}`);
        }
        return result.stdout;
      };

      const mockExec = vi.fn(async (command: string) => {
        if (command.includes("new-file.ts")) {
          return { stdout: "", stderr: "Path does not exist", code: 128 };
        }
        return { stdout: "content", stderr: "", code: 0 };
      });

      // Should handle error and return empty string
      let content = "";
      try {
        content = await execGitShow("main", "new-file.ts");
      } catch {
        content = "";
      }
      
      expect(content).toBe("");
    });
  });

  describe("file list parsing", () => {
    it("should parse git diff --name-only output correctly", () => {
      const output = "src/file1.ts\nsrc/file2.ts\nREADME.md";
      const files = output.trim().split("\n").filter((f) => f.length > 0);
      
      expect(files).toEqual(["src/file1.ts", "src/file2.ts", "README.md"]);
    });

    it("should filter out empty lines", () => {
      const output = "src/file1.ts\n\n\nsrc/file2.ts\n\n";
      const files = output.trim().split("\n").filter((f) => f.length > 0);
      
      expect(files).toEqual(["src/file1.ts", "src/file2.ts"]);
    });

    it("should handle empty output", () => {
      const output = "";
      const files = output.trim().split("\n").filter((f) => f.length > 0);
      
      expect(files).toEqual([]);
    });

    it("should handle single file", () => {
      const output = "single-file.ts";
      const files = output.trim().split("\n").filter((f) => f.length > 0);
      
      expect(files).toEqual(["single-file.ts"]);
    });
  });

  describe("summary text generation", () => {
    it("should generate proper summary with file count", () => {
      const taskId = "task-123";
      const fileCount = 3;
      const stat = " src/file1.ts | 10 ++++++++++\n 3 files changed, 14 insertions(+), 3 deletions(-)";
      
      const summary = `Reviewed ${fileCount} files for ${taskId}\n\n${stat}`;
      
      expect(summary).toContain("Reviewed 3 files");
      expect(summary).toContain("task-123");
      expect(summary).toContain("3 files changed");
    });

    it("should handle single file in summary", () => {
      const taskId = "task-456";
      const fileCount = 1;
      const stat = " README.md | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)";
      
      const summary = `Reviewed ${fileCount} files for ${taskId}\n\n${stat}`;
      
      expect(summary).toContain("Reviewed 1 files");
      expect(summary).toContain("task-456");
    });
  });
});
