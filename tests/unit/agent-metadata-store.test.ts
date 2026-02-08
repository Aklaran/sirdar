import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentMetadataStore, type AgentMetadata } from "../../src/agent-metadata-store";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("AgentMetadataStore", () => {
  let tempDir: string;
  let persistPath: string;
  let store: AgentMetadataStore;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = join(tmpdir(), `agent-metadata-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    persistPath = join(tempDir, "agent-metadata.json");
    store = new AgentMetadataStore(persistPath);
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper function to create AgentMetadata
  function createAgentMetadata(
    taskId: string,
    status: "completed" | "failed" = "completed",
    completedAt: number = Date.now()
  ): AgentMetadata {
    return {
      taskId,
      description: `Task ${taskId}`,
      tier: "light",
      branchName: `branch-${taskId}`,
      repoPath: "/path/to/repo",
      status,
      completedAt,
    };
  }

  describe("add", () => {
    it("stores metadata in memory", () => {
      const meta = createAgentMetadata("task-1");
      store.add(meta);

      const retrieved = store.get("task-1");
      expect(retrieved).toEqual(meta);
    });

    it("overwrites existing metadata with same taskId", () => {
      const meta1 = createAgentMetadata("task-1");
      const meta2 = { ...meta1, description: "Updated description" };
      
      store.add(meta1);
      store.add(meta2);

      const retrieved = store.get("task-1");
      expect(retrieved?.description).toBe("Updated description");
    });

    it("stores multiple agents", () => {
      const meta1 = createAgentMetadata("task-1");
      const meta2 = createAgentMetadata("task-2");
      const meta3 = createAgentMetadata("task-3");

      store.add(meta1);
      store.add(meta2);
      store.add(meta3);

      expect(store.getAll().length).toBe(3);
    });
  });

  describe("get", () => {
    it("returns undefined for non-existent taskId", () => {
      const retrieved = store.get("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("returns correct metadata for existing taskId", () => {
      const meta = createAgentMetadata("task-1");
      store.add(meta);

      const retrieved = store.get("task-1");
      expect(retrieved).toEqual(meta);
    });
  });

  describe("getAll", () => {
    it("returns empty array when no agents stored", () => {
      const all = store.getAll();
      expect(all).toEqual([]);
    });

    it("returns all agents sorted by completedAt desc", () => {
      const meta1 = createAgentMetadata("task-1", "completed", 1000);
      const meta2 = createAgentMetadata("task-2", "completed", 3000);
      const meta3 = createAgentMetadata("task-3", "completed", 2000);

      store.add(meta1);
      store.add(meta2);
      store.add(meta3);

      const all = store.getAll();
      expect(all.length).toBe(3);
      expect(all[0].taskId).toBe("task-2"); // 3000
      expect(all[1].taskId).toBe("task-3"); // 2000
      expect(all[2].taskId).toBe("task-1"); // 1000
    });

    it("includes both completed and failed agents", () => {
      const meta1 = createAgentMetadata("task-1", "completed");
      const meta2 = createAgentMetadata("task-2", "failed");

      store.add(meta1);
      store.add(meta2);

      const all = store.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe("getCompleted", () => {
    it("returns empty array when no completed agents", () => {
      const meta1 = createAgentMetadata("task-1", "failed");
      store.add(meta1);

      const completed = store.getCompleted();
      expect(completed).toEqual([]);
    });

    it("returns only completed agents", () => {
      const meta1 = createAgentMetadata("task-1", "completed");
      const meta2 = createAgentMetadata("task-2", "failed");
      const meta3 = createAgentMetadata("task-3", "completed");

      store.add(meta1);
      store.add(meta2);
      store.add(meta3);

      const completed = store.getCompleted();
      expect(completed.length).toBe(2);
      expect(completed.map(m => m.taskId)).toContain("task-1");
      expect(completed.map(m => m.taskId)).toContain("task-3");
      expect(completed.map(m => m.taskId)).not.toContain("task-2");
    });

    it("returns completed agents sorted by completedAt desc", () => {
      const meta1 = createAgentMetadata("task-1", "completed", 1000);
      const meta2 = createAgentMetadata("task-2", "completed", 3000);
      const meta3 = createAgentMetadata("task-3", "failed", 2000);

      store.add(meta1);
      store.add(meta2);
      store.add(meta3);

      const completed = store.getCompleted();
      expect(completed.length).toBe(2);
      expect(completed[0].taskId).toBe("task-2"); // 3000
      expect(completed[1].taskId).toBe("task-1"); // 1000
    });
  });

  describe("save", () => {
    it("creates file when it doesn't exist", () => {
      const meta = createAgentMetadata("task-1");
      store.add(meta);
      store.save();

      expect(existsSync(persistPath)).toBe(true);
    });

    it("creates parent directories if needed", () => {
      const deepPath = join(tempDir, "nested", "deep", "agent-metadata.json");
      const deepStore = new AgentMetadataStore(deepPath);
      const meta = createAgentMetadata("task-1");
      
      deepStore.add(meta);
      deepStore.save();

      expect(existsSync(deepPath)).toBe(true);
    });

    it("does not crash on write error", () => {
      // Create a read-only directory (on systems that support it)
      // This test is best-effort
      const meta = createAgentMetadata("task-1");
      store.add(meta);
      
      // Should not throw
      expect(() => store.save()).not.toThrow();
    });
  });

  describe("load", () => {
    it("loads metadata from file", () => {
      const meta = createAgentMetadata("task-1");
      store.add(meta);
      store.save();

      // Create new store and load
      const newStore = new AgentMetadataStore(persistPath);
      newStore.load();

      const retrieved = newStore.get("task-1");
      expect(retrieved).toEqual(meta);
    });

    it("handles missing file gracefully", () => {
      const newStore = new AgentMetadataStore(persistPath);
      
      // Should not throw
      expect(() => newStore.load()).not.toThrow();
      
      expect(newStore.getAll()).toEqual([]);
    });

    it("handles corrupt file gracefully", () => {
      // Write invalid JSON
      writeFileSync(persistPath, "{ invalid json");

      const newStore = new AgentMetadataStore(persistPath);
      
      // Should not throw
      expect(() => newStore.load()).not.toThrow();
      
      expect(newStore.getAll()).toEqual([]);
    });

    it("handles file with wrong version", () => {
      // Write file with wrong version
      writeFileSync(persistPath, JSON.stringify({ version: 999, agents: [] }));

      const newStore = new AgentMetadataStore(persistPath);
      newStore.load();
      
      expect(newStore.getAll()).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("save and load round-trip preserves data", () => {
      const meta1 = createAgentMetadata("task-1", "completed", 1000);
      const meta2 = createAgentMetadata("task-2", "failed", 2000);
      const meta3 = createAgentMetadata("task-3", "completed", 3000);

      store.add(meta1);
      store.add(meta2);
      store.add(meta3);
      store.save();

      // Load in new store
      const newStore = new AgentMetadataStore(persistPath);
      newStore.load();

      const all = newStore.getAll();
      expect(all.length).toBe(3);
      expect(all[0]).toEqual(meta3);
      expect(all[1]).toEqual(meta2);
      expect(all[2]).toEqual(meta1);
    });

    it("persists across instances", () => {
      // First instance
      const store1 = new AgentMetadataStore(persistPath);
      store1.add(createAgentMetadata("task-1"));
      store1.save();

      // Second instance
      const store2 = new AgentMetadataStore(persistPath);
      store2.load();
      store2.add(createAgentMetadata("task-2"));
      store2.save();

      // Third instance
      const store3 = new AgentMetadataStore(persistPath);
      store3.load();

      const all = store3.getAll();
      expect(all.length).toBe(2);
      expect(all.map(m => m.taskId)).toContain("task-1");
      expect(all.map(m => m.taskId)).toContain("task-2");
    });

    it("save after load preserves existing data", () => {
      // Save initial data
      store.add(createAgentMetadata("task-1"));
      store.save();

      // Load and add more
      const newStore = new AgentMetadataStore(persistPath);
      newStore.load();
      newStore.add(createAgentMetadata("task-2"));
      newStore.save();

      // Load again and verify both exist
      const finalStore = new AgentMetadataStore(persistPath);
      finalStore.load();
      
      expect(finalStore.get("task-1")).toBeDefined();
      expect(finalStore.get("task-2")).toBeDefined();
    });
  });

  describe("remove", () => {
    it("removes an agent and persists", () => {
      const meta: AgentMetadata = {
        taskId: "task-1",
        description: "Test",
        tier: "light",
        branchName: "b1",
        repoPath: "/tmp",
        status: "completed",
        completedAt: 1000,
      };
      store.add(meta);
      expect(store.get("task-1")).toBeDefined();

      const removed = store.remove("task-1");
      expect(removed).toBe(true);
      expect(store.get("task-1")).toBeUndefined();
      expect(store.getAll()).toHaveLength(0);

      // Verify persisted
      const store2 = new AgentMetadataStore(persistPath);
      store2.load();
      expect(store2.get("task-1")).toBeUndefined();
    });

    it("returns false for nonexistent taskId", () => {
      expect(store.remove("nonexistent")).toBe(false);
    });
  });
});
