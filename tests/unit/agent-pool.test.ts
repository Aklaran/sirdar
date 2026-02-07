import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskDefinition, TaskResult } from "../../src/types";
import type { BudgetWarning } from "../../src/budget-tracker";

// We'll implement this next
import { AgentPool } from "../../src/agent-pool";

// Deferred promise pattern for tests
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("AgentPool", () => {
  let deferreds: Map<string, Deferred<TaskResult>>;
  let mockLifecycle: any;
  let mockBudget: any;
  let onComplete: any;
  let onFailed: any;
  let onWarning: any;

  const createTask = (id: string): TaskDefinition => ({
    id,
    prompt: `Task ${id}`,
    tier: "light",
    description: `Task ${id} description`,
  });

  const createResult = (taskId: string, success = true): TaskResult => ({
    taskId,
    success,
    output: `Output for ${taskId}`,
    filesChanged: [],
    tokenUsage: { input: 100, output: 50 },
    costEstimate: 0.05,
    durationMs: 1000,
    error: success ? undefined : "Test error",
  });

  beforeEach(() => {
    deferreds = new Map();
    
    mockLifecycle = {
      runTask: vi.fn((task: TaskDefinition) => {
        const d = createDeferred<TaskResult>();
        deferreds.set(task.id, d);
        return d.promise;
      }),
    };

    mockBudget = {
      recordTask: vi.fn(() => null),
    };

    onComplete = vi.fn();
    onFailed = vi.fn();
    onWarning = vi.fn();
  });

  it("submit returns AgentInfo with status 'running' when pool has capacity", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    const info = await pool.submit(task);

    expect(info.taskId).toBe("task-1");
    expect(info.status).toBe("running");
    expect(info.description).toBe("Task task-1 description");
    expect(info.tier).toBe("light");
    expect(info.startTime).toBeDefined();
    expect(info.endTime).toBeUndefined();
  });

  it("submit returns AgentInfo with status 'queued' when pool is full", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    // Fill the pool
    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));

    // This one should be queued
    const info = await pool.submit(createTask("task-3"));

    expect(info.taskId).toBe("task-3");
    expect(info.status).toBe("queued");
    expect(info.startTime).toBeUndefined();
  });

  it("submit starts task immediately when pool has capacity (lifecycleManager.runTask called)", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    expect(mockLifecycle.runTask).toHaveBeenCalledWith(task);
    expect(mockLifecycle.runTask).toHaveBeenCalledTimes(1);
  });

  it("submit does NOT call runTask when pool is full", async () => {
    const pool = new AgentPool(1, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    // Fill the pool
    await pool.submit(createTask("task-1"));
    
    // Reset the mock to check subsequent calls
    mockLifecycle.runTask.mockClear();

    // This should be queued, not started
    await pool.submit(createTask("task-2"));

    expect(mockLifecycle.runTask).not.toHaveBeenCalled();
  });

  it("getRunning returns only running agents", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));
    await pool.submit(createTask("task-3")); // queued

    const running = pool.getRunning();
    expect(running).toHaveLength(2);
    expect(running.map(a => a.taskId).sort()).toEqual(["task-1", "task-2"]);
  });

  it("getQueued returns only queued agents", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));
    await pool.submit(createTask("task-3")); // queued
    await pool.submit(createTask("task-4")); // queued

    const queued = pool.getQueued();
    expect(queued).toHaveLength(2);
    expect(queued.map(a => a.taskId)).toEqual(["task-3", "task-4"]);
  });

  it("hasCapacity returns true when under limit", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    expect(pool.hasCapacity()).toBe(true);

    await pool.submit(createTask("task-1"));
    expect(pool.hasCapacity()).toBe(true);

    await pool.submit(createTask("task-2"));
    expect(pool.hasCapacity()).toBe(true);
  });

  it("hasCapacity returns false when at limit", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));

    expect(pool.hasCapacity()).toBe(false);
  });

  it("on task completion, status changes to 'completed' and onComplete is called", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    // Resolve the task
    const result = createResult("task-1");
    deferreds.get("task-1")!.resolve(result);

    // Wait for microtasks to flush
    await new Promise(r => setTimeout(r, 0));

    const info = pool.getAgent("task-1");
    expect(info?.status).toBe("completed");
    expect(info?.endTime).toBeDefined();
    expect(info?.result).toEqual(result);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      taskId: "task-1",
      status: "completed",
    }));
  });

  it("on task failure, status changes to 'failed' and onFailed is called", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    // Reject the task
    const result = createResult("task-1", false);
    deferreds.get("task-1")!.resolve(result);

    // Wait for microtasks to flush
    await new Promise(r => setTimeout(r, 0));

    const info = pool.getAgent("task-1");
    expect(info?.status).toBe("failed");
    expect(info?.endTime).toBeDefined();
    expect(info?.result).toEqual(result);
    expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({
      taskId: "task-1",
      status: "failed",
    }));
  });

  it("on task completion, queued task is automatically started", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    // Fill the pool
    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));

    // Queue a third task
    await pool.submit(createTask("task-3"));

    expect(pool.getQueued()).toHaveLength(1);
    
    // Reset mock to track subsequent calls
    mockLifecycle.runTask.mockClear();

    // Complete task-1
    deferreds.get("task-1")!.resolve(createResult("task-1"));

    // Wait for microtasks to flush
    await new Promise(r => setTimeout(r, 0));

    // task-3 should now be running
    expect(pool.getQueued()).toHaveLength(0);
    expect(pool.getRunning()).toHaveLength(2);
    expect(mockLifecycle.runTask).toHaveBeenCalledWith(expect.objectContaining({
      id: "task-3",
    }));
  });

  it("on task completion, budgetTracker.recordTask is called", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    const result = createResult("task-1");
    deferreds.get("task-1")!.resolve(result);

    // Wait for microtasks to flush
    await new Promise(r => setTimeout(r, 0));

    expect(mockBudget.recordTask).toHaveBeenCalledWith(result, "light");
  });

  it("on budget warning, onWarning callback is called", async () => {
    const warning: BudgetWarning = {
      type: "soft",
      tier: "light",
      taskId: "task-1",
      cost: 0.15,
      threshold: 0.10,
      message: "Budget warning",
    };

    mockBudget.recordTask = vi.fn(() => warning);

    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    const result = createResult("task-1");
    deferreds.get("task-1")!.resolve(result);

    // Wait for microtasks to flush
    await new Promise(r => setTimeout(r, 0));

    expect(onWarning).toHaveBeenCalledWith(warning);
  });

  it("getAgent returns correct info by taskId", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));

    const info1 = pool.getAgent("task-1");
    expect(info1?.taskId).toBe("task-1");
    expect(info1?.status).toBe("running");

    const info2 = pool.getAgent("task-2");
    expect(info2?.taskId).toBe("task-2");
    expect(info2?.status).toBe("running");

    const info3 = pool.getAgent("unknown");
    expect(info3).toBeUndefined();
  });

  it("getAll returns all agents regardless of status", async () => {
    const pool = new AgentPool(2, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1")); // running
    await pool.submit(createTask("task-2")); // running
    await pool.submit(createTask("task-3")); // queued

    // Complete task-1
    deferreds.get("task-1")!.resolve(createResult("task-1"));
    await new Promise(r => setTimeout(r, 0));

    const all = pool.getAll();
    expect(all).toHaveLength(3);
    
    const statuses = all.map(a => ({ id: a.taskId, status: a.status }));
    expect(statuses).toContainEqual({ id: "task-1", status: "completed" });
    expect(statuses).toContainEqual({ id: "task-2", status: "running" });
    expect(statuses).toContainEqual({ id: "task-3", status: "running" }); // was queued, now running
  });

  it("completing a task sets endTime and result", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    const task = createTask("task-1");
    await pool.submit(task);

    const infoBefore = pool.getAgent("task-1");
    expect(infoBefore?.endTime).toBeUndefined();
    expect(infoBefore?.result).toBeUndefined();

    const result = createResult("task-1");
    deferreds.get("task-1")!.resolve(result);
    await new Promise(r => setTimeout(r, 0));

    const infoAfter = pool.getAgent("task-1");
    expect(infoAfter?.endTime).toBeDefined();
    expect(infoAfter?.result).toEqual(result);
  });

  it("pool respects maxConcurrent (submitting 4 tasks with max 3 → 3 running, 1 queued)", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));
    await pool.submit(createTask("task-3"));
    await pool.submit(createTask("task-4"));

    expect(pool.runningCount()).toBe(3);
    expect(pool.queuedCount()).toBe(1);
    expect(pool.getRunning().map(a => a.taskId).sort()).toEqual(["task-1", "task-2", "task-3"]);
    expect(pool.getQueued().map(a => a.taskId)).toEqual(["task-4"]);
  });

  it("getCompleted returns only completed agents", async () => {
    const pool = new AgentPool(3, mockLifecycle, mockBudget, {
      onComplete,
      onFailed,
      onWarning,
    });

    await pool.submit(createTask("task-1"));
    await pool.submit(createTask("task-2"));
    await pool.submit(createTask("task-3"));

    // Complete task-1
    deferreds.get("task-1")!.resolve(createResult("task-1"));
    await new Promise(r => setTimeout(r, 0));

    // Fail task-2 (still returns success: false result)
    deferreds.get("task-2")!.resolve(createResult("task-2", false));
    await new Promise(r => setTimeout(r, 0));

    const completed = pool.getCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0].taskId).toBe("task-1");
  });
});
