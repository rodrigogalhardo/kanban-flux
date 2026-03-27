import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { agentId, templateName, description, category } = await req.json();

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
    include: { user: true },
  });

  const template = await prisma.teamTemplate.create({
    data: {
      name: templateName || `${agent.user.name} Template`,
      description: description || `Published agent: ${agent.role}`,
      category: category || "custom",
      agents: [
        {
          role: agent.role,
          name: agent.user.name,
          provider: agent.provider,
          model: agent.model,
          capabilities: agent.capabilities,
          systemPromptSummary: (agent.systemPrompt || "").substring(0, 200),
        },
      ] as unknown as Prisma.InputJsonValue,
      isPublic: true,
      createdBy: agent.userId,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
