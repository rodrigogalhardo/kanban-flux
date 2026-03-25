import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          card: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [runStats, tokenAgg, cardsWorked, lastRun] = await Promise.all([
    prisma.agentRun.groupBy({
      by: ["status"],
      where: { agentId: params.id },
      _count: { status: true },
    }),
    prisma.agentRun.aggregate({
      where: { agentId: params.id },
      _sum: { tokenUsage: true },
    }),
    prisma.agentRun.findMany({
      where: { agentId: params.id },
      distinct: ["cardId"],
      select: { cardId: true },
    }),
    prisma.agentRun.findFirst({
      where: { agentId: params.id },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const stats = {
    total: runStats.reduce((sum, r) => sum + r._count.status, 0),
    completed:
      runStats.find((r) => r.status === "COMPLETED")?._count.status || 0,
    failed: runStats.find((r) => r.status === "FAILED")?._count.status || 0,
    totalTokens: tokenAgg._sum.tokenUsage || 0,
    cardsWorked: cardsWorked.length,
    lastActive: lastRun?.updatedAt?.toISOString() || null,
  };

  return NextResponse.json({ ...agent, stats });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const {
    name,
    provider,
    model,
    role,
    systemPrompt,
    capabilities,
    status,
    apiKeyId,
    maxConcurrent,
  } = body;

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (name) {
    await prisma.user.update({
      where: { id: agent.userId },
      data: { name },
    });
  }

  const agentData: Record<string, unknown> = {};
  if (provider !== undefined) agentData.provider = provider;
  if (model !== undefined) agentData.model = model;
  if (role !== undefined) agentData.role = role;
  if (systemPrompt !== undefined) agentData.systemPrompt = systemPrompt;
  if (capabilities !== undefined) agentData.capabilities = capabilities;
  if (status !== undefined) agentData.status = status;
  if (apiKeyId !== undefined) agentData.apiKeyId = apiKeyId;
  if (maxConcurrent !== undefined) agentData.maxConcurrent = maxConcurrent;

  const updated = await prisma.agent.update({
    where: { id: params.id },
    data: agentData,
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  await prisma.agent.delete({ where: { id: params.id } });
  await prisma.user.delete({ where: { id: agent.userId } });

  return NextResponse.json({ success: true });
}
