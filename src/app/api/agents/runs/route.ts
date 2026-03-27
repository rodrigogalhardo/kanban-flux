import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const cardId = searchParams.get("cardId");
  const status = searchParams.get("status");

  const limit = searchParams.get("limit");

  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
  if (cardId) where.cardId = cardId;
  if (status) where.status = status;

  const take = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;

  const runs = await prisma.agentRun.findMany({
    where,
    include: {
      agent: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      },
      card: { select: { id: true, title: true } },
      _count: { select: { logs: true, childRuns: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit("agent-runs", 30, 60000); // 30 runs per minute
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const { agentId, cardId, parentRunId } = body;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const activeRuns = await prisma.agentRun.count({
    where: {
      agentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeRuns >= agent.maxConcurrent) {
    return NextResponse.json(
      { error: "Agent has reached maximum concurrent runs" },
      { status: 429 }
    );
  }

  const run = await prisma.agentRun.create({
    data: {
      agentId,
      cardId,
      parentRunId: parentRunId || null,
      status: "QUEUED",
    },
    include: {
      agent: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      },
      card: { select: { id: true, title: true } },
    },
  });

  await prisma.agent.update({
    where: { id: agentId },
    data: { status: "WORKING" },
  });

  // Enqueue for processing by the worker (dynamic import to avoid build-time Redis connection)
  const { enqueueAgentRun } = await import("@/lib/agents/queue");
  await enqueueAgentRun(run.id);

  return NextResponse.json(run, { status: 202 });
}
