import { prisma } from "@/lib/prisma";
import { executeRun } from "./executor";

/**
 * Start a project analysis pipeline:
 * 1. Creates a run for the specified agent on the card
 * 2. Executes the run (the agent will autonomously create sub-cards and delegate)
 * 3. Returns the run ID for tracking
 */
export async function startProjectPipeline(cardId: string, agentId: string, parentRunId?: string): Promise<string> {
  // Validate the agent exists and is available
  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
  });

  // Check agent is not at max capacity
  const activeRuns = await prisma.agentRun.count({
    where: {
      agentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeRuns >= agent.maxConcurrent) {
    throw new Error(`Agent ${agent.role} is at max capacity (${agent.maxConcurrent} concurrent runs)`);
  }

  // Create the run
  const run = await prisma.agentRun.create({
    data: {
      agentId,
      cardId,
      parentRunId: parentRunId || null,
      status: "QUEUED",
    },
  });

  // Execute asynchronously (fire-and-forget)
  executeRun(run.id).catch((err) => {
    console.error(`Pipeline run ${run.id} failed:`, err);
  });

  return run.id;
}

/**
 * Get the full pipeline tree for a run (parent + all descendants)
 */
export async function getPipelineTree(runId: string) {
  const run = await prisma.agentRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      agent: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      card: { select: { id: true, title: true } },
      logs: { orderBy: { createdAt: "asc" }, take: 50 },
      childRuns: {
        include: {
          agent: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          card: { select: { id: true, title: true } },
          logs: { orderBy: { createdAt: "asc" }, take: 20 },
          childRuns: {
            include: {
              agent: { include: { user: { select: { id: true, name: true, avatar: true } } } },
              card: { select: { id: true, title: true } },
              logs: { orderBy: { createdAt: "asc" }, take: 10 },
            },
          },
        },
      },
    },
  });

  return run;
}

/**
 * Cancel a pipeline (run + all child runs)
 */
export async function cancelPipeline(runId: string): Promise<void> {
  // Cancel the main run
  await prisma.agentRun.updateMany({
    where: {
      OR: [
        { id: runId },
        { parentRunId: runId },
      ],
      status: { in: ["QUEUED", "RUNNING"] },
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });

  // Also cancel grandchildren (one more level)
  const childRuns = await prisma.agentRun.findMany({
    where: { parentRunId: runId },
    select: { id: true },
  });

  if (childRuns.length > 0) {
    await prisma.agentRun.updateMany({
      where: {
        parentRunId: { in: childRuns.map((r) => r.id) },
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });
  }

  // Reset all affected agents to IDLE
  const cancelledRuns = await prisma.agentRun.findMany({
    where: {
      OR: [
        { id: runId },
        { parentRunId: runId },
        { parentRunId: { in: childRuns.map((r) => r.id) } },
      ],
    },
    select: { agentId: true },
    distinct: ["agentId"],
  });

  for (const cr of cancelledRuns) {
    const stillActive = await prisma.agentRun.count({
      where: {
        agentId: cr.agentId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });
    if (stillActive === 0) {
      await prisma.agent.update({
        where: { id: cr.agentId },
        data: { status: "IDLE" },
      });
    }
  }
}
