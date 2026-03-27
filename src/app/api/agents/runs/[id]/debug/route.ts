import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const run = await prisma.agentRun.findUnique({
    where: { id: params.id },
    include: {
      agent: { include: { user: { select: { name: true } } } },
      card: {
        include: {
          column: { select: { title: true } },
          labels: { include: { label: true } },
          members: { include: { user: { select: { name: true, isAgent: true } } } },
          checklists: { include: { items: true } },
          comments: { orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { name: true } } } },
        },
      },
      logs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      debugMode: run.debugMode,
      debugPause: run.debugPause,
      agent: run.agent,
      startedAt: run.startedAt,
      tokenUsage: run.tokenUsage,
      cost: run.cost,
    },
    context: {
      card: {
        title: run.card.title,
        description: run.card.description,
        column: run.card.column.title,
        labels: run.card.labels.map(l => l.label.name),
        members: run.card.members.map(m => ({ name: m.user.name, isAgent: m.user.isAgent })),
        checklists: run.card.checklists.map(cl => ({
          title: cl.title,
          items: cl.items.map(i => ({ text: i.text, completed: i.completed })),
        })),
        recentComments: run.card.comments.map(c => ({ user: c.user.name, text: c.text.substring(0, 200) })),
      },
    },
    logs: run.logs,
  });
}

// Pause/Resume/Step
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { action } = await req.json();

  switch (action) {
    case "pause":
      await prisma.agentRun.update({ where: { id: params.id }, data: { debugPause: true } });
      return NextResponse.json({ paused: true });
    case "resume":
      await prisma.agentRun.update({ where: { id: params.id }, data: { debugPause: false } });
      return NextResponse.json({ paused: false });
    case "enable_debug":
      await prisma.agentRun.update({ where: { id: params.id }, data: { debugMode: true, debugPause: true } });
      return NextResponse.json({ debugMode: true });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
