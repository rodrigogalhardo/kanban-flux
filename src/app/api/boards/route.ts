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
  const board = await prisma.board.create({
    data: {
      name: body.name,
      description: body.description || null,
      coverImage: body.coverImage || null,
      workspaceId: body.workspaceId,
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
  return NextResponse.json(board, { status: 201 });
}
