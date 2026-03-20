import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const cardLabel = await prisma.cardLabel.create({
    data: { cardId: params.id, labelId: body.labelId },
    include: { label: true },
  });
  return NextResponse.json(cardLabel, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const labelId = searchParams.get("labelId");
  if (!labelId) {
    return NextResponse.json({ error: "labelId required" }, { status: 400 });
  }
  await prisma.cardLabel.delete({
    where: { cardId_labelId: { cardId: params.id, labelId } },
  });
  return NextResponse.json({ success: true });
}
