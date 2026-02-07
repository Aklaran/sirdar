/**
 * Budget tracking for orchestrator tasks
 */

import { readFile, writeFile, appendFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { TaskResult, TaskTier } from "./types";
import { getBudgetThresholds } from "./model-selector";

export interface BudgetRecord {
  taskId: string;
  tier: TaskTier;
  costEstimate: number;
  timestamp: number;
}

export interface BudgetWarning {
  type: "soft" | "hard";
  tier: TaskTier;
  taskId: string;
  cost: number;
  threshold: number;
  message: string;
}

export interface TierSummary {
  tier: TaskTier;
  totalCost: number;
  taskCount: number;
  averageCost: number;
  softWarning: number;
  hardFlag: number;
  overSoftCount: number;  // how many tasks exceeded soft warning
}

export class BudgetTracker {
  private records: BudgetRecord[] = [];
  private historyFile: string;
  private lastSavedIndex: number = 0;

  constructor(private dataDir: string) {
    this.historyFile = join(dataDir, "budget-history.jsonl");
  }

  /**
   * Record a completed task's cost and return any warning
   */
  recordTask(result: TaskResult, tier: TaskTier): BudgetWarning | null {
    // Create a budget record
    const record: BudgetRecord = {
      taskId: result.taskId,
      tier,
      costEstimate: result.costEstimate,
      timestamp: Date.now(),
    };

    // Add to in-memory records
    this.records.push(record);

    // Check against thresholds
    const thresholds = getBudgetThresholds(tier);
    let warning: BudgetWarning | null = null;

    if (result.costEstimate > thresholds.hardFlag) {
      warning = {
        type: "hard",
        tier,
        taskId: result.taskId,
        cost: result.costEstimate,
        threshold: thresholds.hardFlag,
        message: `Task ${result.taskId} exceeded hard budget limit for ${tier} tier ($${result.costEstimate.toFixed(2)} > $${thresholds.hardFlag.toFixed(2)})`,
      };
    } else if (result.costEstimate > thresholds.softWarning) {
      warning = {
        type: "soft",
        tier,
        taskId: result.taskId,
        cost: result.costEstimate,
        threshold: thresholds.softWarning,
        message: `Task ${result.taskId} exceeded soft budget warning for ${tier} tier ($${result.costEstimate.toFixed(2)} > $${thresholds.softWarning.toFixed(2)})`,
      };
    }

    return warning;
  }

  /**
   * Get summary for a specific tier
   */
  getTierSummary(tier: TaskTier): TierSummary {
    const tierRecords = this.records.filter(r => r.tier === tier);
    const thresholds = getBudgetThresholds(tier);

    if (tierRecords.length === 0) {
      return {
        tier,
        totalCost: 0,
        taskCount: 0,
        averageCost: 0,
        softWarning: thresholds.softWarning,
        hardFlag: thresholds.hardFlag,
        overSoftCount: 0,
      };
    }

    const totalCost = tierRecords.reduce((sum, r) => sum + r.costEstimate, 0);
    const overSoftCount = tierRecords.filter(r => r.costEstimate > thresholds.softWarning).length;

    return {
      tier,
      totalCost,
      taskCount: tierRecords.length,
      averageCost: totalCost / tierRecords.length,
      softWarning: thresholds.softWarning,
      hardFlag: thresholds.hardFlag,
      overSoftCount,
    };
  }

  /**
   * Get summary for all tiers that have recorded tasks
   */
  getAllSummaries(): TierSummary[] {
    const tiers: TaskTier[] = ["trivial-simple", "trivial-code", "light", "standard", "complex", "deep"];
    return tiers
      .map(tier => this.getTierSummary(tier))
      .filter(summary => summary.taskCount > 0);
  }

  /**
   * Format a human-readable budget report
   */
  formatReport(): string {
    const summaries = this.getAllSummaries();

    if (summaries.length === 0) {
      return "Budget Report\n─────────────\nNo tasks recorded yet.";
    }

    let report = "Budget Report\n─────────────\n";

    for (const summary of summaries) {
      const tierLabel = `Tier: ${summary.tier}`;
      const tasksLabel = `Tasks: ${summary.taskCount}`;
      const totalLabel = `Total: $${summary.totalCost.toFixed(2)}`;
      const avgLabel = `Avg: $${summary.averageCost.toFixed(2)}`;
      const limitLabel = `Limit: $${summary.softWarning.toFixed(2)}`;
      const overLabel = `Over: ${summary.overSoftCount}`;

      report += `${tierLabel} | ${tasksLabel} | ${totalLabel} | ${avgLabel} | ${limitLabel} | ${overLabel}\n`;
    }

    return report;
  }

  /**
   * Load history from disk
   */
  async load(): Promise<void> {
    if (!existsSync(this.historyFile)) {
      this.records = [];
      this.lastSavedIndex = 0;
      return;
    }

    try {
      const content = await readFile(this.historyFile, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.length > 0);
      
      this.records = lines.map(line => JSON.parse(line) as BudgetRecord);
      this.lastSavedIndex = this.records.length;
    } catch (error) {
      console.error("Failed to load budget history:", error);
      this.records = [];
      this.lastSavedIndex = 0;
    }
  }

  /**
   * Save history to disk (append-only JSONL)
   */
  async save(): Promise<void> {
    // Only save records that haven't been saved yet
    const newRecords = this.records.slice(this.lastSavedIndex);
    
    if (newRecords.length === 0) {
      return;
    }

    const lines = newRecords.map(record => JSON.stringify(record)).join("\n") + "\n";

    try {
      // Ensure directory exists
      const { mkdirSync } = await import("fs");
      mkdirSync(this.dataDir, { recursive: true });

      if (existsSync(this.historyFile)) {
        await appendFile(this.historyFile, lines, "utf-8");
      } else {
        await writeFile(this.historyFile, lines, "utf-8");
      }
      
      this.lastSavedIndex = this.records.length;
    } catch (error) {
      console.error("Failed to save budget history:", error);
      throw error;
    }
  }
}
