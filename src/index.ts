import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { join } from "path";
import { homedir } from "os";

import { BudgetTracker } from "./budget-tracker.js";
import { MemoryLogger } from "./memory-logger.js";
import { LifecycleManager } from "./lifecycle-manager.js";
import { AgentPool, type AgentInfo } from "./agent-pool.js";
import { ApprovalManager, type ApprovalUI } from "./approval.js";
import { WorktreeManager } from "./worktree-manager.js";
import { selectModel } from "./model-selector.js";
import type { TaskDefinition, TaskTier } from "./types.js";

/**
 * Orchestrator Extension for Pi
 * 
 * Multi-agent orchestration and budget management:
 * - spawn_agent: Create and manage sub-agents
 * - check_agents: View active agents and their status
 * - check_budget: Monitor token usage and costs
 * - log_reflection: Log reflections, patterns, and ideas
 * - /agents: Command to list and manage agents
 */

export default function orchestrator(pi: ExtensionAPI) {
  // ============================================================================
  // 1. Initialize components that don't need runtime dependencies
  // ============================================================================
  
  const dataDir = join(homedir(), ".pi", "agent", "extensions", "orchestrator", "data");
  const logDir = join(homedir(), ".openclaw", "workspace", "memory");

  /**
   * Build a status text for agent pool
   */
  function getAgentStatusText(pool: AgentPool): string | undefined {
    const running = pool.runningCount();
    const queued = pool.queuedCount();
    if (running === 0 && queued === 0) return undefined;
    let text = `🤖 ${running} running`;
    if (queued > 0) text += `, ${queued} queued`;
    return text;
  }

  /**
   * Update the agent output widget
   */
  function updateAgentWidget() {
    if (!uiContext?.ui) return;

    if (!currentAgentId || outputBuffer.length === 0) {
      uiContext.ui.setWidget("agent-output", undefined);
      return;
    }

    // Check if there are other running agents
    let headerSuffix = "";
    if (agentPool) {
      const runningCount = agentPool.runningCount();
      if (runningCount > 1) {
        headerSuffix = ` (${runningCount - 1} others running)`;
      }
    }

    const header = `🤖 agent/${currentAgentId} [${currentAgentTier}] — ${currentAgentDescription}${headerSuffix}`;
    const maxLineLength = 100;
    
    // Truncate long lines
    const truncatedLines = outputBuffer.map(line => 
      line.length > maxLineLength ? line.substring(0, maxLineLength - 3) + "..." : line
    );

    const widgetLines = [header, "", ...truncatedLines];
    uiContext.ui.setWidget("agent-output", widgetLines);
  }

  /**
   * Clear the agent output widget
   */
  function clearAgentWidget() {
    if (!uiContext?.ui) return;
    currentAgentId = null;
    currentAgentTier = null;
    currentAgentDescription = null;
    outputBuffer = [];
    uiContext.ui.setWidget("agent-output", undefined);
  }
  
  const budgetTracker = new BudgetTracker(dataDir);
  const memoryLogger = new MemoryLogger(logDir);
  
  // Mutable references for components that need runtime deps
  let lifecycleManager: LifecycleManager | null = null;
  let agentPool: AgentPool | null = null;
  let worktreeManager: WorktreeManager | null = null;
  let uiContext: { ui: any } | null = null;

  // Widget state for live output
  let currentAgentId: string | null = null;
  let currentAgentTier: TaskTier | null = null;
  let currentAgentDescription: string | null = null;
  let outputBuffer: string[] = [];

  // ============================================================================
  // 2. Register spawn_agent tool
  // ============================================================================
  
  pi.registerTool({
    name: "spawn_agent",
    label: "Spawn Agent",
    description: "Create and spawn a new sub-agent with specific capabilities and budget",
    parameters: Type.Object({
      description: Type.String({ description: "Human-readable description of the task" }),
      prompt: Type.String({ description: "Full prompt to send to the subagent" }),
      tier: StringEnum(
        ["trivial-simple", "trivial-code", "light", "standard", "complex", "deep"] as const,
        { description: "Task complexity tier — determines model and budget" }
      ),
      cwd: Type.Optional(Type.String({ 
        description: "Working directory. If in a git repo, a worktree will be created for isolation." 
      })),
      useWorktree: Type.Optional(Type.Boolean({ 
        description: "Whether to use git worktree isolation. Default true for code tasks." 
      })),
      timeoutMs: Type.Optional(Type.Number({ description: "Timeout in seconds (optional, no default timeout)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Generate task ID
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Build TaskDefinition
      const task: TaskDefinition = {
        id: taskId,
        prompt: params.prompt,
        tier: params.tier as TaskTier,
        description: params.description,
        cwd: params.cwd,
        timeoutMs: params.timeoutMs ? params.timeoutMs * 1000 : undefined,
      };
      
      // Get model selection for approval message
      const modelSelection = selectModel(params.tier as TaskTier);
      
      // Create ApprovalManager with ctx.ui
      const approvalUI: ApprovalUI = {
        confirm: ctx.ui.confirm.bind(ctx.ui),
        notify: ctx.ui.notify.bind(ctx.ui),
      };
      const approvalManager = new ApprovalManager(approvalUI);
      
      // Request approval
      onUpdate({ content: [{ type: "text", text: `🔍 Requesting approval for ${params.tier} task...` }] });
      const approved = await approvalManager.requestApproval(task);
      if (!approved) {
        return {
          content: [{ type: "text", text: "Task cancelled by user" }],
        };
      }
      onUpdate({ content: [{ type: "text", text: `✅ Approved — model: ${modelSelection.modelId}, thinking: ${modelSelection.thinkingLevel}` }] });
      
      // Check if we should use worktree
      const shouldUseWorktree = params.useWorktree ?? true;
      if (shouldUseWorktree && params.cwd && worktreeManager) {
        try {
          const isRepo = await worktreeManager.isGitRepo(params.cwd);
          if (isRepo) {
            onUpdate({ content: [{ type: "text", text: `📁 Creating git worktree for isolation...` }] });
            const worktreeInfo = await worktreeManager.createWorktree(taskId, params.cwd);
            task.cwd = worktreeInfo.worktreePath;
            onUpdate({ content: [{ type: "text", text: `📁 Worktree ready: ${worktreeInfo.worktreePath}` }] });
          }
        } catch (error) {
          onUpdate({ content: [{ type: "text", text: `⚠️ Worktree creation failed, using original cwd` }] });
          console.error("Worktree creation failed:", error);
        }
      }
      
      // Submit to AgentPool
      if (!agentPool) {
        return {
          content: [{ type: "text", text: "Agent pool not initialized" }],
          isError: true,
        };
      }
      
      onUpdate({ content: [{ type: "text", text: `🚀 Submitting to agent pool...` }] });
      const agentInfo = await agentPool.submit(task);
      
      // Update status if UI is available
      if (uiContext?.ui) {
        const status = getAgentStatusText(agentPool);
        uiContext.ui.setStatus("orchestrator", status);
      }
      
      // Return message
      const message = `Agent spawned: ${taskId} — ${params.description} (model: ${modelSelection.modelId}, thinking: ${modelSelection.thinkingLevel})`;
      return {
        content: [{
          type: "text",
          text: `${message}\nStatus: ${agentInfo.status}`,
        }],
      };
    },
  });

  // ============================================================================
  // 3. Register check_agents tool
  // ============================================================================
  
  pi.registerTool({
    name: "check_agents",
    label: "Check Agents",
    description: "List all active agents and their current status",
    parameters: Type.Object({
      status: Type.Optional(StringEnum(
        ["running", "queued", "completed", "failed", "all"] as const,
        { description: "Filter by status. Default: all" }
      )),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (!agentPool) {
        return {
          content: [{ type: "text", text: "Agent pool not initialized" }],
        };
      }
      
      const statusFilter = params.status || "all";
      
      // Get agents based on filter
      let agents: AgentInfo[];
      if (statusFilter === "all") {
        agents = agentPool.getAll();
      } else if (statusFilter === "running") {
        agents = agentPool.getRunning();
      } else if (statusFilter === "queued") {
        agents = agentPool.getQueued();
      } else if (statusFilter === "completed") {
        agents = agentPool.getCompleted();
      } else {
        // "failed"
        agents = agentPool.getAll().filter(a => a.status === "failed");
      }
      
      if (agents.length === 0) {
        return {
          content: [{ type: "text", text: `No ${statusFilter === "all" ? "" : statusFilter + " "}agents` }],
        };
      }
      
      // Format agents list
      let text = `Agents (${statusFilter}):\n\n`;
      for (const agent of agents) {
        const duration = agent.startTime && agent.endTime
          ? `${((agent.endTime - agent.startTime) / 1000).toFixed(1)}s`
          : agent.startTime
          ? `${((Date.now() - agent.startTime) / 1000).toFixed(1)}s (running)`
          : "not started";
        
        text += `• ${agent.taskId} [${agent.status}] — ${agent.description}\n`;
        text += `  Tier: ${agent.tier}, Duration: ${duration}\n`;
        
        if (agent.result) {
          if (agent.result.success) {
            const summary = agent.result.output.substring(0, 100);
            text += `  Result: ${summary}${agent.result.output.length > 100 ? "..." : ""}\n`;
          } else {
            text += `  Error: ${agent.result.error || "Unknown error"}\n`;
          }
        }
        
        text += "\n";
      }
      
      return {
        content: [{ type: "text", text }],
      };
    },
  });

  // ============================================================================
  // 4. Register check_budget tool
  // ============================================================================
  
  pi.registerTool({
    name: "check_budget",
    label: "Check Budget",
    description: "View token usage and budget status for agents",
    parameters: Type.Object({}),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const report = budgetTracker.formatReport();
      return {
        content: [{ type: "text", text: report }],
      };
    },
  });

  // ============================================================================
  // 5. Register log_reflection tool
  // ============================================================================
  
  pi.registerTool({
    name: "log_reflection",
    label: "Log Reflection",
    description: "Log a reflective note, pattern observation, or idea",
    parameters: Type.Object({
      content: Type.String({ description: "Reflective note, pattern observation, or idea" }),
      type: StringEnum(
        ["reflection", "pattern", "idea"] as const,
        { description: "Type of note" }
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const { content, type } = params;
      
      if (type === "reflection") {
        await memoryLogger.logReflection(content);
      } else if (type === "pattern") {
        await memoryLogger.logPattern(content);
      } else {
        await memoryLogger.logIdea(content);
      }
      
      return {
        content: [{ type: "text", text: `Logged ${type}: ${content}` }],
      };
    },
  });

  // ============================================================================
  // 6. Register /agents command
  // ============================================================================
  
  pi.registerCommand("agents", {
    description: "List and manage active agents",
    handler: async (args, ctx) => {
      if (!agentPool) {
        ctx.ui.notify("Agent pool not initialized", "error");
        return;
      }
      
      const agents = agentPool.getAll();
      
      if (agents.length === 0) {
        ctx.ui.notify(
          "🤖 Agent Orchestrator\n\n" +
          "No active agents.\n\n" +
          "Use spawn_agent tool to create new agents.",
          "info"
        );
        return;
      }
      
      // Create selection list with agent summaries
      const options = agents.map(agent => {
        const statusEmoji = 
          agent.status === "running" ? "🔄" :
          agent.status === "queued" ? "⏳" :
          agent.status === "completed" ? "✅" :
          "❌";
        
        return `${statusEmoji} ${agent.taskId} [${agent.status}] — ${agent.description}`;
      });
      
      const selected = await ctx.ui.select(
        "🤖 Active Agents",
        options
      );
      
      if (selected === undefined) {
        return;
      }
      
      // Find the selected agent
      const selectedIndex = options.indexOf(selected);
      const agent = agents[selectedIndex];
      
      // Show details
      let details = `Agent: ${agent.taskId}\n`;
      details += `Description: ${agent.description}\n`;
      details += `Status: ${agent.status}\n`;
      details += `Tier: ${agent.tier}\n`;
      
      if (agent.startTime) {
        const duration = agent.endTime
          ? `${((agent.endTime - agent.startTime) / 1000).toFixed(1)}s`
          : `${((Date.now() - agent.startTime) / 1000).toFixed(1)}s (running)`;
        details += `Duration: ${duration}\n`;
      }
      
      if (agent.result) {
        details += `\n--- Result ---\n`;
        if (agent.result.success) {
          details += agent.result.output;
        } else {
          details += `Error: ${agent.result.error || "Unknown error"}\n`;
          if (agent.result.output) {
            details += `\nOutput:\n${agent.result.output}`;
          }
        }
      } else if (agent.status === "running") {
        details += `\n(Agent is still running...)`;
      } else if (agent.status === "queued") {
        details += `\n(Agent is queued, waiting for capacity...)`;
      }
      
      ctx.ui.notify(details, "info");
    },
  });

  // ============================================================================
  // 7. Hook into session_start event
  // ============================================================================
  
  pi.on("session_start", async (_event, ctx) => {
    // Load budget history
    await budgetTracker.load();
    
    // Capture UI context
    uiContext = { ui: ctx.ui };
    
    // Initialize LifecycleManager with runtime dependencies
    lifecycleManager = new LifecycleManager({
      createSession: createAgentSession,
      authStorage: ctx.authStorage,
      modelRegistry: ctx.modelRegistry,
    });
    
    // Initialize WorktreeManager
    const execFn = async (command: string, options?: { cwd?: string }) => {
      const result = await pi.exec("bash", ["-c", command], { cwd: options?.cwd });
      return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
    };
    worktreeManager = new WorktreeManager(execFn);
    
    // Initialize AgentPool with event callbacks
    agentPool = new AgentPool(
      3, // maxConcurrent
      lifecycleManager,
      budgetTracker,
      {
        onOutput: (taskId: string, delta: string) => {
          // Initialize the widget for this agent if needed
          const agent = agentPool?.getAgent(taskId);
          if (agent && currentAgentId !== taskId) {
            currentAgentId = taskId;
            currentAgentTier = agent.tier;
            currentAgentDescription = agent.description;
            outputBuffer = [];
          }

          // Add delta to the buffer, splitting by newlines
          const lines = delta.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (i === 0 && outputBuffer.length > 0) {
              // Append to the last line
              outputBuffer[outputBuffer.length - 1] += lines[i];
            } else {
              outputBuffer.push(lines[i]);
            }
          }

          // Keep only last 8 lines
          if (outputBuffer.length > 8) {
            outputBuffer = outputBuffer.slice(-8);
          }

          updateAgentWidget();
        },

        onComplete: async (info) => {
          if (info.result) {
            const modelSelection = selectModel(info.tier);
            await memoryLogger.logTaskCompletion(
              info.result,
              info.tier,
              modelSelection.modelId
            );
          }
          
          // Clear widget if this was the displayed agent
          if (currentAgentId === info.taskId) {
            clearAgentWidget();
          }
          
          if (ctx.ui) {
            ctx.ui.notify(
              `✅ Agent completed: ${info.taskId}\n${info.description}`,
              "info"
            );

            // Update status
            if (agentPool) {
              const status = getAgentStatusText(agentPool);
              ctx.ui.setStatus("orchestrator", status);
            }
          }
          
          // Save budget after each task
          await budgetTracker.save();
        },
        
        onFailed: async (info) => {
          if (info.result) {
            const modelSelection = selectModel(info.tier);
            await memoryLogger.logTaskCompletion(
              info.result,
              info.tier,
              modelSelection.modelId
            );
          }
          
          // Clear widget if this was the displayed agent
          if (currentAgentId === info.taskId) {
            clearAgentWidget();
          }
          
          if (ctx.ui) {
            const error = info.result?.error || "Unknown error";
            ctx.ui.notify(
              `❌ Agent failed: ${info.taskId}\n${info.description}\nError: ${error}`,
              "error"
            );

            // Update status 
            if (agentPool) {
              const status = getAgentStatusText(agentPool);
              ctx.ui.setStatus("orchestrator", status);
            }
          }
          
          // Save budget after each task
          await budgetTracker.save();
        },
        
        onWarning: (warning) => {
          if (ctx.ui) {
            ctx.ui.notify(warning.message, "warning");
          }
        },
      }
    );
  });
}
