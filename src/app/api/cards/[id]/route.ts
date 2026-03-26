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
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.position !== undefined) data.position = body.position;
  if (body.columnId !== undefined) data.columnId = body.columnId;

  // Fetch existing card before update to detect changes
  const existingCard = await prisma.card.findUnique({
    where: { id: params.id },
    select: { columnId: true, title: true, description: true, priority: true },
  });

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

  // Record history for changes
  if (existingCard) {
    const changes: { action: string; details: string }[] = [];
    if (body.title && body.title !== existingCard.title) {
      changes.push({ action: "updated_title", details: "Title changed" });
    }
    if (body.description !== undefined && body.description !== existingCard.description) {
      changes.push({ action: "updated_description", details: "Description updated" });
    }
    if (body.columnId && body.columnId !== existingCard.columnId) {
      const newCol = await prisma.column.findUnique({ where: { id: body.columnId }, select: { title: true } });
      changes.push({ action: "moved", details: `Moved to "${newCol?.title}"` });
    }
    if (body.priority !== undefined && body.priority !== existingCard.priority) {
      changes.push({ action: "priority_changed", details: `Priority changed to P${body.priority}` });
    }

    for (const change of changes) {
      await prisma.cardHistory.create({
        data: { cardId: params.id, action: change.action, details: change.details },
      });
    }
  }

  // Auto-trigger agent if column changed (card moved)
  if (body.columnId && existingCard && body.columnId !== existingCard.columnId) {
    import("@/lib/agents/auto-trigger").then(({ handleCardColumnChange }) => {
      handleCardColumnChange(params.id, body.columnId, existingCard.columnId).catch(console.error);
    });
  }

  return NextResponse.json(card);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.card.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
