import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: cardId } = await params;
  const { agentIds } = await req.json();

  if (!agentIds || !Array.isArray(agentIds) || agentIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 agentIds are required for a challenge" },
      { status: 400 }
    );
  }

  // Verify the card exists
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const runs = [];
  for (const agentId of agentIds) {
    const run = await prisma.agentRun.create({
      data: { agentId, cardId, status: "QUEUED" },
    });
    try {
      const { enqueueAgentRun } = await import("@/lib/agents/queue");
      await enqueueAgentRun(run.id);
    } catch {
      // Queue might not be available, run stays QUEUED
    }
    runs.push(run);
  }

  return NextResponse.json(
    { runs: runs.length, runIds: runs.map((r) => r.id), message: `${runs.length} agents competing` },
    { status: 202 }
  );
}
