# Orchestrator Extension - Integration Summary

## Overview

The orchestrator extension is now fully wired and integrated. All components work together to provide multi-agent orchestration with budget tracking, memory logging, and worktree isolation.

## Architecture

### Component Initialization

**Load Time (Extension Load)**
- `BudgetTracker` - Initialized with `~/.pi/agent/extensions/orchestrator/data`
- `MemoryLogger` - Initialized with `~/.openclaw/workspace/memory`
- Mutable references created for runtime-dependent components

**Runtime (session_start event)**
- `LifecycleManager` - Initialized with Pi SDK dependencies (`createAgentSession`, `authStorage`, `modelRegistry`)
- `WorktreeManager` - Initialized with `pi.exec` wrapper
- `AgentPool` - Initialized with lifecycle manager, budget tracker, and event callbacks

### Registered Tools

The extension registers 6 tools:

#### 1. spawn_agent
**Parameters:**
- `description` (string) - Human-readable task description
- `prompt` (string) - Full prompt for the subagent
- `tier` (enum) - Task complexity: `trivial-simple`, `trivial-code`, `light`, `standard`, `complex`, `deep`
- `cwd` (optional string) - Working directory
- `useWorktree` (optional boolean) - Whether to use git worktree isolation (default: true)

**Execution Flow:**
1. Generate unique task ID (`task-{timestamp}-{random}`)
2. Build `TaskDefinition` from parameters
3. Get model selection via `selectModel(tier)`
4. If in git repo and `useWorktree=true`, create worktree for isolation (using rebase-based integration)
5. Submit task to `AgentPool`
6. Return confirmation with task ID, status, model, and thinking level

#### 2. check_agents
**Parameters:**
- `status` (optional enum) - Filter: `running`, `queued`, `completed`, `failed`, `all` (default: all)

**Returns:**
- List of agents matching filter
- For each agent: task ID, status, description, tier, duration
- For completed/failed: result summary or error

#### 3. check_budget
**Parameters:**
- (empty object)

**Returns:**
- Formatted budget report via `budgetTracker.formatReport()`
- Shows per-tier: task count, total cost, average cost, thresholds, violations

#### 4. log_reflection
**Parameters:**
- `content` (string) - The note content
- `type` (enum) - Note type: `reflection`, `pattern`, `idea`

**Execution:**
- Calls appropriate `MemoryLogger` method based on type
- Returns confirmation message

#### 5. review_agent
**Parameters:**
- `taskId` (string, required) - Task ID of the agent to review

**Execution:**
- Looks up agent in pool
- Verifies agent is completed or failed
- Retrieves worktree info for the task
- Runs `git diff main..{branchName}` to show changes
- Returns diff summary and full diff output

#### 6. merge_agent
**Parameters:**
- `taskId` (string, required) - Task ID of the agent to merge

**Execution:**
- Looks up agent in pool
- Verifies agent is completed
- Retrieves worktree info for the task
- Calls `WorktreeManager.mergeWorktree()` to rebase and merge
- Cleans up worktree on success
- Returns success message or conflict details

### Registered Commands

#### /agents
**Description:** List and manage active agents

**Execution:**
1. Shows notification if no agents exist
2. If agents exist, shows interactive selection list with status emojis
3. On selection, displays full agent details including:
   - Task ID, description, status, tier
   - Duration (running or completed time)
   - Result output or error message
   - "still running..." or "queued" status if not complete

### Event Handlers

#### session_start
**Actions:**
1. Load budget history from disk (`budgetTracker.load()`)
2. Initialize `LifecycleManager` with runtime SDK dependencies
3. Initialize `WorktreeManager` with shell execution wrapper
4. Initialize `AgentPool` with event callbacks:
   - **onComplete**: Log to memory, notify user, auto-wake parent agent with result, save budget
   - **onFailed**: Log to memory, notify user with error, auto-wake parent agent with error, save budget
   - **onWarning**: Notify user of budget warnings

**Auto-wake behavior:**
When a subagent completes or fails, the extension calls `pi.sendMessage()` with `triggerTurn: true` and `deliverAs: "followUp"` to automatically wake the parent agent with the completion result. This enables the orchestrating agent to process results without requiring user input.

## Data Flow

### Task Spawning Flow
```
User calls spawn_agent
  ↓
Generate task ID
  ↓
Build TaskDefinition
  ↓
Select model (based on tier)
  ↓
Create worktree (if git repo + useWorktree=true, using rebase-based integration)
  ↓
Submit to AgentPool
  ↓
AgentPool checks capacity
  ↓
If capacity available: Start immediately (LifecycleManager.runTask)
  ↓
If no capacity: Queue task (TaskQueue)
  ↓
Return confirmation to user
```

