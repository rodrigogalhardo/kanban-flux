import { prisma } from "@/lib/prisma";
import { getProvider } from "./provider";
import { buildTaskContext } from "./context-builder";
import { decrypt } from "./crypto";
import type { AgentAction } from "./types";
import type { Prisma } from "@prisma/client";

const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes

async function logRun(runId: string, level: string, message: string, metadata?: Record<string, unknown>) {
  await prisma.agentRunLog.create({
    data: { runId, level, message, metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : undefined },
  });
}

async function applyAction(action: AgentAction, cardId: string, agentUserId: string, runId: string): Promise<void> {
  switch (action.type) {
    case "comment": {
      const { text } = action.payload as { text: string };
      await prisma.comment.create({
        data: { text, userId: agentUserId, cardId },
      });
      // Notify card members about agent comment
      const { notifyCardMembers: notifyComment } = await import("@/lib/notifications");
      await notifyComment(cardId, agentUserId, {
        type: "agent_comment",
        title: "Agent commented",
        message: text.substring(0, 100),
      });
      await logRun(runId, "info", `Posted comment: ${text.substring(0, 100)}...`);
      break;
    }

    case "checklist_update": {
      const { checklistId, itemId, completed } = action.payload as {
        checklistId: string;
        itemId: string;
        completed: boolean;
      };
      await prisma.checklistItem.update({
        where: { id: itemId, checklistId },
        data: { completed },
      });
      await logRun(runId, "info", `Updated checklist item ${itemId}: completed=${completed}`);
      break;
    }

    case "move_card": {
      const { columnId } = action.payload as { columnId: string };
      // Get the max position in the target column
      const maxPos = await prisma.card.aggregate({
        where: { columnId },
        _max: { position: true },
      });
      await prisma.card.update({
        where: { id: cardId },
        data: { columnId, position: (maxPos._max.position ?? -1) + 1 },
      });
      // Notify card members about card move
      const { notifyCardMembers: notifyMove } = await import("@/lib/notifications");
      const targetCol = await prisma.column.findUnique({ where: { id: columnId }, select: { title: true } });
      await notifyMove(cardId, agentUserId, {
        type: "card_move",
        title: "Card moved",
        message: `Card moved to "${targetCol?.title || "column"}"`,
      });
      await logRun(runId, "info", `Moved card to column ${columnId}`);
      break;
    }

    case "update_description": {
      const { description } = action.payload as { description: string };
      await prisma.card.update({
        where: { id: cardId },
        data: { description },
      });
      await logRun(runId, "info", `Updated card description`);
      break;
    }

    case "create_card": {
      const { title, description, columnId } = action.payload as {
        title: string;
        description?: string;
        columnId: string;
      };
      const maxPos = await prisma.card.aggregate({
        where: { columnId },
        _max: { position: true },
      });
      const newCard = await prisma.card.create({
        data: {
          title,
          description: description || null,
          columnId,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
      await logRun(runId, "info", `Created card "${title}" (id: ${newCard.id})`, { cardId: newCard.id });
      break;
    }

    case "assign_agent": {
      const { cardId: targetCardId, agentUserId: targetUserId } = action.payload as {
        cardId: string;
        agentUserId: string;
      };
      // Create CardMember link (upsert to avoid duplicates)
      await prisma.cardMember.upsert({
        where: { cardId_userId: { cardId: targetCardId, userId: targetUserId } },
        create: { cardId: targetCardId, userId: targetUserId },
        update: {},
      });
      await logRun(runId, "info", `Assigned agent ${targetUserId} to card ${targetCardId}`);
      break;
    }

    case "trigger_agent": {
      const { agentId: targetAgentId, cardId: targetCardId } = action.payload as {
        agentId: string;
        cardId: string;
      };
      // Create a child run
      const childRun = await prisma.agentRun.create({
        data: {
          agentId: targetAgentId,
          cardId: targetCardId,
          parentRunId: runId,
          status: "QUEUED",
        },
      });
      await logRun(runId, "info", `Triggered agent ${targetAgentId} on card ${targetCardId} (run: ${childRun.id})`);
      // Dynamic import to avoid build-time Redis connection
      const { enqueueAgentRun } = await import("./queue");
      await enqueueAgentRun(childRun.id);
      break;
    }

    case "log": {
      const { level, message } = action.payload as { level?: string; message: string };
      await logRun(runId, level || "info", message);
      break;
    }

    case "git_commit": {
      const { repo, path, content, message, branch } = action.payload as {
        repo: string; path: string; content: string; message: string; branch?: string;
      };
      const { commitFile } = await import("@/lib/github");
      await commitFile(repo, path, content, message, branch || "main");
      await logRun(runId, "info", `Committed to ${repo}/${path}: ${message}`);
      break;
    }

    case "create_pr": {
      const { repo, title, body, head, base } = action.payload as {
        repo: string; title: string; body: string; head: string; base?: string;
      };
      const { createPullRequest } = await import("@/lib/github");
      const pr = await createPullRequest(repo, title, body, head, base || "main");
      await logRun(runId, "info", `Created PR #${pr.number}: ${title} (${pr.url})`);
      break;
    }

    case "merge_pr": {
      const { repo, pullNumber } = action.payload as { repo: string; pullNumber: number };
      const { mergePullRequest } = await import("@/lib/github");
      await mergePullRequest(repo, pullNumber);
      await logRun(runId, "info", `Merged PR #${pullNumber} in ${repo}`);
      break;
    }

    case "git_branch": {
      const { repo, branchName, fromBranch } = action.payload as {
        repo: string; branchName: string; fromBranch?: string;
      };
      const { createBranch } = await import("@/lib/github");
      await createBranch(repo, branchName, fromBranch || "main");
      await logRun(runId, "info", `Created branch ${branchName} in ${repo}`);
      break;
    }

    default:
      await logRun(runId, "warn", `Unknown action type: ${action.type}`);
  }
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
            user: { select: { id: true } },
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

    const response = await provider.execute(context, apiKey);

    await logRun(runId, "info", `Provider returned ${response.actions.length} actions, ${response.tokenUsage} tokens`);

    // Apply all actions
    for (const action of response.actions) {
      // Check cancellation between actions
      const checkRun = await prisma.agentRun.findUnique({ where: { id: runId } });
      if (checkRun?.status === "CANCELLED") {
        await logRun(runId, "info", "Run cancelled during execution");
        return;
      }

      try {
        await applyAction(action, run.cardId, run.agent.user.id, runId);
      } catch (actionError) {
        await logRun(runId, "error", `Failed to apply action ${action.type}: ${actionError instanceof Error ? actionError.message : String(actionError)}`);
      }
    }

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

    await logRun(runId, "info", `Run completed. Tokens: ${response.tokenUsage}, Cost: $${cost.toFixed(4)}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

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
