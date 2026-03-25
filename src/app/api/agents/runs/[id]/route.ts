import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPipeline } from "@/lib/agents/orchestrator";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const run = await prisma.agentRun.findUnique({
    where: { id: params.id },
    include: {
      agent: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      },
      card: true,
      logs: {
        orderBy: { createdAt: "asc" },
      },
      childRuns: {
        orderBy: { createdAt: "desc" },
        include: {
          agent: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { status } = body;

  if (status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Only cancellation is supported" },
      { status: 400 }
    );
  }

  const run = await prisma.agentRun.findUnique({
    where: { id: params.id },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "QUEUED" && run.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Can only cancel QUEUED or RUNNING runs" },
      { status: 400 }
    );
  }

  // Use orchestrator for proper cascade cancellation (run + all child runs)
  await cancelPipeline(params.id);

  // Fetch updated run to return
  const updated = await prisma.agentRun.findUnique({
    where: { id: params.id },
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

  return NextResponse.json(updated);
}
