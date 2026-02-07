/**
 * Approval Manager - Present task plans to the user for approval before spawning
 */

import { selectModel, getBudgetThresholds } from "./model-selector";
import type { TaskDefinition, ModelSelection } from "./types";

export interface ApprovalUI {
  confirm(title: string, message: string): Promise<boolean>;
  notify(message: string, level: "info" | "warning" | "error"): void;
}

/**
 * Manages user approval flow for task spawning
 */
export class ApprovalManager {
  constructor(private ui: ApprovalUI) {}

  /**
   * Present task plan to user, return true if approved
   * 
   * @param task - The task definition to request approval for
   * @returns true if user approved, false otherwise
   */
  async requestApproval(task: TaskDefinition): Promise<boolean> {
    // 1. Get model selection based on tier
    const selection = selectModel(task.tier);

    // 2. Format approval message
    const message = this.formatApprovalMessage(task, selection);

    // 3. Request user confirmation
    const approved = await this.ui.confirm("🤖 Spawn Subagent?", message);

    // 4. Notify based on response
    if (approved) {
      this.ui.notify("Spawning agent...", "info");
    } else {
      this.ui.notify("Task cancelled.", "info");
    }

    // 5. Return the boolean result
    return approved;
  }

  /**
   * Format task details into a readable approval message
   * 
   * @param task - The task definition
   * @param selection - The model selection for this task
   * @returns Formatted message string
   */
  formatApprovalMessage(task: TaskDefinition, selection: ModelSelection): string {
    // Get budget thresholds for the tier
    const budget = getBudgetThresholds(task.tier);

    // Format directory (custom or default)
    const directory = task.cwd || "default";

    // Build the message
    const lines = [
      `Task: ${task.description}`,
      `Model: ${selection.modelId} (thinking: ${selection.thinkingLevel})`,
      `Budget: ${task.tier} tier (soft limit: $${budget.softWarning.toFixed(2)})`,
      `Directory: ${directory}`,
    ];

    return lines.join("\n");
  }
}
