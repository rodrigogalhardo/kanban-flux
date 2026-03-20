import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const maxPosition = await prisma.column.findFirst({
    where: { boardId: body.boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const column = await prisma.column.create({
    data: {
      title: body.title,
      position: (maxPosition?.position ?? -1) + 1,
      boardId: body.boardId,
    },
  });
  return NextResponse.json(column, { status: 201 });
}
