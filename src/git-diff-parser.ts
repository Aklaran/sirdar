/**
 * Parse git diff --stat output to extract file counts and changes
 * 
 * Expected format (last line):
 * " 3 files changed, 45 insertions(+), 12 deletions(-)"
 * " 1 file changed, 5 insertions(+)"
 * " 2 files changed, 10 deletions(-)"
 */
export interface GitDiffStats {
  fileCount: number;
  insertions: number;
  deletions: number;
}

export function parseGitDiffStat(statOutput: string): GitDiffStats {
  const defaultStats: GitDiffStats = {
    fileCount: 0,
    insertions: 0,
    deletions: 0,
  };

  if (!statOutput || statOutput.trim().length === 0) {
    return defaultStats;
  }

  // Get the last non-empty line (summary line)
  const lines = statOutput.trim().split("\n");
  const summaryLine = lines[lines.length - 1];

  if (!summaryLine) {
    return defaultStats;
  }

  // Parse file count
  const fileMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
  const fileCount = fileMatch ? parseInt(fileMatch[1], 10) : 0;

  // Parse insertions
  const insertMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
  const insertions = insertMatch ? parseInt(insertMatch[1], 10) : 0;

  // Parse deletions
  const deleteMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);
  const deletions = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;

  return {
    fileCount,
    insertions,
    deletions,
  };
}
