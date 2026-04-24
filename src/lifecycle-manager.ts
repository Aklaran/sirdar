/**
 * LifecycleManager - Spawns and monitors subagent sessions
 */

import { getModel } from "@mariozechner/pi-ai";
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  SettingsManager,
  getAgentDir,
  type AuthStorage,
  type ModelRegistry,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import { selectModel } from "./model-selector";
import type { TaskDefinition, TaskResult } from "./types";

// Injectable createSession type for testing
type CreateSessionFunction = typeof createAgentSession;

interface LifecycleManagerDeps {
  createSession: CreateSessionFunction;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
}

function buildSystemPrompt(cwd: string): string {
  return `You are a focused coding agent. Complete the following task efficiently.

Your working directory is: ${cwd}
IMPORTANT: Stay in this directory. Use relative paths. Do NOT cd to other directories unless the task explicitly requires it.

Do not ask questions — make reasonable decisions and proceed.
If you encounter an error, try to fix it. If you cannot, report what went wrong.
When finished, commit your changes with the commit message specified in the task.`;
}

const DEFAULT_TIMEOUT_MS = 600000; // 10 minutes
const MAX_OUTPUT_LENGTH = 5000;

/**
 * Manages the lifecycle of a single subagent session
 */
export class LifecycleManager {
  private createSession: CreateSessionFunction;
  private authStorage?: AuthStorage;
  private modelRegistry?: ModelRegistry;

  constructor(deps: LifecycleManagerDeps) {
    this.createSession = deps.createSession;
    this.authStorage = deps.authStorage;
    this.modelRegistry = deps.modelRegistry;
  }

  /**
   * Spawn a subagent, wait for completion, return result
   */
  async runTask(task: TaskDefinition, onOutput?: (delta: string) => void): Promise<TaskResult> {
    const startTime = Date.now();
    let outputText = "";
    let session: any = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let modelSelection: ReturnType<typeof selectModel> | undefined;

    try {
      // 1. Select model based on tier + strategy
      modelSelection = selectModel(task.tier, {
        strategy: task.modelStrategy,
        modelRegistry: this.modelRegistry as any,
      });

      // 2. Get the Model object
      const model =
        this.modelRegistry?.find?.(modelSelection.provider, modelSelection.modelId) ??
        getModel(modelSelection.provider as any, modelSelection.modelId as any);
      if (!model) {
        throw new Error(
          `Model not found: ${modelSelection.provider}/${modelSelection.modelId}`
        );
      }

      // 3. Create ResourceLoader with custom system prompt
      const effectiveCwd = task.cwd || process.cwd();
      const agentDir = getAgentDir();
      const settingsManager = SettingsManager.create(effectiveCwd, agentDir);
      const loader = new DefaultResourceLoader({
        cwd: effectiveCwd,
        agentDir,
        settingsManager,
        systemPromptOverride: () => buildSystemPrompt(effectiveCwd),
      });
      await loader.reload();

      // 4. Create session
      const { session: agentSession } = await this.createSession({
        model,
        thinkingLevel: modelSelection.thinkingLevel,
        sessionManager: SessionManager.inMemory(effectiveCwd),
        cwd: effectiveCwd,
        authStorage: this.authStorage,
        modelRegistry: this.modelRegistry,
        settingsManager,
        resourceLoader: loader,
      });

      session = agentSession;

      // 5. Subscribe to session events to capture output
      session.subscribe((event: AgentSessionEvent) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent?.type === "text_delta"
        ) {
          const delta = event.assistantMessageEvent.delta;
          outputText += delta;
          onOutput?.(delta);
        }
      });

      // 6. Set up timeout
      const timeoutMs = task.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          session?.abort();
          reject(new Error(`Task timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // 7. Call session.prompt (blocks until agent completes)
      await Promise.race([
        session.prompt(task.prompt),
        timeoutPromise,
      ]);

      // Clear timeout if completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 8. Truncate output if needed (keep last N chars, not first N)
      if (outputText.length > MAX_OUTPUT_LENGTH) {
        outputText = outputText.substring(outputText.length - MAX_OUTPUT_LENGTH);
      }

      const durationMs = Date.now() - startTime;

      // 9. Build and return TaskResult
      return {
        taskId: task.id,
        success: true,
        output: outputText,
        filesChanged: [],
        tokenUsage: { input: 0, output: 0 },
        costEstimate: 0,
        durationMs,
        modelProvider: modelSelection.provider,
        modelId: modelSelection.modelId,
        thinkingLevel: modelSelection.thinkingLevel,
      };
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Truncate output if needed (keep last N chars, not first N)
      if (outputText.length > MAX_OUTPUT_LENGTH) {
        outputText = outputText.substring(outputText.length - MAX_OUTPUT_LENGTH);
      }

      return {
        taskId: task.id,
        success: false,
        output: outputText,
        filesChanged: [],
        tokenUsage: { input: 0, output: 0 },
        costEstimate: 0,
        durationMs,
        error: errorMessage,
        modelProvider: modelSelection?.provider,
        modelId: modelSelection?.modelId,
        thinkingLevel: modelSelection?.thinkingLevel,
      };
    } finally {
      // 10. Always dispose of the session
      if (session) {
        session.dispose();
      }
    }
  }
}
