import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: {
              labels: { include: { label: true } },
              members: {
                include: {
                  user: { select: { id: true, name: true, avatar: true, isAgent: true } }
                }
              },
              checklists: { include: { items: true } },
              comments: {
                include: {
                  user: { select: { id: true, name: true, avatar: true } }
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
  return NextResponse.json(board);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const board = await prisma.board.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(board);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.board.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
