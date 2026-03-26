import { prisma } from "@/lib/prisma";

export async function predictProjectTimeline(projectId: string) {
  // Get all cards in the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boards: {
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  dependencies: true,
                  members: { include: { user: { select: { isAgent: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return null;

  let totalCards = 0, doneCards = 0, inProgressCards = 0, todoCards = 0;
  const cardsByColumn: Record<string, number> = {};

  for (const board of project.boards) {
    for (const col of board.columns) {
      cardsByColumn[col.title] = (cardsByColumn[col.title] || 0) + col.cards.length;
      totalCards += col.cards.length;
      if (col.title.toLowerCase() === "done") doneCards += col.cards.length;
      else if (col.title.toLowerCase().includes("progress")) inProgressCards += col.cards.length;
      else if (col.title.toLowerCase() === "todo" || col.title.toLowerCase() === "brainstorming") todoCards += col.cards.length;
    }
  }

  // Get historical run completion data
  const completedRuns = await prisma.agentRun.findMany({
    where: {
      status: "COMPLETED",
      card: { column: { board: { projectId } } },
    },
    select: { startedAt: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  // Calculate average time per card completion
  const runTimes = completedRuns
    .filter(r => r.startedAt && r.completedAt)
    .map(r => new Date(r.completedAt!).getTime() - new Date(r.startedAt!).getTime());

  const avgRunTimeMs = runTimes.length > 0
    ? runTimes.reduce((a, b) => a + b, 0) / runTimes.length
    : 5 * 60 * 1000; // default 5 min

  // Get active agents count
  const activeAgents = await prisma.agent.count({ where: { status: { not: "ERROR" } } });
  const parallelism = Math.min(activeAgents, 5); // max 5 concurrent

  const remainingCards = totalCards - doneCards;
  const estimatedTimeMs = (remainingCards * avgRunTimeMs) / parallelism;
  const estimatedCompletionDate = new Date(Date.now() + estimatedTimeMs);

  // Velocity: cards completed per day (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCompletedCount = await prisma.agentRun.count({
    where: {
      status: "COMPLETED",
      completedAt: { gt: sevenDaysAgo },
      card: { column: { board: { projectId } } },
    },
  });
  const velocityPerDay = recentCompletedCount / 7;

  return {
    totalCards,
    doneCards,
    inProgressCards,
    todoCards,
    remainingCards,
    completionRate: totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0,
    avgRunTimeSeconds: Math.round(avgRunTimeMs / 1000),
    parallelism,
    estimatedCompletionDate: estimatedCompletionDate.toISOString(),
    estimatedDaysRemaining: Math.ceil(estimatedTimeMs / (24 * 60 * 60 * 1000)),
    velocityPerDay: Math.round(velocityPerDay * 10) / 10,
    cardsByColumn,
  };
}
