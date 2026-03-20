import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const maxPosition = await prisma.card.findFirst({
    where: { columnId: body.columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const card = await prisma.card.create({
    data: {
      title: body.title,
      description: body.description || null,
      position: (maxPosition?.position ?? -1) + 1,
      columnId: body.columnId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: {
      labels: { include: { label: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      checklists: { include: { items: true } },
      comments: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });
  return NextResponse.json(card, { status: 201 });
}
