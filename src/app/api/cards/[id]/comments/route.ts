import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const comments = await prisma.comment.findMany({
    where: { cardId: params.id },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const comment = await prisma.comment.create({
    data: {
      text: body.text,
      userId: body.userId,
      cardId: params.id,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });
  return NextResponse.json(comment, { status: 201 });
}
