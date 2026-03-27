import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (role) {
    where.role = role;
  }
  if (status) {
    where.status = status;
  }

  const agents = await prisma.agent.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      _count: {
        select: { runs: true },
      },
      feedbacks: {
        select: { outcome: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute feedback stats for each agent
  const agentsWithFeedback = agents.map((agent) => {
    const feedbacks = agent.feedbacks || [];
    const successCount = feedbacks.filter((f) => f.outcome === "success").length;
    const failureCount = feedbacks.filter((f) => f.outcome === "failure").length;
    const total = feedbacks.length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { feedbacks: _feedbacks, ...rest } = agent;
    return {
      ...rest,
      feedbackStats: total > 0 ? { successCount, failureCount, total, successRate } : undefined,
    };
  });

  return NextResponse.json(agentsWithFeedback);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    role,
    provider,
    model,
    systemPrompt,
    capabilities,
    apiKeyId,
    executionMode,
    workspaceId,
  } = body;

  const effectiveWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;

  const user = await prisma.user.create({
    data: {
      name,
      email: `${role}-agent-${Date.now()}@agents.kanbanflux.ai`,
      isAgent: true,
    },
  });

  await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId: effectiveWorkspaceId,
      role: "MEMBER",
    },
  });

  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      provider,
      model,
      role,
      systemPrompt: systemPrompt || null,
      capabilities: capabilities || [],
      apiKeyId: apiKeyId || null,
      executionMode: executionMode || "bullmq",
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  return NextResponse.json(agent, { status: 201 });
}
