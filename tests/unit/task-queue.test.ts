import { describe, it, expect } from "vitest";
import type { TaskDefinition } from "../../src/types";

// We'll implement this next
import { TaskQueue } from "../../src/task-queue";

describe("TaskQueue", () => {
  const createTask = (id: string): TaskDefinition => ({
    id,
    prompt: `Task ${id}`,
    tier: "light",
    description: `Task ${id} description`,
  });

  it("starts empty", () => {
    const queue = new TaskQueue();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it("enqueue adds task, size increases", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");
    const task2 = createTask("task-2");

    queue.enqueue(task1);
    expect(queue.size()).toBe(1);
    expect(queue.isEmpty()).toBe(false);

    queue.enqueue(task2);
    expect(queue.size()).toBe(2);
  });

  it("dequeue returns first task (FIFO order)", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");
    const task2 = createTask("task-2");
    const task3 = createTask("task-3");

    queue.enqueue(task1);
    queue.enqueue(task2);
    queue.enqueue(task3);

    expect(queue.dequeue()).toBe(task1);
    expect(queue.size()).toBe(2);
    expect(queue.dequeue()).toBe(task2);
    expect(queue.size()).toBe(1);
    expect(queue.dequeue()).toBe(task3);
    expect(queue.size()).toBe(0);
  });

  it("dequeue on empty returns undefined", () => {
    const queue = new TaskQueue();
    expect(queue.dequeue()).toBeUndefined();
  });

  it("peek returns first without removing", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");
    const task2 = createTask("task-2");

    queue.enqueue(task1);
    queue.enqueue(task2);

    expect(queue.peek()).toBe(task1);
    expect(queue.size()).toBe(2); // size unchanged

    expect(queue.peek()).toBe(task1); // still the same
    expect(queue.size()).toBe(2);
  });

  it("getAll returns copy (modifying it doesn't affect queue)", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");
    const task2 = createTask("task-2");

    queue.enqueue(task1);
    queue.enqueue(task2);

    const all = queue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toBe(task1);
    expect(all[1]).toBe(task2);

    // Modify the returned array
    all.push(createTask("task-3"));
    all.shift();

    // Original queue should be unchanged
    expect(queue.size()).toBe(2);
    expect(queue.peek()).toBe(task1);
  });

  it("remove removes by taskId, returns true", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");
    const task2 = createTask("task-2");
    const task3 = createTask("task-3");

    queue.enqueue(task1);
    queue.enqueue(task2);
    queue.enqueue(task3);

    const removed = queue.remove("task-2");
    expect(removed).toBe(true);
    expect(queue.size()).toBe(2);
    
    const all = queue.getAll();
    expect(all).toEqual([task1, task3]);
  });

  it("remove returns false for unknown taskId", () => {
    const queue = new TaskQueue();
    const task1 = createTask("task-1");

    queue.enqueue(task1);

    const removed = queue.remove("unknown-id");
    expect(removed).toBe(false);
    expect(queue.size()).toBe(1);
  });
});
