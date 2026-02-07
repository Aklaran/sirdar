import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";

export interface AgentMetadata {
  taskId: string;
  description: string;
  tier: string;
  branchName: string;
  repoPath: string;
  status: "completed" | "failed";
  completedAt: number; // Date.now()
}

export interface SerializedAgentMetadata {
  version: 1;
  agents: AgentMetadata[];
}

export class AgentMetadataStore {
  private agents: Map<string, AgentMetadata> = new Map();

  constructor(private persistPath: string) {}

  /**
   * Add agent metadata to the store
   */
  add(meta: AgentMetadata): void {
    this.agents.set(meta.taskId, meta);
    this.save();
  }

  /**
   * Get all agents sorted by completedAt descending (most recent first)
   */
  getAll(): AgentMetadata[] {
    const agents = Array.from(this.agents.values());
    return agents.sort((a, b) => b.completedAt - a.completedAt);
  }

  /**
   * Get only completed agents sorted by completedAt descending
   */
  getCompleted(): AgentMetadata[] {
    return this.getAll().filter(agent => agent.status === "completed");
  }

  /**
   * Get specific agent by taskId
   */
  get(taskId: string): AgentMetadata | undefined {
    return this.agents.get(taskId);
  }

  /**
   * Save to disk synchronously
   */
  save(): void {
    try {
      // Create directory if needed
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Serialize data
      const data: SerializedAgentMetadata = {
        version: 1,
        agents: Array.from(this.agents.values()),
      };

      // Write to disk
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      // Never crash - just silently fail
      // In production, could log to stderr
    }
  }

  /**
   * Load from disk
   */
  load(): void {
    try {
      if (!existsSync(this.persistPath)) {
        // File doesn't exist yet - start with empty store
        return;
      }

      const content = readFileSync(this.persistPath, "utf-8");
      const data = JSON.parse(content) as SerializedAgentMetadata;

      // Validate version
      if (data.version !== 1) {
        // Unsupported version - start with empty store
        return;
      }

      // Populate map
      this.agents.clear();
      for (const agent of data.agents) {
        this.agents.set(agent.taskId, agent);
      }
    } catch (error) {
      // Corrupt file or parse error - start with empty store
      this.agents.clear();
    }
  }
}
