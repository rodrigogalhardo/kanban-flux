import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { newName } = await req.json();

  const original = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      boards: {
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: {
              cards: {
                include: {
                  labels: true,
                  members: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Create new project
  const replay = await prisma.project.create({
    data: {
      name: newName || `${original.name} (Replay)`,
      description: original.description,
      workspaceId: original.workspaceId,
      autoTrigger: original.autoTrigger,
    },
  });

  // Clone boards and cards (reset to Todo)
  for (const board of original.boards) {
    const newBoard = await prisma.board.create({
      data: {
        name: board.name,
        description: board.description,
        workspaceId: original.workspaceId,
        projectId: replay.id,
      },
    });

    const todoCol = await prisma.column.create({
      data: { title: "Todo", position: 0, boardId: newBoard.id },
    });

    // Create remaining columns
    const colNames = ["Brainstorming", "In Progress", "QA", "Bug", "Done"];
    for (let i = 0; i < colNames.length; i++) {
      await prisma.column.create({
        data: { title: colNames[i], position: i + 1, boardId: newBoard.id },
      });
    }

    // Clone all cards into Todo (fresh start)
    let pos = 0;
    for (const col of board.columns) {
      for (const card of col.cards) {
        const newCard = await prisma.card.create({
          data: {
            title: card.title,
            description: card.description,
            position: pos++,
            columnId: todoCol.id,
            priority: card.priority,
            dueDate: card.dueDate,
          },
        });

        // Copy member assignments
        for (const member of card.members) {
          await prisma.cardMember
            .create({
              data: { cardId: newCard.id, userId: member.userId },
            })
            .catch(() => {});
        }
      }
    }
  }

  return NextResponse.json(replay, { status: 201 });
}
