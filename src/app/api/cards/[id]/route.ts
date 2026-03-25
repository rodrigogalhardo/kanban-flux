import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      labels: { include: { label: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, isAgent: true } } } },
      checklists: { include: { items: true } },
      comments: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json(card);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.position !== undefined) data.position = body.position;
  if (body.columnId !== undefined) data.columnId = body.columnId;

  const card = await prisma.card.update({
    where: { id: params.id },
    data,
    include: {
      labels: { include: { label: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, isAgent: true } } } },
      checklists: { include: { items: true } },
      comments: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return NextResponse.json(card);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.card.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
