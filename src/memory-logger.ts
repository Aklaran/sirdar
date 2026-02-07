import * as fs from "fs/promises";
import * as path from "path";
import type { TaskResult, TaskTier } from "./types";

export interface MemoryEntry {
  timestamp: number;
  type: "task-complete" | "task-failed" | "reflection" | "pattern" | "idea";
  content: string;
  metadata?: {
    taskId?: string;
    tier?: TaskTier;
    model?: string;
    costEstimate?: number;
    durationMs?: number;
  };
}

export class MemoryLogger {
  constructor(private logDir: string) {}

  /**
   * Get today's log file path in format: <logDir>/orchestrator-<YYYY-MM-DD>.jsonl
   */
  getTodayLogPath(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    return path.join(this.logDir, `orchestrator-${dateStr}.jsonl`);
  }

  /**
   * Format a TaskResult into a concise one-liner summary
   */
  formatTaskSummary(result: TaskResult, tier: TaskTier, model: string): string {
    const status = result.success ? "[COMPLETE]" : "[FAILED]";
    const durationSec = (result.durationMs / 1000).toFixed(1);
    const cost = `$${result.costEstimate.toFixed(2)}`;
    const description = result.output;
    
    let summary = `${status} ${result.taskId} (${tier}/${model}) — "${description}" — ${durationSec}s, ${cost}`;
    
    if (!result.success && result.error) {
      summary += ` — Error: ${result.error}`;
    }
    
    return summary;
  }

  /**
   * Log a completed task (success or failure)
   */
  async logTaskCompletion(result: TaskResult, tier: TaskTier, model: string): Promise<void> {
    const type = result.success ? "task-complete" : "task-failed";
    const content = this.formatTaskSummary(result, tier, model);
    
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      type,
      content,
      metadata: {
        taskId: result.taskId,
        tier,
        model,
        costEstimate: result.costEstimate,
        durationMs: result.durationMs,
      },
    };
    
    await this.appendEntry(entry);
  }

  /**
   * Log a reflective note from the orchestrator
   */
  async logReflection(content: string): Promise<void> {
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      type: "reflection",
      content,
    };
    
    await this.appendEntry(entry);
  }

  /**
   * Log a pattern observation
   */
  async logPattern(content: string): Promise<void> {
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      type: "pattern",
      content,
    };
    
    await this.appendEntry(entry);
  }

  /**
   * Log an idea
   */
  async logIdea(content: string): Promise<void> {
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      type: "idea",
      content,
    };
    
    await this.appendEntry(entry);
  }

  /**
   * Read all entries from today's log file
   * Returns empty array if file doesn't exist
   */
  async readTodayEntries(): Promise<MemoryEntry[]> {
    const logPath = this.getTodayLogPath();
    
    try {
      const content = await fs.readFile(logPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line));
    } catch (error: any) {
      // File doesn't exist yet - return empty array
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Append an entry to today's log file (creates file if needed)
   */
  private async appendEntry(entry: MemoryEntry): Promise<void> {
    const logPath = this.getTodayLogPath();
    const jsonLine = JSON.stringify(entry) + "\n";
    
    // Ensure directory exists
    await fs.mkdir(this.logDir, { recursive: true });
    
    // Append to file (creates if doesn't exist)
    await fs.appendFile(logPath, jsonLine, "utf-8");
  }
}
