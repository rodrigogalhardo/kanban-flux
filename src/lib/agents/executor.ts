import { prisma } from "@/lib/prisma";
import { getProvider } from "./provider";
import { buildTaskContext } from "./context-builder";
import { decrypt } from "./crypto";
import type { Prisma, AgentProvider as AgentProviderType } from "@prisma/client";
import { agentLogger } from "@/lib/logger";

const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes

async function logRun(runId: string, level: string, message: string, metadata?: Record<string, unknown>) {
  await prisma.agentRunLog.create({
    data: { runId, level, message, metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : undefined },
  });
}

export async function executeRun(runId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch the run with agent and API key data
    const run = await prisma.agentRun.findUniqueOrThrow({
      where: { id: runId },
      include: {
        agent: {
          include: {
            apiKey: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Update run to RUNNING
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // Update agent status to WORKING
    await prisma.agent.update({
      where: { id: run.agentId },
      data: { status: "WORKING" },
    });

    await logRun(runId, "info", `Starting execution for agent role: ${run.agent.role}`);

    // Decrypt API key
    if (!run.agent.apiKey) {
      throw new Error("Agent has no API key configured");
    }
    const apiKey = decrypt(run.agent.apiKey.encryptedKey, run.agent.apiKey.iv);

    // Build task context
    const context = await buildTaskContext(run.cardId, run.agentId);
    context.runId = runId;

    // Get provider and execute
    const provider = getProvider(run.agent.provider);
    await logRun(runId, "info", `Using provider: ${provider.name}, model: ${run.agent.model}`);

    // Check for timeout
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      throw new Error("Execution timeout exceeded");
    }

    // Check if run was cancelled
    const currentRun = await prisma.agentRun.findUnique({ where: { id: runId } });
    if (currentRun?.status === "CANCELLED") {
      await logRun(runId, "info", "Run was cancelled before execution");
      return;
    }

    let response;
    try {
      response = await provider.execute(context, apiKey);
    } catch (providerError) {
      await logRun(runId, "warn", `Provider ${run.agent.provider} failed, trying fallback...`);

      // Try fallback provider
      const { getProviderFallback } = await import("./smart-router");
      const availableKeys = await prisma.agentApiKey.findMany({ select: { provider: true } });
      const availableProviders = Array.from(new Set(availableKeys.map(k => k.provider)));
      const fallback = getProviderFallback(run.agent.provider, availableProviders);

      if (fallback) {
        const fallbackKeyRecord = await prisma.agentApiKey.findFirst({ where: { provider: fallback.provider as AgentProviderType } });
        if (fallbackKeyRecord) {
          const fallbackKey = decrypt(fallbackKeyRecord.encryptedKey, fallbackKeyRecord.iv);
          const fallbackProvider = getProvider(fallback.provider);
          // Override model in context
          context.agent.model = fallback.model;
          response = await fallbackProvider.execute(context, fallbackKey);
          await logRun(runId, "info", `Fallback to ${fallback.provider}/${fallback.model} succeeded`);
        } else {
          throw providerError; // No fallback available
        }
      } else {
        throw providerError;
      }
    }

    await logRun(runId, "info", `Provider returned ${response.actions.length} actions, ${response.tokenUsage} tokens`);

    // Actions are now executed inline during the provider's LLM conversation loop.
    // This allows the LLM to receive real results (e.g., created card IDs) and use
    // them in subsequent tool calls (e.g., assign_agent with the actual card ID).
    // No re-execution needed here.
    await logRun(runId, "info", `All ${response.actions.length} actions were executed inline during LLM conversation`);

    // Calculate cost
    const cost = provider.estimateCost(response.tokenUsage, run.agent.model);

    // Mark run as completed
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        tokenUsage: response.tokenUsage,
        cost,
      },
    });

    agentLogger.info("Run completed", { runId, tokens: response.tokenUsage, cost });
    await logRun(runId, "info", `Run completed. Tokens: ${response.tokenUsage}, Cost: $${cost.toFixed(4)}`);

    // Update project budget
    try {
      const cardWithBoard = await prisma.card.findUnique({
        where: { id: run.cardId },
        include: { column: { include: { board: { select: { projectId: true } } } } },
      });
      if (cardWithBoard?.column.board.projectId) {
        await prisma.project.update({
          where: { id: cardWithBoard.column.board.projectId },
          data: { budgetUsed: { increment: cost } },
        });

        // Check if over budget
        const project = await prisma.project.findUnique({
          where: { id: cardWithBoard.column.board.projectId },
          select: { budget: true, budgetUsed: true, name: true },
        });
        if (project?.budget && (project.budgetUsed + cost) > project.budget) {
          await logRun(runId, "warn", `Project "${project.name}" has exceeded its budget ($${project.budgetUsed.toFixed(2)} / $${project.budget.toFixed(2)})`);
        }
      }
    } catch { /* non-critical */ }

    // Fire webhook for agent_completed
    import("@/lib/webhooks").then(({ fireWebhook }) => {
      prisma.card.findUnique({
        where: { id: run.cardId },
        include: { column: { include: { board: { select: { projectId: true } } } } },
      }).then(card => {
        if (card?.column.board.projectId) {
          fireWebhook(card.column.board.projectId, "agent_completed", {
            agent: run.agent.user.name || run.agent.role,
            cardTitle: card.title || run.cardId,
            tokens: response.tokenUsage,
            cost: cost?.toFixed(4),
          });
        }
      });
    }).catch(() => {});

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    agentLogger.error("Run failed", { runId, error: errorMessage });
    await logRun(runId, "error", `Run failed: ${errorMessage}`);

    // Update run to FAILED
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    // Try to post error comment on the card
    try {
      const run = await prisma.agentRun.findUnique({
        where: { id: runId },
        include: { agent: { include: { user: { select: { id: true } } } } },
      });
      if (run) {
        await prisma.comment.create({
          data: {
            text: `[Agent Error] Execution failed: ${errorMessage}`,
            userId: run.agent.user.id,
            cardId: run.cardId,
          },
        });
      }
    } catch {
      // Ignore errors when posting error comment
    }

    // Fire webhook for run_failed
    try {
      const failedRun = await prisma.agentRun.findUnique({
        where: { id: runId },
        include: { agent: { include: { user: { select: { name: true } } } } },
      });
      if (failedRun) {
        const failedCard = await prisma.card.findUnique({
          where: { id: failedRun.cardId },
          include: { column: { include: { board: { select: { projectId: true } } } } },
        });
        if (failedCard?.column.board.projectId) {
          const { fireWebhook } = await import("@/lib/webhooks");
          await fireWebhook(failedCard.column.board.projectId, "run_failed", {
            agent: failedRun.agent.user.name || failedRun.agent.role,
            cardTitle: failedCard.title,
            error: errorMessage,
          });
        }
      }
    } catch {
      // Non-critical webhook error
    }

  } finally {
    // Reset agent status to IDLE if no other active runs
    try {
      const run = await prisma.agentRun.findUnique({ where: { id: runId } });
      if (run) {
        const activeRuns = await prisma.agentRun.count({
          where: {
            agentId: run.agentId,
            status: { in: ["QUEUED", "RUNNING"] },
          },
        });
        if (activeRuns === 0) {
          await prisma.agent.update({
            where: { id: run.agentId },
            data: { status: "IDLE" },
          });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
