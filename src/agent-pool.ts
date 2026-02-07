/**
 * Agent Pool - Manages concurrent subagent execution with a max pool size
 */

import type { TaskDefinition, TaskResult, TaskTier } from "./types";
import type { BudgetTracker, BudgetWarning } from "./budget-tracker";
import type { LifecycleManager } from "./lifecycle-manager";
import { TaskQueue } from "./task-queue";

export type AgentStatus = "running" | "completed" | "failed" | "queued";

export interface AgentInfo {
  taskId: string;
  description: string;
  status: AgentStatus;
  tier: TaskTier;
  startTime?: number; // when execution started
  endTime?: number; // when execution finished
  result?: TaskResult; // populated on completion
}

export interface AgentPoolEvents {
  onComplete: (info: AgentInfo) => void;
  onFailed: (info: AgentInfo) => void;
  onWarning: (warning: BudgetWarning) => void;
}

export class AgentPool {
  private agents: Map<string, AgentInfo> = new Map();
  private taskQueue: TaskQueue = new TaskQueue();

  constructor(
    private maxConcurrent: number = 3,
    private lifecycleManager: LifecycleManager,
    private budgetTracker: BudgetTracker,
    private events: AgentPoolEvents
  ) {}

  /**
   * Submit a task. Runs immediately if pool has capacity, queues otherwise.
   * Returns the AgentInfo (status will be "running" or "queued")
   */
  async submit(task: TaskDefinition): Promise<AgentInfo> {
    // Create AgentInfo with initial status "queued"
    const info: AgentInfo = {
      taskId: task.id,
      description: task.description,
      status: "queued",
      tier: task.tier,
    };

    this.agents.set(task.id, info);

    // Check if we have capacity to run immediately
    if (this.runningCount() < this.maxConcurrent) {
      this.startTask(task, info);
    } else {
      // Pool is full, add to queue
      this.taskQueue.enqueue(task);
    }

    return info;
  }

  /**
   * Start executing a task (fire and forget)
   */
  private startTask(task: TaskDefinition, info: AgentInfo): void {
    // Update status to running
    info.status = "running";
    info.startTime = Date.now();

    // Start the task (fire and forget)
    this.lifecycleManager
      .runTask(task)
      .then((result) => {
        this.handleTaskComplete(task, info, result);
      })
      .catch((error) => {
        // If the promise rejects, create a failed result
        const result: TaskResult = {
          taskId: task.id,
          success: false,
          output: "",
          filesChanged: [],
          tokenUsage: { input: 0, output: 0 },
          costEstimate: 0,
          durationMs: Date.now() - (info.startTime || Date.now()),
          error: error instanceof Error ? error.message : String(error),
        };
        this.handleTaskComplete(task, info, result);
      });
  }

  /**
   * Handle task completion (success or failure)
   */
  private handleTaskComplete(
    task: TaskDefinition,
    info: AgentInfo,
    result: TaskResult
  ): void {
    // Update agent info
    info.endTime = Date.now();
    info.result = result;
    info.status = result.success ? "completed" : "failed";

    // Record in budget tracker
    const warning = this.budgetTracker.recordTask(result, task.tier);
    if (warning) {
      this.events.onWarning(warning);
    }

    // Call appropriate callback
    if (result.success) {
      this.events.onComplete(info);
    } else {
      this.events.onFailed(info);
    }

    // Check if there are queued tasks and start the next one
    this.startNextQueuedTask();
  }

  /**
   * Start the next queued task if there is one and we have capacity
   */
  private startNextQueuedTask(): void {
    if (this.hasCapacity() && !this.taskQueue.isEmpty()) {
      const nextTask = this.taskQueue.dequeue();
      if (nextTask) {
        const info = this.agents.get(nextTask.id);
        if (info) {
          this.startTask(nextTask, info);
        }
      }
    }
  }

  /**
   * Get info about a specific agent
   */
  getAgent(taskId: string): AgentInfo | undefined {
    return this.agents.get(taskId);
  }

  /**
   * Get all agents by status
   */
  getRunning(): AgentInfo[] {
    return Array.from(this.agents.values()).filter(
      (info) => info.status === "running"
    );
  }

  getQueued(): AgentInfo[] {
    return Array.from(this.agents.values()).filter(
      (info) => info.status === "queued"
    );
  }

  getCompleted(): AgentInfo[] {
    return Array.from(this.agents.values()).filter(
      (info) => info.status === "completed"
    );
  }

  getAll(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Current counts
   */
  runningCount(): number {
    return this.getRunning().length;
  }

  queuedCount(): number {
    return this.getQueued().length;
  }

  /**
   * Check if pool has capacity
   */
  hasCapacity(): boolean {
    return this.runningCount() < this.maxConcurrent;
  }
}
