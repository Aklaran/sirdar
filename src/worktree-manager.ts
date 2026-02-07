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

    // Set committer name and email for automated rebase context
    const gitEnv = 'GIT_COMMITTER_NAME="Sirdar" GIT_COMMITTER_EMAIL="sirdar@annapurna"';

    // Attempt rebase: rebase agent branch onto target
    const rebaseResult = await this.exec(
      `${gitEnv} git rebase ${target} ${info.branchName}`,
      {
        cwd: info.repoPath,
      }
    );

    // If rebase failed, attempt conflict resolution
    if (rebaseResult.code !== 0) {
      // Try to resolve conflicts by accepting incoming (agent's) changes
      await this.exec("git checkout --theirs .", {
        cwd: info.repoPath,
      });

      await this.exec("git add -A", {
        cwd: info.repoPath,
      });

      // Continue the rebase after resolution
      const continueResult = await this.exec(
        `${gitEnv} git rebase --continue`,
        {
          cwd: info.repoPath,
        }
      );

      // If continue still fails, abort and return failure
      if (continueResult.code !== 0) {
        // Get conflict files before aborting
        const diffResult = await this.exec("git diff --name-only --diff-filter=U", {
          cwd: info.repoPath,
        });

        const conflictFiles = diffResult.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        // Abort the rebase to restore clean state
        await this.exec("git rebase --abort", {
          cwd: info.repoPath,
        });

        return {
          success: false,
          mergedBranch: info.branchName,
          conflictFiles,
          error: "Rebase conflicts could not be resolved",
        };
      }
    }

    // Rebase succeeded (either directly or after resolution)
    // Now checkout target branch
    await this.exec(`git checkout ${target}`, {
      cwd: info.repoPath,
    });

    // Fast-forward merge (should succeed since we rebased)
    await this.exec(`git merge ${info.branchName} --ff-only`, {
      cwd: info.repoPath,
    });

    // Cleanup and return success
    await this.cleanup(info);
    return {
      success: true,
      mergedBranch: info.branchName,
    };
  }
}
