import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const boards = await prisma.board.findMany({
    include: {
      columns: {
        include: {
          cards: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, avatar: true } }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, coverImage, workspaceId, briefing } = body as {
    name: string;
    description?: string;
    coverImage?: string;
    workspaceId: string;
    briefing?: string;
  };

  const board = await prisma.board.create({
    data: {
      name,
      description: description || null,
      coverImage: coverImage || null,
      workspaceId,
      columns: {
        create: [
          { title: "Todo", position: 0 },
          { title: "Brainstorming", position: 1 },
          { title: "In Progress", position: 2 },
          { title: "QA", position: 3 },
          { title: "Bug", position: 4 },
          { title: "Done", position: 5 },
        ],
      },
    },
    include: { columns: true },
  });

  // If briefing is provided, create briefing card and trigger Analyst agent
  if (briefing) {
    try {
      const firstCol = board.columns.find((c) => c.position === 0) || board.columns[0];

      const briefingCard = await prisma.card.create({
        data: {
          title: `Project Briefing & Analysis`,
          description: briefing,
          columnId: firstCol.id,
          position: 0,
        },
      });

      // Find and assign Analyst agent
      const analyst = await prisma.agent.findFirst({
        where: { role: "analyst" },
      });

      if (analyst) {
        await prisma.cardMember.create({
          data: { cardId: briefingCard.id, userId: analyst.userId },
        });

        const run = await prisma.agentRun.create({
          data: {
            agentId: analyst.id,
            cardId: briefingCard.id,
            status: "QUEUED",
          },
        });

        await prisma.agent.update({
          where: { id: analyst.id },
          data: { status: "WORKING" },
        });

        try {
          const { enqueueAgentRun } = await import("@/lib/agents/queue");
          await enqueueAgentRun(run.id);
        } catch (e) {
          console.error("Failed to enqueue analyst run:", e);
        }
      }
    } catch (briefingError) {
      console.error("Failed to setup briefing card:", briefingError);
      // Non-blocking - board creation still succeeds
    }
  }

  return NextResponse.json(board, { status: 201 });
}
