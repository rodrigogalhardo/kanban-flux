import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [recentCards, recentComments, boards] = await Promise.all([
    prisma.card.findMany({
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        createdAt: true,
        column: {
          select: { title: true, board: { select: { id: true, name: true } } },
        },
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    }),
    prisma.comment.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        text: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatar: true } },
        card: { select: { id: true, title: true } },
      },
    }),
    prisma.board.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { columns: true } },
        columns: {
          select: { _count: { select: { cards: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({ recentCards, recentComments, boards });
}
