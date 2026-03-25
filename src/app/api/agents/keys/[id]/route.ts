import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agentsUsingKey = await prisma.agent.findMany({
    where: { apiKeyId: params.id },
    select: { id: true, role: true },
  });

  if (agentsUsingKey.length > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete API key that is in use by agents",
        agents: agentsUsingKey,
      },
      { status: 409 }
    );
  }

  await prisma.agentApiKey.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
