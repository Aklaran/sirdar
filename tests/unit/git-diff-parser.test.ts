import { describe, it, expect } from "vitest";
import { parseGitDiffStat } from "../../src/git-diff-parser.js";

describe("parseGitDiffStat", () => {
  it("parses multiple files with insertions and deletions", () => {
    const output = ` src/index.ts           | 25 +++++++++++++++++++------
 src/types.ts           | 10 +++++-----
 tests/unit/test.ts     | 30 ++++++++++++++++++++++++++++++
 3 files changed, 45 insertions(+), 12 deletions(-)`;

    const result = parseGitDiffStat(output);

    expect(result).toEqual({
      fileCount: 3,
      insertions: 45,
      deletions: 12,
    });
  });

  it("parses single file with insertions only", () => {
    const output = ` src/new-file.ts | 5 +++++
 1 file changed, 5 insertions(+)`;

    const result = parseGitDiffStat(output);

    expect(result).toEqual({
      fileCount: 1,
      insertions: 5,
      deletions: 0,
    });
  });

  it("parses multiple files with deletions only", () => {
    const output = ` src/old-file.ts | 10 ----------
 src/another.ts  | 5 -----
 2 files changed, 15 deletions(-)`;

    const result = parseGitDiffStat(output);

    expect(result).toEqual({
      fileCount: 2,
      insertions: 0,
      deletions: 15,
    });
  });

  it("handles empty output", () => {
    const result = parseGitDiffStat("");

    expect(result).toEqual({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
    });
  });

  it("handles whitespace-only output", () => {
    const result = parseGitDiffStat("   \n  \n  ");

    expect(result).toEqual({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
    });
  });

  it("handles malformed output gracefully", () => {
    const result = parseGitDiffStat("not a valid git diff stat");

    expect(result).toEqual({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
    });
  });

  it("parses single file (singular form)", () => {
    const output = ` README.md | 1 +
 1 file changed, 1 insertion(+)`;

    const result = parseGitDiffStat(output);

    expect(result).toEqual({
      fileCount: 1,
      insertions: 1,
      deletions: 0,
    });
  });

  it("parses single deletion (singular form)", () => {
    const output = ` README.md | 1 -
 1 file changed, 1 deletion(-)`;

    const result = parseGitDiffStat(output);

    expect(result).toEqual({
      fileCount: 1,
      insertions: 0,
      deletions: 1,
    });
  });
});
