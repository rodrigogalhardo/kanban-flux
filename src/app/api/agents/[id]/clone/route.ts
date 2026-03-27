import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const { name } = await req.json();

  try {
    const original = await prisma.agent.findUniqueOrThrow({
      where: { id },
      include: { user: true },
    });

    const user = await prisma.user.create({
      data: {
        name: name || `${original.user.name} (Clone)`,
        email: `${original.role}-clone-${Date.now()}@agents.kanbanflux.ai`,
        isAgent: true,
      },
    });

    await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId: DEFAULT_WORKSPACE_ID, role: "MEMBER" },
    });

    const clone = await prisma.agent.create({
      data: {
        userId: user.id,
        provider: original.provider,
        model: original.model,
        role: original.role,
        systemPrompt: original.systemPrompt,
        capabilities: original.capabilities,
        apiKeyId: original.apiKeyId,
        maxConcurrent: original.maxConcurrent,
        executionMode: original.executionMode,
      },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clone agent" },
      { status: 500 }
    );
  }
}
