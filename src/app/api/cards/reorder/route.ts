import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { cards } = await req.json();
  await prisma.$transaction(
    cards.map((card: { id: string; columnId: string; position: number }) =>
      prisma.card.update({
        where: { id: card.id },
        data: { columnId: card.columnId, position: card.position },
      })
    )
  );
  return NextResponse.json({ success: true });
}