### Task Execution Flow
```
LifecycleManager.runTask(task)
  ↓
Select model via selectModel(tier)
  ↓
Create agent session with model and thinking level
  ↓
Subscribe to session events (capture output)
  ↓
Start task with timeout
  ↓
Wait for completion or timeout
  ↓
Build TaskResult
  ↓
Return to AgentPool
  ↓
AgentPool records in BudgetTracker
  ↓
AgentPool calls event callbacks (onComplete/onFailed)
  ↓
MemoryLogger logs completion
  ↓
BudgetTracker saves to disk
  ↓
User notification via ctx.ui
  ↓
Parent agent auto-wakes with result (pi.sendMessage with triggerTurn: true)
  ↓
If queued tasks exist: Start next task
```

### Budget Tracking Flow
```
Task completes
  ↓
TaskResult with costEstimate
  ↓
BudgetTracker.recordTask(result, tier)
  ↓
Check against tier thresholds
  ↓
If threshold exceeded: Generate BudgetWarning
  ↓
Return warning to AgentPool
  ↓
AgentPool calls onWarning callback
  ↓
User notified via ctx.ui
  ↓
BudgetTracker.save() - Append to history file
```

## File Structure

```
~/repos/orchestrator/
├── src/
│   ├── index.ts              # Extension entry point (wiring)
│   ├── types.ts              # Shared type definitions
│   ├── model-selector.ts     # Tier → Model mapping
│   ├── lifecycle-manager.ts  # Subagent session management
│   ├── agent-pool.ts         # Concurrent execution pool
│   ├── task-queue.ts         # FIFO task queue
│   ├── budget-tracker.ts     # Cost tracking and thresholds
│   ├── approval.ts           # User approval UI
│   ├── worktree-manager.ts   # Git worktree isolation
│   └── memory-logger.ts      # Reflective logging
├── tests/
│   ├── unit/                 # Unit tests for each component
│   ├── integration/          # Integration tests
│   │   └── extension-wiring.test.ts
│   └── mocks/
│       └── mock-pi.ts        # Mock ExtensionAPI
└── INTEGRATION.md            # This file
```

## Data Directories

### Budget History
- **Location:** `~/.pi/agent/extensions/orchestrator/data/budget-history.jsonl`
- **Format:** JSONL (one JSON object per line)
- **Schema:** `{ taskId, tier, costEstimate, timestamp }`
- **Persistence:** Append-only, loaded on session_start

### Memory Logs
- **Location:** `~/.openclaw/workspace/memory/orchestrator-{YYYY-MM-DD}.jsonl`
- **Format:** JSONL (one JSON object per line)
- **Schema:** `{ timestamp, type, content, metadata? }`
- **Types:** `task-complete`, `task-failed`, `reflection`, `pattern`, `idea`
- **Rotation:** Daily (new file per day)

## Testing

### Unit Tests (162 tests)
- `model-selector.test.ts` - Model selection logic
- `budget-tracker.test.ts` - Budget tracking and thresholds
- `approval.test.ts` - Approval UI formatting
- `task-queue.test.ts` - Queue operations
- `agent-pool.test.ts` - Pool management and queueing
- `lifecycle-manager.test.ts` - Session lifecycle
- `worktree-manager.test.ts` - Git worktree operations with rebase-based integration
- `memory-logger.test.ts` - Log formatting and storage
- `agent-callbacks.test.ts` - Agent event callbacks
- `extension.test.ts` - Extension integration

### Integration Tests (12 tests)
- Tool registration (6 tools with correct parameters)
- Command registration (/agents)
- Event handler registration (session_start)

### Total: 174 passing tests ✅

## Usage Examples

### Spawn a trivial task
```typescript
{
  "name": "spawn_agent",
  "parameters": {
    "description": "Fix typo in README",
    "prompt": "Find and fix the typo in README.md where 'teh' should be 'the'",
    "tier": "trivial-code"
  }
}
```

### Spawn with custom working directory
```typescript
{
  "name": "spawn_agent",
  "parameters": {
    "description": "Refactor auth module",
    "prompt": "Refactor the authentication module to use async/await instead of callbacks",
    "tier": "standard",
    "cwd": "/path/to/project",
    "useWorktree": true
  }
}
```

### Check running agents
```typescript
{
  "name": "check_agents",
  "parameters": {
    "status": "running"
  }
}
```

### Log a pattern observation
```typescript
{
  "name": "log_reflection",
  "parameters": {
    "content": "Complex tasks often require multiple iterations to get right",
    "type": "pattern"
  }
}
```

## Next Steps

The extension is production-ready with:
- ✅ Full component integration
- ✅ Comprehensive test coverage (174 tests)
- ✅ Budget tracking and warnings
- ✅ Memory logging for reflection
- ✅ Git worktree isolation with rebase-based integration
- ✅ Auto-wake on agent completion
- ✅ Concurrent agent pool with queueing
- ✅ Worktree review and merge tools

Potential enhancements:
- Add persistence for agent state (restart recovery)
- Add agent cancellation tool
- Add metrics dashboard command
- Add configurable pool size
- Add task dependencies/workflows
