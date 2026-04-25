---
name: orchestrator
description: Guidelines for orchestrating subagents. Load BEFORE any call to spawn_agent, check_agents, or check_budget. Also load when planning to delegate any work to a subagent, regardless of domain (code, calendar, research, etc).
---

# Orchestrator Skill

Load this when using `spawn_agent`, `check_agents`, or managing subagent work.

## Beads Integration

Before planning work in a repo, check for `.beads/` directory. If present:
1. Run `bd ready` to find unblocked tasks — these are the candidates for subagent work.
2. When spawning agents, reference the bead ID in the prompt (e.g., "Implement bd-a3f8: ...").
3. Include in subagent prompts: "When done, run `bd close <id>` for the task you completed."
4. After agent completion, verify the bead was closed. If not, close it manually.
5. For new tasks, **always use `bd-create`** (the wrapper script at `~/bin/bd-create`), never raw `bd create`. The wrapper enforces descriptions answering WHY/WHAT/WHERE/HOW. Thin descriptions make beads useless for subagents later.

If no `.beads/` directory exists, fall back to TASKS.md or prompt-based task planning as before.

## Prompting Subagents

- **Never hardcode absolute paths** in task prompts. Say "the current working directory" or "this repo." The system prompt tells the agent its cwd.
- **Always require TDD.** Say "Write failing tests FIRST, then implement."
- **Commit early, commit often.** Don't just require a final commit — tell agents to commit each working feature immediately. "We'll commit everything together later" = lost work on timeout. Say "DO NOT revert your changes" explicitly — agents sometimes undo their own passing work.
- **Be explicit about scope boundaries.** Agents with medium+ thinking will over-deliver (write docs, add examples, refactor neighbors). Say "Do NOT modify files outside of X" and "Do NOT add features beyond what's specified."
- **Include `pnpm test` at the end.** Agents should verify all tests pass before committing.
- **Don't load Annapurna identity** in subagents. They get surgical prompts only.
- **Frontend tasks: load screenshot skill.** Read `~/.pi/agent/skills/screenshot/SKILL.md` for the subagent prompt snippet. Always include screenshot verification for any task that touches UI. Without it, agents ship code that compiles but doesn't look right.
- **When agents parse output from other extensions,** tell them to log the raw value first, then write the parser. Mocked tests encode format assumptions that may be wrong — the real format at runtime can differ (e.g., `[object Object]` instead of a string, emoji prefixes in notify messages).

## Pre-Spawn Checklist

Before calling `spawn_agent`, run through this mentally:

1. **Pull the bead description** — if the bead has no description, investigate the actual scope yourself first. Don't guess.
2. **Check for complexity signals** in the task:
   - Touches third-party/upstream API types? → **standard minimum** (type surfaces are iceberg problems)
   - Multi-file changes? → **standard minimum**
   - Needs to understand existing architecture? → **standard**
   - "Simple" but touches async/callbacks/event systems? → **light minimum**, probably standard
   - Config-only, single file, clear spec? → **trivial-code**
3. **Check recent reflections** for similar past tasks:
   ```bash
   grep -h '"type":"pattern"' ~/.himal/memory/*.jsonl 2>/dev/null | tail -10
   ```
4. **Write the bead description** if it's missing — future you will thank present you.

## Tiering Heuristics

Complexity is about **context and judgment needed**, not line count.

| Tier | Use when | Anti-pattern |
|------|----------|-------------|
| trivial-simple | Grep, file moves, simple text edits | |
| trivial-code | Config changes, one-file edits with clear spec | "It sounds simple" but touches async/callbacks/APIs |
| light | New module with clear interface, TDD | |
| standard | Multi-file changes, needs to understand architecture | |
| complex | Cross-cutting concerns, refactors, design decisions | |
| deep | Architectural spikes, novel problem-solving | Everything — most tasks are standard or below |

**Learned the hard way:** "fix tsconfig" looked trivial-code but cascaded into 31 type errors across multiple files requiring understanding of an upstream API's type surface. Always investigate before tiering.

## Polling Policy

- **Don't poll.** The status bar shows running count. `onComplete`/`onFailed` fire notifications.
- Each `check_agents` call costs ~150 context tokens for zero new information.
- Only check agents when Aklaran asks or when you need the result to continue work.

## Worktree Isolation

- Worktrees give each agent a separate working directory sharing the same .git database.
- The agent's cwd is set to the worktree path. The system prompt reinforces this.
- **Don't give absolute paths to the main repo in prompts** — agents may cd out of the worktree and commit to main instead of the agent branch.
- After completion, results live on the agent's branch (`agent/<taskId>`).
- To merge: use `WorktreeManager.mergeWorktree()` or manually inspect the branch.
- **Add `.worktrees/**` to vitest exclude** in repos using worktree isolation, or test counts silently inflate (e.g., 196 → 1372 "tests" from duplicate suites in old worktrees).

## Timeout Guidance

Default is 10 minutes. **This is too short for most real work.** Override with `timeoutMs`:
- **standard tier with TDD:** 20 min (1200000ms)
- **complex tier:** 30 min (1800000ms)
- Task involves Docker builds: 20-30 min
- Task involves `pnpm install` from scratch: 15 min
- **deep tier:** 30+ min

A timed-out agent with good commits isn't wasted — check the worktree. But giving enough time upfront is better than recovering partial work.

**TODO:** `spawn_agent` tool doesn't expose timeoutMs yet. Add it as an optional parameter. Until then, tell agents to commit early and often so work isn't lost on timeout.

## Recovering Timed-Out Agents

Agents that timeout often have uncommitted work in their worktree. Check:
1. `cd <repo>/.worktrees/<taskId> && git status`
2. If changes exist, commit them manually
3. Review and merge as normal

## Reload Warning

`/reload` wipes the in-memory agent pool. All running agent handles are lost.
Work survives in worktrees but we lose result tracking.
**Never suggest /reload while agents are running.**

Extension dependency changes (transitive ESM imports) also don't take effect on `/reload` — only a full Pi restart. Node's native ESM module cache is per-process and persists across reloads.

## After Agent Completion

1. Check the worktree branch for commits: `git log agent/<taskId>`
2. Review the diff: `git diff main..agent/<taskId>`
3. If good, merge to main via WorktreeManager or manually
4. Clean up: `git worktree remove` + `git branch -D`
