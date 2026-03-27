import { prisma } from "@/lib/prisma";
import { triggerLogger } from "@/lib/logger";

/**
 * Auto-trigger: when a card moves to a new column, trigger the assigned agent.
 *
 * Rules:
 * - Card moves to "Todo" or "Brainstorming" -> trigger Analyst/Master if assigned
 * - Card moves to "In Progress" -> trigger the assigned dev agent (frontend, backend, etc.)
 * - Card moves to "QA" -> trigger QA agent if assigned, or find and assign one
 * - Card moves to "Bug" -> trigger the original dev agent to fix
 * - Card moves to "Done" -> no trigger (task complete)
 */
export async function handleCardColumnChange(cardId: string, newColumnId: string, oldColumnId?: string) {
  // Skip if same column
  if (newColumnId === oldColumnId) return;

  // Get the column info and check if project has autoTrigger enabled
  const column = await prisma.column.findUnique({
    where: { id: newColumnId },
    include: {
      board: {
        include: {
          project: { select: { id: true, autoTrigger: true } },
        },
      },
    },
  });

  if (!column) return;

  // Check autoTrigger - if board has no project, default to true
  const autoTrigger = column.board.project?.autoTrigger ?? true;
  if (!autoTrigger) return;

  // Get card with members
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      members: {
        include: {
          user: { select: { id: true, isAgent: true, name: true } },
        },
      },
    },
  });

  if (!card) return;

  const columnTitle = column.title.toLowerCase();

  // Record agent feedback when card moves to "Done" or "Bug"
  if (columnTitle === "done" || columnTitle === "bug") {
    try {
      const agentMembers = card.members.filter(m => m.user.isAgent);
      for (const member of agentMembers) {
        const feedbackAgent = await prisma.agent.findFirst({ where: { userId: member.user.id } });
        if (feedbackAgent) {
          await prisma.agentFeedback.create({
            data: {
              agentId: feedbackAgent.id,
              outcome: columnTitle === "done" ? "success" : "failure",
              context: card.title,
            },
          });
          triggerLogger.info("Recorded agent feedback", {
            agentId: feedbackAgent.id,
            outcome: columnTitle === "done" ? "success" : "failure",
            cardTitle: card.title,
          });
        }
      }
    } catch (e) {
      triggerLogger.error("Failed to record agent feedback", {
        cardId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Don't trigger agent runs on "Done" column
  if (columnTitle === "done") return;

  // Find the right agent to trigger based on column
  let targetUserId: string | null = null;

  if (columnTitle === "qa") {
    // Find QA agent - first check if one is assigned to this card
    const qaOnCard = card.members.find(m => m.user.isAgent);
    if (qaOnCard) {
      targetUserId = qaOnCard.user.id;
    } else {
      // Find a QA agent and auto-assign
      const qaAgent = await prisma.agent.findFirst({
        where: { role: "qa" },
        include: { user: { select: { id: true } } },
      });
      if (qaAgent) {
        targetUserId = qaAgent.userId;
        // Auto-assign QA to the card
        await prisma.cardMember.upsert({
          where: { cardId_userId: { cardId, userId: qaAgent.userId } },
          create: { cardId, userId: qaAgent.userId },
          update: {},
        });
      }
    }
  } else if (columnTitle === "bug") {
    // Find the original dev agent (non-QA agent member)
    const devAgent = card.members.find(m => m.user.isAgent);
    if (devAgent) {
      targetUserId = devAgent.user.id;
    }
  } else {
    // For Todo, Brainstorming, In Progress - trigger the assigned agent
    const assignedAgent = card.members.find(m => m.user.isAgent);
    if (assignedAgent) {
      targetUserId = assignedAgent.user.id;
    }
  }

  if (!targetUserId) return;

  // Find the agent record
  const agent = await prisma.agent.findFirst({
    where: { userId: targetUserId },
  });

  if (!agent) return;

  // Check if agent is already running on this card
  const activeRun = await prisma.agentRun.findFirst({
    where: {
      agentId: agent.id,
      cardId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeRun) return; // Already running, don't double-trigger

  // Check capacity
  const activeRuns = await prisma.agentRun.count({
    where: {
      agentId: agent.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeRuns >= agent.maxConcurrent) return;

  // Create and enqueue the run
  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      cardId,
      status: "QUEUED",
    },
  });

  await prisma.agent.update({
    where: { id: agent.id },
    data: { status: "WORKING" },
  });

  try {
    const { enqueueAgentRun } = await import("./queue");
    await enqueueAgentRun(run.id);
    triggerLogger.info("Auto-triggered agent", { cardId, agentRole: agent.role, columnTitle: column.title });
  } catch (e) {
    triggerLogger.error("Failed to enqueue auto-triggered run", { cardId, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function handleAgentAssigned(cardId: string, agentUserId: string) {
  // Find the agent
  const agent = await prisma.agent.findFirst({
    where: { userId: agentUserId },
  });
  if (!agent) return;

  // Get the card's column
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { include: { board: { include: { project: { select: { autoTrigger: true } } } } } } },
  });
  if (!card) return;

  const autoTrigger = card.column.board.project?.autoTrigger ?? true;
  if (!autoTrigger) return;

  // Don't trigger if card is in Done
  if (card.column.title.toLowerCase() === "done") return;

  // Check for active runs
  const activeRun = await prisma.agentRun.findFirst({
    where: { agentId: agent.id, cardId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (activeRun) return;

  // Check capacity
  const activeRuns = await prisma.agentRun.count({
    where: { agentId: agent.id, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (activeRuns >= agent.maxConcurrent) return;

  // Create and enqueue run
  const run = await prisma.agentRun.create({
    data: { agentId: agent.id, cardId, status: "QUEUED" },
  });
  await prisma.agent.update({ where: { id: agent.id }, data: { status: "WORKING" } });
  try {
    const { enqueueAgentRun } = await import("./queue");
    await enqueueAgentRun(run.id);
    triggerLogger.info("Agent triggered on assignment", { cardId, agentRole: agent.role });
  } catch (e) {
    triggerLogger.error("Failed to enqueue agent on assignment", { cardId, error: e instanceof Error ? e.message : String(e) });
  }
}
