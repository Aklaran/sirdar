/**
 * WorktreeManager - Manages git worktrees for isolated subagent execution
 */

export interface WorktreeInfo {
  taskId: string;
  worktreePath: string;
  branchName: string;
  repoPath: string;
}

export interface MergeResult {
  success: boolean;
  mergedBranch: string;
  conflictFiles?: string[];
  error?: string;
}

/**
 * Injectable exec function type for shell execution
 */
export type ExecFunction = (
  command: string,
  options?: { cwd?: string }
) => Promise<{ stdout: string; stderr: string; code: number }>;

/**
 * Manages git worktrees for isolated task execution
 */
export class WorktreeManager {
  constructor(private exec: ExecFunction) {}

  /**
   * Create a worktree for a task. Returns the worktree path.
   * Creates branch: agent/<taskId>
   * Creates worktree at: <repoPath>/.worktrees/<taskId>
   */
  async createWorktree(taskId: string, repoPath: string): Promise<WorktreeInfo> {
    // 1. Verify repoPath is a git repo
    const revParseResult = await this.exec("git rev-parse --git-dir", { cwd: repoPath });
    if (revParseResult.code !== 0) {
      throw new Error(`Not a git repository: ${repoPath}`);
    }

    // 2. Create .worktrees directory if it doesn't exist
    const worktreesDir = `${repoPath}/.worktrees`;
    await this.exec(`mkdir -p ${worktreesDir}`);

    // 3. Create worktree
    const worktreePath = `${worktreesDir}/${taskId}`;
    const branchName = `agent/${taskId}`;
    await this.exec(`git worktree add .worktrees/${taskId} -b ${branchName}`, {
      cwd: repoPath,
    });

    // 4. Return WorktreeInfo
    return {
      taskId,
      worktreePath,
      branchName,
      repoPath,
    };
  }

  /**
   * Get diff between worktree and the branch it was created from
   */
  async getDiff(info: WorktreeInfo): Promise<string> {
    const result = await this.exec("git diff HEAD", {
      cwd: info.worktreePath,
    });
    return result.stdout;
  }

  /**
   * List files changed in worktree vs base
   */
  async getChangedFiles(info: WorktreeInfo): Promise<string[]> {
    const result = await this.exec("git diff HEAD --name-only", {
      cwd: info.worktreePath,
    });

    // Parse output into array, filter empty lines
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Remove worktree and delete branch
   * Does not throw if already cleaned up
   */
  async cleanup(info: WorktreeInfo): Promise<void> {
    // Remove worktree (ignore errors)
    await this.exec(`git worktree remove .worktrees/${info.taskId} --force`, {
      cwd: info.repoPath,
    }).catch(() => {
      // Ignore errors - worktree might already be removed
    });

    // Delete branch (ignore errors)
    await this.exec(`git branch -D ${info.branchName}`, {
      cwd: info.repoPath,
    }).catch(() => {
      // Ignore errors - branch might already be deleted
    });
  }

  /**
   * Check if a path is inside a git repo
   */
  async isGitRepo(path: string): Promise<boolean> {
    try {
      const result = await this.exec("git rev-parse --git-dir", { cwd: path });
      return result.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the default branch name for a repo (main or master)
   */
  async getDefaultBranch(repoPath: string): Promise<string> {
    // Try to get the default branch from the remote
    const symbolicRef = await this.exec("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: repoPath,
    });

    if (symbolicRef.code === 0) {
      // Parse output: refs/remotes/origin/main -> main
      const match = symbolicRef.stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
      if (match) {
        return match[1];
      }
    }

    // Fall back to checking for main or master branches locally
    const branchList = await this.exec("git branch --list main master", {
      cwd: repoPath,
    });

    if (branchList.code === 0) {
      const branches = branchList.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (branches.length > 0) {
        // Return the first branch found (main takes precedence since it's listed first)
        return branches[0];
      }
    }

    // Default to "main" if nothing found
    return "main";
  }

  /**
   * Merge a worktree's branch back into the target branch (usually main/master)
   */
  async mergeWorktree(info: WorktreeInfo, targetBranch?: string): Promise<MergeResult> {
    // Determine target branch
    const target = targetBranch ?? (await this.getDefaultBranch(info.repoPath));

    // Checkout target branch
    await this.exec(`git checkout ${target}`, {
      cwd: info.repoPath,
    });

    // Attempt merge
    const mergeResult = await this.exec(
      `git merge ${info.branchName} --no-ff -m "Merge ${info.branchName}: ${info.taskId}"`,
      {
        cwd: info.repoPath,
      }
    );

    if (mergeResult.code === 0) {
      // Merge succeeded - cleanup and return success
      await this.cleanup(info);
      return {
        success: true,
        mergedBranch: info.branchName,
      };
    }

    // Merge failed - get conflict files
    const diffResult = await this.exec("git diff --name-only --diff-filter=U", {
      cwd: info.repoPath,
    });

    const conflictFiles = diffResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Abort the merge to restore clean state
    await this.exec("git merge --abort", {
      cwd: info.repoPath,
    });

    return {
      success: false,
      mergedBranch: info.branchName,
      conflictFiles,
      error: "Merge conflicts detected",
    };
  }
}
