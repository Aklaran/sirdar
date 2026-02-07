/**
 * Simple FIFO queue for pending tasks
 */

import type { TaskDefinition } from "./types";

export class TaskQueue {
  private queue: TaskDefinition[] = [];

  /**
   * Add a task to the end of the queue
   */
  enqueue(task: TaskDefinition): void {
    this.queue.push(task);
  }

  /**
   * Remove and return the first task in the queue
   */
  dequeue(): TaskDefinition | undefined {
    return this.queue.shift();
  }

  /**
   * Return the first task without removing it
   */
  peek(): TaskDefinition | undefined {
    return this.queue[0];
  }

  /**
   * Get the current size of the queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get a copy of all tasks in the queue
   */
  getAll(): TaskDefinition[] {
    return [...this.queue];
  }

  /**
   * Remove a task by its ID
   * @returns true if the task was found and removed, false otherwise
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((task) => task.id === taskId);
    if (index === -1) {
      return false;
    }
    this.queue.splice(index, 1);
    return true;
  }
}
