# Orchestrator Extension for Pi

Multi-agent orchestration with budget tracking, memory logging, and git worktree isolation.

## Features

- 🤖 **Spawn Sub-agents** - Create focused sub-agents for specific tasks with automatic model selection
- 📊 **Budget Tracking** - Monitor token usage and costs per task tier with threshold warnings
- 📝 **Memory Logging** - Log task completions, reflections, patterns, and ideas
- 🌳 **Git Worktree Isolation** - Automatic worktree creation with rebase-based integration
- 🔔 **Auto-wake** - Parent agent automatically wakes when subagent completes or fails
- 🔄 **Concurrent Pool** - Run up to 3 agents concurrently with automatic queueing

## Installation

### Option 1: Local Extension

```bash
# Clone or copy to Pi extensions directory
mkdir -p ~/.pi/agent/extensions
cp -r ~/repos/orchestrator ~/.pi/agent/extensions/

# Restart Pi - extension auto-loads
```

### Option 2: Project-Local

```bash
# Copy to project
mkdir -p .pi/extensions
cp -r ~/repos/orchestrator .pi/extensions/

# Extension loads when running Pi in this directory
```

### Option 3: One-off Test

```bash
pi -e ~/repos/orchestrator/src/index.ts
```

## Usage

### Tools

The extension provides 6 tools that the LLM can call:

#### spawn_agent

Create and spawn a new sub-agent with specific capabilities and budget.

**Parameters:**
- `description` (required) - Human-readable task description
- `prompt` (required) - Full prompt to send to the subagent
- `tier` (required) - Task complexity tier (determines model and budget):
  - `trivial-simple` - Simple tasks, Haiku 3, thinking off ($0.05 soft / $0.15 hard)
  - `trivial-code` - Simple code tasks, Haiku 3.5, thinking off ($0.10 soft / $0.25 hard)
  - `light` - Light tasks, Sonnet 4.5, thinking minimal ($0.50 soft / $1.00 hard)
  - `standard` - Standard tasks, Sonnet 4.5, thinking low ($2.00 soft / $5.00 hard)
  - `complex` - Complex tasks, Sonnet 4.5, thinking high ($10.00 soft / $20.00 hard)
  - `deep` - Deep reasoning, Opus 4.5, thinking medium ($25.00 soft / $50.00 hard)
- `cwd` (optional) - Working directory (defaults to current directory)
- `useWorktree` (optional) - Create git worktree for isolation (default: true)

**Example:**
```
Please use the spawn_agent tool to fix the typo in README.md:
- description: Fix README typo
- prompt: Find and fix the typo in README.md where 'teh' should be 'the'
- tier: trivial-code
```

#### check_agents

List all active agents and their current status.

**Parameters:**
- `status` (optional) - Filter by status: `running`, `queued`, `completed`, `failed`, `all` (default: all)

**Example:**
```
Show me all running agents using the check_agents tool.
```

#### check_budget

View token usage and budget status for all completed tasks.

**Example:**
```
Use check_budget to show me the current spending across all task tiers.
```

#### log_reflection

Log a reflective note, pattern observation, or idea to the memory system.

**Parameters:**
- `content` (required) - The note content
- `type` (required) - Type of note: `reflection`, `pattern`, `idea`

**Example:**
```
Use log_reflection to record this pattern: "Complex refactoring tasks often need multiple iterations"
```

#### review_agent

Shows the git diff of a completed agent's worktree branch vs main.

**Parameters:**
- `taskId` (required) - Task ID of the agent to review

**Example:**
```
Use review_agent to show me what changed in task-1234567890-abcdef
```

#### merge_agent

Merges a completed agent's branch into main and cleans up the worktree.

**Parameters:**
- `taskId` (required) - Task ID of the agent to merge

**Example:**
```
Use merge_agent to integrate the changes from task-1234567890-abcdef into main
```

### Commands

#### /agents

Interactive command to list and manage active agents.

```
/agents
```

Shows a selection menu with all agents. Select an agent to view:
- Task ID and description
- Status and tier
- Duration
- Full result output or error

### Auto-wake Behavior

When a subagent completes or fails, the extension automatically wakes the parent agent by calling `pi.sendMessage()` with `triggerTurn: true` and `deliverAs: "followUp"`. This means the orchestrating agent processes results without requiring the user to send another message.

