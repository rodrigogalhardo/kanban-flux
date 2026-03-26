import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Count total agents and active agents
    const [totalAgents, activeAgents] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.count({ where: { status: "WORKING" } }),
    ]);

    // Aggregate runs by status
    const runStatusCounts = await prisma.agentRun.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const runsByStatus: Record<string, number> = {};
    let totalRuns = 0;
    let completedRuns = 0;
    let failedRuns = 0;

    for (const entry of runStatusCounts) {
      runsByStatus[entry.status] = entry._count.id;
      totalRuns += entry._count.id;
      if (entry.status === "COMPLETED") completedRuns = entry._count.id;
      if (entry.status === "FAILED") failedRuns = entry._count.id;
    }

    // Sum tokens and cost
    const tokenAndCostAgg = await prisma.agentRun.aggregate({
      _sum: {
        tokenUsage: true,
        cost: true,
      },
    });

    const totalTokens = tokenAndCostAgg._sum.tokenUsage ?? 0;
    const totalCost = tokenAndCostAgg._sum.cost ?? 0;

    // Calculate average run time from completed runs
    const completedRunsData = await prisma.agentRun.findMany({
      where: {
        status: "COMPLETED",
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    let avgRunTime = 0;
    if (completedRunsData.length > 0) {
      const totalTime = completedRunsData.reduce((sum, run) => {
        const start = new Date(run.startedAt!).getTime();
        const end = new Date(run.completedAt!).getTime();
        return sum + (end - start);
      }, 0);
      avgRunTime = Math.round(totalTime / completedRunsData.length);
    }

    // Group runs by agent role
    const agents = await prisma.agent.findMany({
      include: {
        user: { select: { name: true } },
        runs: {
          select: {
            status: true,
            tokenUsage: true,
          },
        },
      },
    });

    const runsByAgent = agents.map((agent) => {
      const completed = agent.runs.filter((r) => r.status === "COMPLETED").length;
      const failed = agent.runs.filter((r) => r.status === "FAILED").length;
      const tokens = agent.runs.reduce((sum, r) => sum + (r.tokenUsage ?? 0), 0);

      return {
        role: agent.role,
        name: agent.user.name,
        completed,
        failed,
        tokens,
      };
    });

    // Get last 10 completed/failed runs
    const recentRuns = await prisma.agentRun.findMany({
      where: {
        status: { in: ["COMPLETED", "FAILED"] },
      },
      include: {
        agent: {
          include: {
            user: { select: { name: true } },
          },
        },
        card: { select: { title: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 10,
    });

    const recentRunsMapped = recentRuns.map((run) => ({
      id: run.id,
      agentRole: run.agent.role,
      agentName: run.agent.user.name,
      cardTitle: run.card.title,
      status: run.status,
      tokenUsage: run.tokenUsage ?? 0,
      cost: run.cost ?? 0,
      completedAt: run.completedAt?.toISOString() ?? run.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      totalAgents,
      activeAgents,
      totalRuns,
      completedRuns,
      failedRuns,
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100,
      avgRunTime,
      runsByAgent,
      runsByStatus,
      recentRuns: recentRunsMapped,
    });
  } catch (error) {
    console.error("Failed to fetch agent stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent stats" },
      { status: 500 }
    );
  }
}
