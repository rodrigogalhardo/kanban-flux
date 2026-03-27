import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level");
  const agentId = searchParams.get("agentId");
  const limit = parseInt(searchParams.get("limit") || "100");

  const where: Record<string, unknown> = {};
  if (level) where.level = level;
  if (agentId) where.run = { agentId };

  const logs = await prisma.agentRunLog.findMany({
    where,
    include: {
      run: {
        select: {
          agent: { select: { role: true, user: { select: { name: true } } } },
          card: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });

  return NextResponse.json(logs);
}