The parent agent receives a message containing:
- Task ID and description
- Result output (truncated to 2000 characters)
- Error details (for failed tasks)

This enables workflows where the parent can spawn multiple agents and react to their completion automatically.

## Architecture

### Component Overview

```
Extension Load
  ├─ BudgetTracker (persisted to ~/.pi/agent/extensions/orchestrator/data/)
  ├─ MemoryLogger (logs to ~/.openclaw/workspace/memory/)
  └─ Runtime component placeholders

session_start Event
  ├─ Load budget history
  ├─ Initialize LifecycleManager (with Pi SDK dependencies)
  ├─ Initialize WorktreeManager (with shell execution)
  └─ Initialize AgentPool (with event callbacks)
```

### Task Execution Flow

```
1. Worktree created (if in git repo)
2. Task submitted to AgentPool
3. If pool has capacity → Start immediately
4. If pool full → Queue task
5. LifecycleManager creates agent session
6. Agent executes with model and thinking level
7. Result logged to memory
8. Budget tracked and saved
9. User notified of completion
10. Parent agent auto-wakes with completion result
11. Next queued task starts (if any)
```

## Data Storage

### Budget History
- **Location:** `~/.pi/agent/extensions/orchestrator/data/budget-history.jsonl`
- **Format:** JSONL (append-only)
- **Schema:** `{ taskId, tier, costEstimate, timestamp }`

### Memory Logs
- **Location:** `~/.openclaw/workspace/memory/orchestrator-{YYYY-MM-DD}.jsonl`
- **Format:** JSONL (daily rotation)
- **Schema:** `{ timestamp, type, content, metadata? }`
- **Types:** `task-complete`, `task-failed`, `reflection`, `pattern`, `idea`

## Development

### Requirements

- Node.js 18+
- pnpm
- Pi coding agent

### Setup

```bash
cd ~/repos/orchestrator
pnpm install
```

### Testing

```bash
# Run all tests (174 tests across 11 test files)
pnpm test

# Run specific test file
pnpm test tests/unit/agent-pool.test.ts

# Watch mode
pnpm test --watch
```

### Project Structure

```
orchestrator/
├── src/
│   ├── index.ts              # Extension entry point (wiring)
│   ├── types.ts              # Shared type definitions
│   ├── model-selector.ts     # Tier → Model mapping (pure)
│   ├── lifecycle-manager.ts  # Subagent session management
│   ├── agent-pool.ts         # Concurrent execution pool
│   ├── task-queue.ts         # FIFO task queue
│   ├── budget-tracker.ts     # Cost tracking and thresholds
│   ├── approval.ts           # User approval UI
│   ├── worktree-manager.ts   # Git worktree isolation
│   └── memory-logger.ts      # Reflective logging
├── tests/
│   ├── unit/                 # Component unit tests
│   ├── integration/          # Integration tests
│   └── mocks/                # Test mocks
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Configuration

### Pool Size

Default: 3 concurrent agents

To change, edit `src/index.ts`:
```typescript
agentPool = new AgentPool(
  5, // maxConcurrent (change this)
  lifecycleManager,
  budgetTracker,
  { /* callbacks */ }
);
```

### Budget Thresholds

Edit `src/model-selector.ts` in `getBudgetThresholds()`:
```typescript
case "standard":
  return {
    softWarning: 2.00,  // Adjust these
    hardFlag: 5.00,
  };
```

### Data Directories

Edit `src/index.ts` to change storage locations:
```typescript
const dataDir = join(homedir(), ".pi", "agent", "extensions", "orchestrator", "data");
const logDir = join(homedir(), ".openclaw", "workspace", "memory");
```

## Troubleshooting

### Agent pool not initialized
**Cause:** Extension loaded but session hasn't started yet  
**Solution:** Wait for session_start event or restart Pi

### Worktree creation failed
**Cause:** Directory is not a git repository or git is not installed  
**Solution:** The task will continue with the original cwd (worktrees are optional)

### Budget warnings not showing
**Cause:** Tasks completing successfully but costEstimate is 0  
**Solution:** Currently token usage tracking is a placeholder - will be implemented when Pi SDK provides usage data

## Examples

### Example 1: Spawn a simple task

```
User: Please spawn an agent to add a hello world function to utils.ts