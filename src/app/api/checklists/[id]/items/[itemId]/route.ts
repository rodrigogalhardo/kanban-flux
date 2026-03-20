import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const body = await req.json();
  const item = await prisma.checklistItem.update({
    where: { id: params.itemId },
    data: { completed: body.completed, text: body.text },
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  await prisma.checklistItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
